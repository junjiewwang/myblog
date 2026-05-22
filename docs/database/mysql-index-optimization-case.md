# MySQL 联合索引最左前缀不匹配导致全索引扫描 — 实战排查与优化

## 背景

某业务系统有一张按月分表的统计表，用于记录各实例的用量数据。有一个定时任务需要查询「过去 30 天有上报的实例列表」，随着数据量增长到百万级，该查询的数据库负载明显升高。

---

## 表结构

```sql
CREATE TABLE IF NOT EXISTS `consumption_statistics_YYYY_M` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键',
  `instance_key` varchar(50) NOT NULL COMMENT '实例标识',
  `app_id` int(11) NOT NULL COMMENT '应用ID',
  `category` varchar(50) NOT NULL COMMENT '分类标签',
  `total_count` bigint(20) NOT NULL DEFAULT '0' COMMENT '总数量',
  `region` varchar(20) NOT NULL COMMENT '地域',
  `start_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
  `end_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '结束时间',
  `updated_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_composite` (`instance_key`, `category`, `start_time`, `end_time`),
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8 COMMENT = '用量统计表';
```

**分表策略**：按月分表，表名格式 `consumption_statistics_{年}_{月}`

---

## 问题 SQL

```sql
SELECT DISTINCT `instance_key`
FROM `consumption_statistics_2026_5`
WHERE `start_time` >= '2026-04-20 00:00:00'
  AND `start_time` <= '2026-05-20 15:00:00';
```

业务含义：查询过去 30 天有上报记录的所有实例。

---

## EXPLAIN 分析（优化前）

```sql
EXPLAIN SELECT DISTINCT `instance_key`
FROM `consumption_statistics_2026_5`
WHERE `start_time` >= '2026-04-20 00:00:00'
  AND `start_time` <= '2026-05-20 15:00:00';
```

| 字段 | 值 | 说明 |
|------|------|------|
| type | **index** | 全索引扫描（遍历所有叶子节点） |
| possible_keys | NULL | 没有可用的范围索引 |
| key | idx_composite | MySQL 选它只因能覆盖查询字段 |
| key_len | 312 | 使用了整个索引 |
| rows | **2,456,852** | 扫描 245 万行 |
| filtered | **11.11** | 只有 11% 的行满足条件 |
| Extra | Using where; Using index | 覆盖索引但仍逐行过滤 |

---

## 根因分析

### 联合索引最左前缀原则

现有索引：`(instance_key, category, start_time, end_time)`

查询条件：`WHERE start_time >= ? AND start_time <= ?`

**问题**：`start_time` 是索引的**第 3 列**，查询跳过了前两列 `instance_key` 和 `category`，违反最左前缀匹配原则。

### B+ Tree 工作原理

联合索引的 B+ Tree 按列顺序排序：先按 `instance_key` 排序，相同 `instance_key` 内按 `category` 排序，再按 `start_time` 排序。

如果查询条件只涉及 `start_time`，MySQL 无法利用 B+ Tree 的有序性做范围定位，只能：

1. 扫描整个索引的所有叶子节点（Full Index Scan）
2. 对每一行检查 `start_time` 是否满足条件
3. 满足条件的仅 11%，**89% 的扫描是无效 IO**

### 为什么 MySQL 还选了这个索引？

因为 `SELECT DISTINCT instance_key` 只需要 `instance_key` 和 `start_time` 两个字段，而 `idx_composite` 索引包含了这两个字段，构成**覆盖索引**（不需要回表）。相比全表扫描（需要读取完整行数据），扫描更窄的索引叶子节点仍然更快。

所以 MySQL 的选择是：「全索引扫描（窄）> 全表扫描（宽）」，但这**不是最优解**。

---

## 解决方案

新增专用覆盖索引：

```sql
INDEX `idx_startTime_instanceKey` (`start_time`, `instance_key`)
```

### 为什么有效

| 需求 | 满足方式 |
|------|---------|
| `WHERE start_time >= ? AND start_time <= ?` | `start_time` 是索引前缀 → **索引范围扫描** ✅ |
| `SELECT DISTINCT instance_key` | `instance_key` 在索引中 → **覆盖索引无需回表** ✅ |

### EXPLAIN 预期（优化后）

| 字段 | 优化前 | 优化后 |
|------|--------|--------|
| type | index（全索引扫描） | **range**（范围扫描） |
| rows | 2,456,852 | **~270,000** |
| filtered | 11.11% | **100%** |
| 无效 IO | 89% | **0%** |

---

## DDL 实施

### 新建表（代码层面修改建表语句）

```sql
CREATE TABLE IF NOT EXISTS `consumption_statistics_YYYY_M` (
  -- ... 字段定义 ...
  INDEX `idx_composite` (`instance_key`, `category`, `start_time`, `end_time`),
  INDEX `idx_startTime_instanceKey` (`start_time`, `instance_key`),
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8;
```

### 存量表（低峰期手动执行）

```sql
ALTER TABLE `consumption_statistics_2026_5`
  ADD INDEX `idx_startTime_instanceKey` (`start_time`, `instance_key`);

ALTER TABLE `consumption_statistics_2026_4`
  ADD INDEX `idx_startTime_instanceKey` (`start_time`, `instance_key`);
```

> ⚠️ 大表加索引建议在低峰期执行，或使用 `pt-online-schema-change` 等在线 DDL 工具避免锁表。

---

## 经验总结

### 核心教训

1. **联合索引不是万能的**：如果查询条件跳过了索引前缀列，即使字段在索引中，也只能全索引扫描，不能范围定位
2. **覆盖索引 ≠ 高效索引**：MySQL 选择某个索引可能只因为它「够窄」，并不意味着查询高效
3. **EXPLAIN 的 type=index 是个警告信号**：它意味着全索引扫描，虽然比全表扫描好，但远不如 range

### 索引设计原则

| 原则 | 说明 |
|------|------|
| **最左前缀匹配** | WHERE 条件中最常用的列放在联合索引最前面 |
| **覆盖索引** | SELECT 的字段尽量被索引覆盖，避免回表 |
| **范围条件放最后** | 范围条件（`>`、`<`、`BETWEEN`）之后的索引列无法继续使用 |
| **按查询模式建索引** | 不同的查询模式可能需要不同的索引，不要试图一个索引覆盖所有场景 |

### 排查 Checklist

当遇到慢查询时：

1. `EXPLAIN` 查看 `type` 字段 — 期望是 `ref`/`range`/`const`，警惕 `index`/`ALL`
2. 检查 `rows` × `(1 - filtered/100)` = 无效扫描行数
3. 对照索引定义，确认 WHERE 条件是否命中最左前缀
4. 确认 SELECT 字段是否被索引覆盖（`Extra: Using index`）
5. 考虑是否需要新增专用索引

---

## 效果验证

优化后在低峰期执行 DDL 加索引，再次 EXPLAIN 确认：

- `type` 从 `index` → `range` ✅
- `rows` 从 245 万 → ~27 万（减少约 89%） ✅
- `filtered` 从 11.11% → 100% ✅
- 数据库周期性负载尖峰消失 ✅
