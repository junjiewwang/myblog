# 10 · 实验与面试：让结论带着证据上桌

> “文档说它很快”和“这个工作负载下它更合适”，中间隔着一份实验记录。
>
> **当前状态：全部实验待执行。** 本地没有 ClickHouse，本篇没有耗时、吞吐或恢复成功的实测结论。以下 DDL、INSERT 与故障注入只允许在授权的隔离实例开展；不连接生产，不提供线上破坏性脚本。

前置阅读：[03 · 教学 Schema](/observability/clickhouse/03-schema-and-access-patterns.md)、[06 · 聚合状态](/observability/clickhouse/06-metrics-and-materialized-views.md)。先创建其中的 `obs_lab.spans`、`obs_lab.service_minute` 及 MV。
所有实验对象名应尚未存在；重复实验改用新对象和新实验租户，不要靠静默跳过建表复用脏数据。
例中的 `lab-perf-01`、`lab-mv-01` 是隔离测试身份；实际服务的租户只能来自可信鉴权上下文。

```mermaid
flowchart LR
    A[固定数据和版本] --> B[提出单一假设]
    B --> C[对照执行]
    C --> D[核对结果与资源]
    D --> E[保留证据和边界]
```

## 1. 共同实验合同

- 保存 `SELECT version()`、`SHOW CREATE TABLE`、相关 settings、客户端及 Collector 版本。
- 记录数据条数、分布、实际 bytes、批次、并发、缓存条件、parts 状态与实验顺序。
- 每次只改变一个因素；冷暖条件分开，重复运行并报告离散程度，不挑最快一次。
- 固定实验数据清单与查询窗口；客户端绑定 `{from:DateTime64(9, 'UTC')}`、`{to:DateTime64(9, 'UTC')}`，窗口左闭右开。
- 先验证结果相等，再比较成本；小样本只能检验流程，不足以证明生产性能优劣。
- 每条待测查询设置唯一 `query_id` 并保留客户端结果；不要把它当日志表的唯一行键。

### 1.1 统一观测方法

在待测 SELECT 前加 `EXPLAIN indexes = 1`，记录 parts、granules 与索引条件；对照查询固定缓存相关设置。[1]
对 v25.9 及以上，解释计划查询尾部应加 `SETTINGS use_query_condition_cache = 0, use_skip_indexes_on_data_read = 0`；已有 SETTINGS 则合并，旧版先核对支持情况。执行 SELECT 后查日志；计划不是实测扫描量，`read_bytes` 也不等于物理磁盘 I/O。[2]

```sql
SELECT query_id, query_duration_ms, read_rows, read_bytes, memory_usage, ProfileEvents
FROM system.query_log
WHERE type = 'QueryFinish' AND is_initial_query = 1
  AND query_id = {query_id:String}
  AND event_time >= {log_from:DateTime('UTC')}
  AND event_time < {log_to:DateTime('UTC')};
```

确认 `log_queries` 已开启、日志未被概率采样，并等待异步刷入。
只看到本机日志不代表看到了全集群；发起节点汇总读取量也不能再与子查询简单相加。
失败查询另查异常记录，不能因没有 `QueryFinish` 就从实验报告删掉失败样本。

## 2. 固定输入：先生成一次，后续全部复制

以下生成 20,000 条纯合成 Span，只是可调整的实验规模，不是容量或吞吐建议。
`lab_input` 是普通明细副本，不自动继承挂在 `spans` 上的 MV。[3]
记录本次生成的最早时间及其后一小时作为各组固定窗口，不能每轮重新取当前时间。

```sql
CREATE TABLE obs_lab.lab_input AS obs_lab.spans;
INSERT INTO obs_lab.lab_input
    (tenant_id, service_name, timestamp, trace_id, span_id, parent_span_id,
     span_name, span_kind, duration_ns, status_code, attributes)
SELECT
    'lab-perf-01', concat('svc-', toString(number % 10)),
    toDateTime64(toStartOfHour(now('UTC')), 9, 'UTC') + toIntervalSecond(number % 3600),
    leftPad(lower(hex(number + 1)), 32, '0'), leftPad(lower(hex(number + 1)), 16, '0'), '',
    'GET /r', 'SERVER', toUInt64((number % 100 + 1) * 1000000),
    if(number % 20 = 0, 'ERROR', 'OK'),
    map('http.route', concat('/r/', toString(intDiv(number, 1000) % 10)),
        'batch', toString(intDiv(number, 1000)))
FROM numbers(20000);
```

生成规律刻意简单且存在相关性；完成流程验证后，还要补充独立分布、热点、乱序与不同基数。
这份输入不能代表真实请求分布，也不应据此给产品写性能承诺。

## 3. 实验一：批量大小与写入放大

**假设**：小批量可能增加写入请求和 parts 管理开销；具体程度由实验决定。[4]
控制变量：相同输入、表结构、同步写入方式、单客户端串行、相同 settings，无 MV。

```sql
CREATE TABLE obs_lab.lab_batch_large AS obs_lab.lab_input;
CREATE TABLE obs_lab.lab_batch_small AS obs_lab.lab_input;
INSERT INTO obs_lab.lab_batch_large SELECT * FROM obs_lab.lab_input;
INSERT INTO obs_lab.lab_batch_small SELECT * FROM obs_lab.lab_input
WHERE toUInt64(attributes['batch']) = {batch:UInt64};
```

步骤：大批次语句只执行一次；小批次语句将 `batch` 依次绑定为 0 到 19，各执行一次。
保存每批开始、完成、行数、bytes 与错误；不要混用客户端总耗时和单条服务端耗时。
在相同观察阶段查询 `system.parts` 中两表的 active parts、rows、bytes_on_disk，并记录后台合并情况。
**验收**：两表都与输入的行数、事件多重集合及 payload 相同；再比较请求次数、写入成本和 parts 趋势。
**结果：待执行。** 不预言一次 INSERT 只形成一个 part，也不把后台 merge 恰巧完成当成固定收益。

## 4. 实验二：排序键究竟服务哪种查询

控制变量：同一字段、codec、分区、输入顺序、数据量与查询集，只改变排序布局。[3]

`CREATE TABLE ... AS 已有表` 的官方语法只允许可选的 `ENGINE` 覆盖，并会复制源表结构；不能靠在后面追加 `ORDER BY` 来可靠改变排序键。若沿用 `lab_input` 的排序键，下面这个对照实验会失效。因此两张候选表使用**显式列定义**，只改变排序键/主键，且字段与第 03 篇一致。[3]

```sql
CREATE TABLE obs_lab.lab_sort_service
(
    tenant_id String,
    service_name LowCardinality(String),
    timestamp DateTime64(9, 'UTC') CODEC(Delta(8), ZSTD(1)),
    trace_id String,
    span_id String,
    parent_span_id String,
    span_name String,
    span_kind LowCardinality(String),
    duration_ns UInt64,
    status_code LowCardinality(String),
    attributes Map(String, String),
    ingested_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
PRIMARY KEY (tenant_id, service_name, toStartOfHour(timestamp), trace_id)
ORDER BY (tenant_id, service_name, toStartOfHour(timestamp), trace_id, timestamp, span_id);

CREATE TABLE obs_lab.lab_sort_trace
(
    tenant_id String,
    service_name LowCardinality(String),
    timestamp DateTime64(9, 'UTC') CODEC(Delta(8), ZSTD(1)),
    trace_id String,
    span_id String,
    parent_span_id String,
    span_name String,
    span_kind LowCardinality(String),
    duration_ns UInt64,
    status_code LowCardinality(String),
    attributes Map(String, String),
    ingested_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
PRIMARY KEY (tenant_id, trace_id, toStartOfHour(timestamp), service_name)
ORDER BY (tenant_id, trace_id, toStartOfHour(timestamp), service_name, timestamp, span_id);

INSERT INTO obs_lab.lab_sort_service
    (tenant_id, service_name, timestamp, trace_id, span_id, parent_span_id,
     span_name, span_kind, duration_ns, status_code, attributes, ingested_at)
SELECT tenant_id, service_name, timestamp, trace_id, span_id, parent_span_id,
       span_name, span_kind, duration_ns, status_code, attributes, ingested_at
FROM obs_lab.lab_input;

INSERT INTO obs_lab.lab_sort_trace
    (tenant_id, service_name, timestamp, trace_id, span_id, parent_span_id,
     span_name, span_kind, duration_ns, status_code, attributes, ingested_at)
SELECT tenant_id, service_name, timestamp, trace_id, span_id, parent_span_id,
       span_name, span_kind, duration_ns, status_code, attributes, ingested_at
FROM obs_lab.lab_input;
```

步骤：核对两个 `SHOW CREATE TABLE`，确认两张表的 `ORDER BY`、`PRIMARY KEY` 确实不同、列定义完全一致；若排序键仍相同，先停止实验并修正 DDL，不能继续记录性能对照。
分别执行第 03 篇的“租户 + 服务 + 时间”查询，以及第 05 篇的“租户 + TraceId + 时间”查询。
表名只替换成上述两个固定候选；查询参数、返回列和 LIMIT 完全一致，Trace 查询不额外加服务过滤。
记录 `EXPLAIN`、`read_rows`、`read_bytes`、耗时与内存；扩大样本前先保持同一组查询参数。
**验收**：结果集一致；按两类查询分别讨论得失，不把一个查询更快推广成所有查询更快。
**结果：待执行。**

## 5. 实验三：Map 热字段是否值得提升成独立列

控制变量：同一张表、相同数据布局和结果，仅改变过滤表达式。[5]

```sql
CREATE TABLE obs_lab.lab_attr AS obs_lab.lab_input;
ALTER TABLE obs_lab.lab_attr ADD COLUMN route String MATERIALIZED attributes['http.route'];
INSERT INTO obs_lab.lab_attr SELECT * FROM obs_lab.lab_input;
SELECT count() FROM obs_lab.lab_attr
WHERE tenant_id = 'lab-perf-01'
  AND timestamp >= {from:DateTime64(9, 'UTC')} AND timestamp < {to:DateTime64(9, 'UTC')}
  AND attributes['http.route'] = {route:String};
```

步骤：先绑定 `route='/r/1'` 执行，再只把过滤表达式换成 `route = {route:String}` 重复执行。
增加“属性缺失”和“空字符串”样本，说明两者在此 String 模型下怎样区分；不要默认空值语义正确。
记录读取量、耗时、计划及新增列存储；若优化器改写两种表达式，必须记录，不能硬解释成列的收益。
**验收**：两种查询计数一致，payload 保持不变，再判断收益是否覆盖写入计算和额外存储成本。
**结果：待执行。** 此实验不同时改变排序键，否则无法把收益归因给独立列。

## 6. 实验四：跳数索引能跳过多少，不能看名字猜

控制变量：同表同数据，用 settings 控制是否使用跳数索引；索引在导入前建立。[6]

```sql
CREATE TABLE obs_lab.lab_index AS obs_lab.lab_input;
ALTER TABLE obs_lab.lab_index ADD INDEX route_bf attributes['http.route']
TYPE bloom_filter(0.01) GRANULARITY 1;
INSERT INTO obs_lab.lab_index SELECT * FROM obs_lab.lab_input;
SELECT count() FROM obs_lab.lab_index
WHERE tenant_id = 'lab-perf-01'
  AND timestamp >= {from:DateTime64(9, 'UTC')} AND timestamp < {to:DateTime64(9, 'UTC')}
  AND attributes['http.route'] = {route:String}
SETTINGS use_skip_indexes = 0;
```

步骤：绑定相同参数，将实际 SELECT 的 `use_skip_indexes` 从 `0` 改为 `1`，两次运行只改变这个开关。
`EXPLAIN indexes = 1` 单独按第 07 篇的统一观测方法执行：目标版本为 25.9 及以上时，在计划查询中合并 `SETTINGS use_query_condition_cache = 0, use_skip_indexes_on_data_read = 0`；旧版本先确认设置是否存在。两种索引开关各自保存一份完整 settings 清单，不能把计划设置和实际执行设置混成一条语句，也不能跨版本直接比较。
分别测试真实存在的路由与不存在的路由；额外构造“每个 granule 几乎都有目标值”的输入重新对照。
**验收**：结果不变，记录跳过比例、读取成本、索引空间和写入开销；索引无收益也是有效结论。
**结果：待执行。** Bloom filter 的参数不是业务漏数率，假阳性意味着多读而非漏掉应返回的数据。

## 7. 实验五：重复事件进入 MV 后发生什么

先确认第 06 篇 MV 已创建，且 `lab-mv-01` 在源表与聚合表中都没有历史数据。
下面是一份完整小样本；`values` 表函数明确给出类型，时间取本次执行的 UTC 分钟。[7]

```sql
INSERT INTO obs_lab.spans
    (tenant_id, service_name, timestamp, trace_id, span_id, parent_span_id,
     span_name, span_kind, duration_ns, status_code, attributes)
SELECT
    'lab-mv-01', 'svc-lab', toDateTime64(toStartOfMinute(now('UTC')), 9, 'UTC'),
    leftPad(lower(hex(n)), 32, '0'), leftPad(lower(hex(n)), 16, '0'), '',
    'fixture', kind, duration, status, map('lab', 'mv')
FROM values('n UInt8, kind String, duration UInt64, status String',
    (1, 'SERVER', 100000000, 'OK'),
    (2, 'SERVER', 400000000, 'ERROR'),
    (3, 'INTERNAL', 10000000, 'OK'));
```

记录上述分钟边界，执行第 06 篇查询，绑定 `tenant='lab-mv-01'`，范围为该分钟到下一分钟。
**数学预期，非观测结果**：源表 3 行，入口 Span 2 个，错误 1 个；入口延迟是 100 ms 与 400 ms。
不要把这两个数的均值当 P50，也不要预设 TDigest 在目标版本的精确输出。

```sql
INSERT INTO obs_lab.spans
SELECT * FROM obs_lab.spans
WHERE tenant_id = 'lab-mv-01'
  AND timestamp >= {from:DateTime64(9, 'UTC')} AND timestamp < {to:DateTime64(9, 'UTC')}
  AND span_id = '0000000000000001';
```

重复语句**只执行一次**；它与初次三行批次不同，不以重发相同 block 来冒充事件幂等实验。
**数学预期，非观测结果**：在普通 MergeTree 且该次插入成功贡献到 MV 的前提下，源表变为 4 行，聚合入口数为 3，错误仍为 1。
记录实际的引擎、插入去重设置和错误；若实际不符，先调查原因，不篡改预期来“通过测试”。
**验收**：明细多重集合能解释每次聚合贡献；后台 merge 不应被当作撤回重复的机制。
**结果：待执行。** 此实验没有创建 ReplacingMergeTree，不能冒称实测验证了该引擎的所有行为。[8]

### 7.1 加一项回填边界验收

在新的实验身份和空目标上，按第 06 篇停写方案记录历史/增量边界并回填。
安排恰在边界、事件时间早于边界但迟到、重复重放三类输入；按事件 ID 核对每条贡献。
若测试在线双写，需要可证明的提交水位或每分区 offset；只比较事件时间不能证明不重不漏。
**通过条件**：历史集合与实时集合的并集等于输入，交集为空；修正操作有可核对的回滚方案。

## 8. 实验六：正常启动不是链路可靠性的证据

此组必须另备隔离 Writer/Collector 与可控网络端点，缺少条件时保持“待执行”，不替用户现场造故障。
默认 ClickHouse exporter 不能直接写本文教学 Schema：使用已验证的映射 Writer，或在 exporter 默认表另建等价校验。
控制变量：固定事件文件、稳定事件 ID、相同队列与重试配置、相同输入速率；每轮只注入一种故障。

1. 保存输入 manifest：每个事件的 ID、出现次数、规范化 payload，以及发送序号和时间。
2. 正常发送一轮，核对端到端结果；记录 ACK 到底来自接收器、队列还是数据库提交边界。
3. 仅在隔离环境使目标端点暂不可达，继续发送有上限的事件文件；记录积压、重试、失败与丢弃。
4. 恢复端点，等待队列处理完成；检查遗漏、重复、乱序和派生聚合，不只看进程是否健康。
5. 新开一轮，在已知队列水位时重启 Collector，分别核对内存队列与持久化队列的配置和恢复结果。
6. 若要测试磁盘、Keeper 或副本故障，另做审批与独立方案，不能从上述结果外推。

**验收口径**：预先声明允许丢失、重复及恢复时延的预算；实验不默认满足 exactly-once。[9]
恢复后按 `(tenant_id, trace_id, span_id)` 比较多重集合，再逐字段核对规范化 payload。
总行数相等仍可能同时存在一条遗漏和一条重复；只比 `uniq` 又可能隐藏重复次数。
校验业务载荷时排除服务器生成的 `ingested_at`；属性 Map 排序后比较，不依赖键迭代顺序。
可先用 hash 缩小差异范围，但 hash 存在碰撞，不能代替关键数据的逐字段比较。
源明细正确也不能证明 MV 正确，必须额外核对分钟计数、错误数与目标状态读取结果。
**结果：待执行。** 未获取实验日志、队列配置与实际数据前，不写“无损恢复”。

## 9. 结果记录模板

| 实验 | 版本与输入清单 | 结果正确性 | 资源与时延证据 | 结论 |
| --- | --- | --- | --- | --- |
| 批量写入 | 待填写 | 待执行 | 待执行 | 待执行 |
| 排序键 | 待填写 | 待执行 | 待执行 | 待执行 |
| Map 与独立列 | 待填写 | 待执行 | 待执行 | 待执行 |
| 跳数索引 | 待填写 | 待执行 | 待执行 | 待执行 |
| 重复与 MV、回填 | 待填写 | 待执行 | 待执行 | 待执行 |
| 故障恢复 | 待填写 | 待执行 | 待执行 | 待执行 |

原始证据至少包含查询文本及参数、query_id、计划、日志、输入 manifest 与差异清单。
不得在分享材料中暴露真实租户、地址、凭证或用户 payload；本文只使用合成数据。

## 10. 八个面试问题，回答短一点，边界说清楚

1. **ClickHouse 主键保证唯一吗？** 不保证；MergeTree 主键是稀疏索引，重复行需要另行设计处理。
2. **ORDER BY 与分区键有什么区别？** 前者定义 part 内排序，后者划分数据管理边界；都不能直接等同业务唯一键。
3. **Map 查得慢，加索引就行吗？** 先看查询模式、字段局部性和裁剪率，再对照独立列或索引的全链路成本。
4. **MV 为什么读不到旧数据？** 增量 MV 处理新插入 block；创建前历史需要受控回填，源表变化不触发全量重算。
5. **ReplacingMergeTree 去重后，计数 MV 会自动减少吗？** 不会；源表替换合并没有向已经写出的聚合发送撤回事件。
6. **能把每分钟 P99 平均成一小时 P99 吗？** 不能；应合并分布、兼容直方图或可合并状态，再求分位数。
7. **Tail Sampling 后的错误率可以用于 SLO 吗？** 不能无条件使用；偏向错误或慢请求的保留策略改变了样本分布。
8. **Collector 重启后还活着，能证明没丢数据吗？** 不能；要核对 ACK、队列、重试边界以及恢复后的事件和 payload。

## 参考资料

1. [EXPLAIN](https://clickhouse.com/docs/sql-reference/statements/explain)：执行计划及索引信息。
2. [system.query_log](https://clickhouse.com/docs/operations/system-tables/query_log)：字段、异步记录与节点范围。
3. [CREATE TABLE](https://clickhouse.com/docs/sql-reference/statements/create/table) 与 [MergeTree](https://clickhouse.com/docs/engines/table-engines/mergetree-family/mergetree)：复制结构与排序布局。
4. [Selecting an insert strategy](https://clickhouse.com/docs/integrations/data-ingestion/insert-strategies)：批次与写入选择。
5. [Map](https://clickhouse.com/docs/sql-reference/data-types/map)：Map 访问语义；独立列是否受益仍需实验。
6. [Data skipping indexes](https://clickhouse.com/docs/optimize/skipping-indexes)：跳过机制与适用数据分布。
7. [values table function](https://clickhouse.com/docs/sql-reference/table-functions/values)：有类型的多行合成输入。
8. [Incremental materialized view](https://clickhouse.com/docs/materialized-view/incremental-materialized-view) 与 [ReplacingMergeTree](https://clickhouse.com/docs/engines/table-engines/mergetree-family/replacingmergetree)：贡献与去重边界。
9. [Collector resiliency](https://opentelemetry.io/docs/collector/resiliency/)：队列、重试、持久化与故障边界。

以上为滚动官方文档；实验 SQL、版本兼容性和所有性能结论仍待隔离环境验证。

---

[上一篇：09 · 保留、成本与运维](/observability/clickhouse/09-retention-cost-and-operations.md) · [返回系列导读](/observability/clickhouse/README.md)
