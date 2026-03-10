# 服务拓扑图实现方案设计文档

## 一、背景与问题

服务拓扑图是 APM 系统的核心功能之一，用于展示服务之间的调用关系及关键指标（QPS、延迟、错误率）。构建拓扑图的核心挑战在于：**如何确定每个 Span 的对端服务标识（`peer.service`）**。

### 1.1 peer.service 的场景分类

| 场景 | SpanKind | 对端标识来源 | 是否需要配对 |
|------|----------|-------------|-------------|
| Client → MQ | Client/Producer | `messaging.destination`、`net.peer.name` 等 MQ 地址属性 | ❌ 直接可得 |
| Client → DB | Client | `db.name`、`db.system`、`net.peer.name` 等 DB 地址属性 | ❌ 直接可得 |
| Client ↔ Server（HTTP/gRPC/Dubbo） | Client + Server | 需要对端的 `service.name` | ✅ 需要配对 |

### 1.2 远程调用场景的细分

远程调用（HTTP/gRPC/Dubbo 等）场景中，`peer.service` 的获取方式又可以细分：

| 子场景 | 说明 | 是否需要缓存配对 |
|--------|------|-----------------|
| 探针已传递服务标识 | 上游探针通过 Baggage 等机制将 `service.name` 传给下游，下游填入 Span 的 `peer.service` | ❌ 直接可得 |
| 两端都接入 APM，但无标识传递 | Client span 和 Server span 需要通过 `(trace_id, span_id)` 配对才能交叉获取对端 `service.name` | ✅ 需要配对 |
| 只有一端接入 APM | 无法配对，需要从 `net.peer.name`、`server.address` 等属性推断 | ⚠️ 尽力推断 |

### 1.3 核心结论

**只有"远程调用 + 无 peer.service"这一种情况才需要走缓存配对路径。** MQ、DB、已有 `peer.service` 的场景都可以立即处理。

---

## 二、现有 servicegraphconnector 分析

### 2.1 工作原理

OpenTelemetry Collector Contrib 中的 `servicegraphconnector` 是一个 Traces → Metrics 的 Connector，通过以下机制构建拓扑：

**配对 Key 构建规则**：
- Client/Producer span: `Key = (trace_id, span_id)` —— 用自身的 span_id
- Server/Consumer span: `Key = (trace_id, parent_span_id)` —— 用父级 span_id

由于 OTel trace 模型中，Client span 的 `span_id` 等于 Server span 的 `parent_span_id`，两者生成相同的 Key，在 Store 中命中同一条 Edge，实现配对。

**Edge 生命周期**：
```
Span 到达 → UpsertEdge(key, callback)
  ├── Edge 已存在 → 更新，检查 isComplete()
  │     ├── complete（ClientService && ServerService 都有）→ onComplete() → 聚合指标 → 从 Store 删除
  │     └── 未 complete → 继续等待
  └── Edge 不存在 → 创建新 Edge，TTL 倒计时
        └── TTL 过期 → onExpire()
              ├── 只有 Server（根 span）→ ClientService="user"，虚拟节点
              └── 只有 Client → ServerService=peer.service/"unknown"，虚拟节点
```

**输出指标**：
| 指标名 | 类型 | 说明 |
|--------|------|------|
| `traces_service_graph_request_total` | Sum(Cumulative) | 请求总数 |
| `traces_service_graph_request_failed_total` | Sum(Cumulative) | 失败请求数 |
| `traces_service_graph_request_server` | Histogram(Cumulative) | Server 侧延迟分布 |
| `traces_service_graph_request_client` | Histogram(Cumulative) | Client 侧延迟分布 |

### 2.2 精度缺陷

| 场景 | 精度问题 | 严重程度 |
|------|---------|---------|
| 非根 Server span 孤立（Client 未到） | Edge 过期后**静默丢弃**，不产生任何指标 | 🔴 严重 |
| 跨 Collector（Client/Server 到不同实例） | 无法配对，拆成两条虚拟边或丢弃 | 🔴 严重 |
| Store 溢出（`maxItems` 默认 1000） | 超出后直接丢弃新 Span，且未尝试淘汰过期 Edge | 🔴 严重 |
| TTL 不匹配 | 全局固定 TTL（默认 2s），慢请求配不上 | 🟡 中等 |
| 虚拟节点 Server 延迟 | 为 0（没有 Server span） | 🟡 中等 |
| 错误率 | 两端 OR 合并，无法区分谁出的错 | 🟢 轻微 |

---

## 三、方案设计

### 3.1 整体架构

```
                        peerfillprocessor（Processor, Traces → Traces）
                        ┌──────────────────────────────────────────────┐
Traces ─────────────────┤                                              │
                        │  快速路径（立即放行，不碰 Redis）：             │
                        │    ├── 已有 peer.service → 直接放行           │
                        │    ├── MQ 场景 → 从 messaging 属性填充，放行   │
                        │    ├── DB 场景 → 从 db 属性填充，放行          │
                        │    └── 根 Server Span（无 parent）→ 直接放行  │
                        │                                              │
                        │  慢路径（远程调用，无 peer.service，非根 Span）：│
                        │    → Redis 配对 + 200ms 二次查询              │
                        │    → 填充 peer.service                       │
                        │    → 放行增强后的 Traces                      │
                        └──────────────┬───────────────────────────────┘
                                       │
                          Traces（大部分 Span 已有 peer.service）
                                       │
                  ┌────────────────────┼────────────────────┐
                  ▼                    ▼                    ▼
        servicegraph（简化版）   spanmetricsconnector    exporter
        Traces → Metrics        Traces → Metrics      Traces → 存储
        无 Store / 无 TTL        dim: peer.service
        从 Span 直接读
```

**核心思想**：配对的复杂性由 `peerfillprocessor` + Redis 承担一次，后续所有消费者（servicegraph、spanmetrics、exporter）都受益于已填充的 `peer.service`，不再各自配对。

### 3.2 peerfillprocessor 设计

#### 3.2.1 处理流程

```
Span 到达 peerfillprocessor
  │
  ├── 1. 快速路径判断（立即放行，不碰 Redis）
  │     ├── span.Attributes["peer.service"] != "" → 直接放行
  │     ├── 有 db.system / db.name → 填充 peer.service = db地址，放行
  │     ├── 有 messaging.system → 填充 peer.service = MQ地址，放行
  │     └── Server 且 parent_span_id 为空（根 Span）→ 直接放行
  │         理由：根 Server Span 是请求入口（来自用户/网关），没有上游服务，
  │               不存在需要发现的 peer.service
  │         注意：不含 Consumer，Consumer 属于 MQ 场景，已在上面的 MQ 快速路径覆盖
  │
  └── 2. 慢路径（远程调用，无 peer.service，非根 Span）
        │
        ├── Step 1: Pipeline 批量查 Redis（对端到了吗？）
        │     ├── 命中 → 填充 peer.service，立即放行         [后到的 Span]
        │     └── 未命中 → Step 2
        │
        ├── Step 2: Pipeline 批量写 Redis（记录自己的 service.name）
        │
        └── Step 3: 放入延迟队列（200ms）
              │
              └── 200ms 后 Step 4: 再次批量查 Redis
                    ├── 命中 → 填充 peer.service，放行        [先到的 Span, ~85%]
                    └── 未命中 → 不填充，直接放行              [先到的 Span, ~15%]
```

#### 3.2.2 Redis 数据模型

```
Key:    peerfill:{trace_id}:{span_id}
Field:  "client" 或 "server"
Value:  "{service_name}"
TTL:    自适应（默认 10s）
```

使用 Redis Hash 结构，原子操作保证并发安全：

```lua
-- Lua 脚本：原子 upsert + 检测配对
local key = KEYS[1]
local field = ARGV[1]       -- "client" 或 "server"
local data = ARGV[2]        -- service_name
local ttl = tonumber(ARGV[3])
local peer_field = ARGV[4]  -- 对端 field（"server" 或 "client"）

-- 写入自己
redis.call('HSET', key, field, data)
redis.call('EXPIRE', key, ttl)

-- 查对端
local peer = redis.call('HGET', key, peer_field)
if peer then
    return peer  -- 配对成功，返回对端 service_name
end
return nil
```

#### 3.2.3 批量 Pipeline 处理

不逐条调 Redis，攒批发送以减少网络往返：

```go
type PeerFillProcessor struct {
    buffer        chan *spanEntry
    batchSize     int           // 批量大小，如 200
    flushInterval time.Duration // 刷新间隔，如 50ms
}

func (p *PeerFillProcessor) batchWorker() {
    batch := make([]*spanEntry, 0, p.batchSize)
    ticker := time.NewTicker(p.flushInterval)

    for {
        select {
        case entry := <-p.buffer:
            batch = append(batch, entry)
            if len(batch) >= p.batchSize {
                p.flushBatch(batch)
                batch = batch[:0]
            }
        case <-ticker.C:
            if len(batch) > 0 {
                p.flushBatch(batch)
                batch = batch[:0]
            }
        }
    }
}
```

#### 3.2.4 配置结构

```yaml
processors:
  peerfill:
    # 快速路径：直接从属性推断 peer.service
    direct_peer_attributes:
      - peer.service
      - messaging.destination
      - db.name
    # 慢路径：Redis 配对
    store:
      backend: redis
      endpoint: "redis://localhost:6379"
      ttl: 10s
      key_prefix: "peerfill:"
    # 二次查询延迟窗口
    delay_window: 200ms
    delay_queue_max_size: 100000
    # 批量配置
    batch_size: 200
    flush_interval: 50ms
    # 兜底属性
    fallback_attributes:
      - net.peer.name
      - server.address
      - network.peer.address
```

#### 3.2.5 降级策略

```go
func (p *PeerFillProcessor) flushBatch(batch []*spanEntry) {
    _, err := pipe.Exec(ctx)
    if err != nil {
        // Redis 不可用 → 全部直接放行，不填充 peer.service
        for _, entry := range batch {
            entry.release()
        }
        // 下游 servicegraph 的虚拟节点机制兜底
        return
    }
}

// 延迟队列溢出时
if delayQueue.Len() > maxDelayQueueSize {
    span.release()  // 直接放行，不等二次查询
}
```

### 3.3 简化版 servicegraph 设计

peerfill 填充完 `peer.service` 后，servicegraph **不再需要 Edge Store、TTL、配对逻辑**，退化为简单的 Span → Metrics 映射器。

#### 3.3.1 核心逻辑

```go
func (p *serviceGraphConnector) aggregateMetrics(span ptrace.Span, serviceName string) {
    peerService := span.Attributes().GetStr("peer.service")
    if peerService == "" {
        // peerfill 未覆盖，降级推断
        peerService = inferPeerFromAttributes(span)
        if peerService == "" {
            peerService = "unknown"
        }
    }

    connectionType := detectConnectionType(span)
    failed := span.Status().Code() == ptrace.StatusCodeError

    switch span.Kind() {
    case ptrace.SpanKindClient, ptrace.SpanKindProducer:
        // Client 视角: 我是 client，对端是 server
        metricKey := buildMetricKey(serviceName, peerService, connectionType)
        p.reqTotal[metricKey+"|client"]++
        if failed {
            p.reqFailedTotal[metricKey+"|client"]++
        }
        p.updateClientDurationMetrics(metricKey, spanDuration(span))

    case ptrace.SpanKindServer, ptrace.SpanKindConsumer:
        // Server 视角: 我是 server，对端是 client
        metricKey := buildMetricKey(peerService, serviceName, connectionType)
        p.reqTotal[metricKey+"|server"]++
        if failed {
            p.reqFailedTotal[metricKey+"|server"]++
        }
        p.updateServerDurationMetrics(metricKey, spanDuration(span))
    }
}
```

#### 3.3.2 与原版对比

| 特性 | 原版 servicegraph | 简化版 |
|------|------------------|--------|
| Edge Store | ✅ 链表 + map，内存缓存 | ❌ 不需要 |
| TTL 配对 | ✅ 全局固定 TTL | ❌ 不需要 |
| Expire 循环 | ✅ 每 2s 扫描 | ❌ 不需要 |
| 虚拟节点逻辑 | ✅ 复杂的 onExpire 处理 | ❌ 简单 fallback |
| maxItems 限制 | ✅ 超限丢弃 | ❌ 无此限制 |
| 代码复杂度 | ~800 行 | ~200 行（估算） |

#### 3.3.3 指标输出

输出的指标增加 `perspective` 维度，区分观察视角：

| 指标名 | 维度 | 说明 |
|--------|------|------|
| `traces_service_graph_request_total` | client, server, connection_type, failed, **perspective** | 请求总数 |
| `traces_service_graph_request_failed_total` | 同上 | 失败请求数 |
| `traces_service_graph_request_client` | 同上 | Client 侧延迟分布 |
| `traces_service_graph_request_server` | 同上 | Server 侧延迟分布 |

`perspective` 取值：
- `"client"` —— 来自 Client/Producer span
- `"server"` —— 来自 Server/Consumer span

### 3.4 去重与错误率统计

#### 3.4.1 为什么不在 Collector 层去重

同一次请求产生 Client + Server 两个 Span，两端各自出指标（带不同的 `perspective`），**不做合并**。原因：

1. **Collector 无状态**：不缓存任何 Span 数据，可随意扩缩容/重启
2. **信息不丢失**：两端的错误状态可能不同（Client OK 但 Server Error），分开记录更真实
3. **灵活性**：查询层可以按需选择视角

#### 3.4.2 查询层策略

**请求数（取 Client 视角为主，Server 兜底）**：
```promql
sum by (client, server) (
    traces_service_graph_request_total{perspective="client"}
)
or
sum by (client, server) (
    traces_service_graph_request_total{perspective="server"}
)
```

**错误率（两端独立展示，或取最大值）**：
```promql
# Client 错误率
sum by (client, server) (traces_service_graph_request_failed_total{perspective="client"})
/
sum by (client, server) (traces_service_graph_request_total{perspective="client"})

# Server 错误率
sum by (client, server) (traces_service_graph_request_failed_total{perspective="server"})
/
sum by (client, server) (traces_service_graph_request_total{perspective="server"})
```

**拓扑图 UI 展示建议**：
```
A ──────────► B
  QPS: 1000（Client 视角）
  Client Error: 0.5%
  Server Error: 1.2%   ← 更高，说明 Server 有内部错误未反馈给 Client
```

#### 3.4.3 错误状态四象限

| Client 状态 | Server 状态 | 含义 | 谁能发现 |
|------------|------------|------|---------|
| OK | OK | 正常 | 两端一致 |
| Error | Error | 请求失败 | 两端一致 |
| OK | Error | Server 内部错误，Client 未感知 | **只有 Server 视角能发现** |
| Error | OK | 网络超时等，Server 实际成功 | **只有 Client 视角能发现** |

分开记录两端的错误状态，可以发现"Client OK 但 Server Error"这类隐蔽问题。

---

## 四、精度分析

### 4.1 peer.service 覆盖率

| Span 类型 | 占比（估算） | peer.service 来源 | 覆盖率 |
|-----------|------------|-------------------|--------|
| MQ 相关 | ~10% | 快速路径：`messaging.destination` | ~100% |
| DB 相关 | ~30% | 快速路径：`db.name` / `db.system` | ~100% |
| 根 Server Span（请求入口） | ~5% | 快速路径：无需 peer.service，直接放行 | N/A |
| 远程调用（已有 peer.service） | ~18% | 快速路径：探针传递 | ~100% |
| 远程调用（后到 Redis 配对） | ~18% | 慢路径：Redis 命中 | ~95% |
| 远程调用（先到 + 200ms 二次查询） | ~16% | 慢路径：二次查询命中 | ~85% |
| 远程调用（先到 + 二次查询未命中） | ~3% | fallback：`net.peer.name` / "unknown" | 降级 |

**快速路径总占比约 ~63%**（MQ + DB + 根 Span + 已有 peer.service），这些完全不碰 Redis。

**总体 peer.service 覆盖率约 ~90%+**（含二次查询，排除根 Span）。

### 4.2 与原版 servicegraph 精度对比

| 精度维度 | 原版 servicegraph | 融合方案 |
|---------|------------------|---------|
| 单 Collector 完美配对 | ✅ 100% | ✅ 100% |
| 跨 Collector 配对 | ❌ 拆成虚拟边/丢失 | ✅ Redis 共享 |
| 非根 Server span 孤立 | ❌ 静默丢弃 | ✅ 有 peer.service 则正常出指标 |
| Store 溢出（高并发） | ❌ 超 1000 全丢 | ✅ 无 Store |
| Server 延迟 | ❌ 虚拟节点时为 0 | ✅ Server span 独立记录 |
| 错误率 | ⚠️ 两端 OR，无法区分 | ✅ 两端独立，可区分 |
| 请求计数 | ⚠️ 跨 Collector 可能重复/丢失 | ✅ perspective 维度区分 |
| 拓扑边发现 | ⚠️ 依赖配对或虚拟节点 | ✅ ~100% |

---

## 五、高并发与内存安全

### 5.1 100w QPS 场景分析

#### 流量分层

```
100w QPS 总 Span
  ├── MQ Span（快速路径）           ~10% = 10w  → 不碰 Redis
  ├── DB Span（快速路径）           ~30% = 30w  → 不碰 Redis
  ├── 根 Server Span（快速路径）     ~5% =  5w  → 不碰 Redis
  ├── 已有 peer.service（快速路径）  ~18% = 18w  → 不碰 Redis
  └── 远程调用无 peer.service       ~37% = 37w  → 进 Redis
      实际 Redis QPS               ~74w ops/s（读+写）
```

#### Redis 容量

```
80w ops/s → Pipeline batch=200 → 实际网络往返 4000 次/s → 每次 RTT ~1ms
Redis Cluster 4 分片 → 每分片 20w ops/s → 可行

存储：TTL=10s，峰值 400w key × ~200 bytes ≈ 800MB → 可控
```

#### Collector 端内存

```
延迟队列（200ms 窗口）：
  先到的 Span 暂存 200ms
  40w × 50%（先到的）× 200ms = 4w Span 同时暂存
  4w × ~2KB/Span ≈ 80MB → 可控
```

### 5.2 多级防护

| 层级 | 机制 | 说明 |
|------|------|------|
| **L1 入口** | 快速路径过滤 | ~60% 的 Span 不碰 Redis |
| **L2 批量** | Pipeline 批量操作 | 减少 Redis 网络往返 |
| **L3 限流** | 延迟队列容量上限 | 超出直接放行，不等二次查询 |
| **L4 降级** | Redis 不可用时 | 全部直接放行，servicegraph 虚拟节点兜底 |

### 5.3 分桶隔离（可选）

防止单个服务的压测流量挤占所有其他服务的配额：

```yaml
processors:
  peerfill:
    store:
      max_keys_per_service: 50000  # 每服务上限
```

---

## 六、外部存储选型

### 6.1 Redis（推荐）

| 维度 | 说明 |
|------|------|
| 适合场景 | 配对状态存储（Key-Value 查找） |
| 优势 | 天然 TTL、原子操作、低延迟、运维成熟 |
| 容量 | 单实例 10w~20w ops/s，Cluster 线性扩展 |
| 注意 | 需要 Pipeline 批量操作，避免逐条调用 |

### 6.2 Kafka（作为前置路由层，不直接做配对）

| 维度 | 说明 |
|------|------|
| 适合场景 | 按 trace_id hash 分区路由，保证同一 trace 到达同一消费者 |
| 优势 | 解耦 Collector 和配对逻辑，磁盘存储容量大 |
| 注意 | 不适合做 Key-Value 查询，配对仍需 Redis 或本地内存 |

### 6.3 组合方案

```
Collector → Kafka（按 trace_id 分区）→ 消费者 + Redis 配对
```

适合超大规模场景，Kafka 做流量路由，Redis 做配对存储。

---

## 七、探针侧优化（长期方案）

### 7.1 Baggage 传递 service.name

最干净的方案是在探针侧解决：

1. **上游探针**：发起请求时，通过 W3C Baggage Header 携带自己的 `service.name`
2. **下游探针**：收到后，将上游的 `service.name` 写入自己 Server Span 的 `peer.service`

实现方式：自定义 SpanProcessor 或 Propagator。

### 7.2 对 peerfillprocessor 的影响

随着探针覆盖率提升，走快速路径（已有 `peer.service`）的比例越来越高，Redis 压力持续降低。最终理想状态：

```
100% Span 走快速路径 → peerfillprocessor 退化为 pass-through → Redis 零负载
```

---

## 八、配置示例

### 完整 Pipeline 配置

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

processors:
  peerfill:
    direct_peer_attributes:
      - peer.service
      - messaging.destination
      - db.name
    store:
      backend: redis
      endpoint: "redis://redis-cluster:6379"
      ttl: 10s
      key_prefix: "peerfill:"
    delay_window: 200ms
    delay_queue_max_size: 100000
    batch_size: 200
    flush_interval: 50ms
    fallback_attributes:
      - net.peer.name
      - server.address

connectors:
  servicegraph:
    # 简化版：无需 store 配置
    dimensions:
      - http.method
      - rpc.method
    metrics_flush_interval: 60s

  spanmetrics:
    dimensions:
      - name: peer.service
      - name: http.method
      - name: rpc.method

exporters:
  prometheus:
    endpoint: 0.0.0.0:8889

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [peerfill]          # 先填充 peer.service
      exporters: [spanmetrics, servicegraph]  # 再转指标

    metrics:
      receivers: [servicegraph, spanmetrics]
      exporters: [prometheus]
```

---

## 九、方案总结

| 组件 | 职责 | 复杂度 | 状态 |
|------|------|--------|------|
| **peerfillprocessor** | Redis 配对 + 填充 peer.service | 中 | 新建 |
| **servicegraph（简化版）** | 从 Span 直接读 peer.service，两端各出指标（perspective 维度） | 低 | 改造 |
| **查询层** | 按 perspective 选择计数视角，避免重复 | 低 | 查询模板 |
| **探针侧 Baggage** | 长期方案，逐步减少 Redis 依赖 | 中 | 渐进推进 |

**核心设计原则**：
1. **配对只做一次**：peerfillprocessor 统一处理，下游所有消费者受益
2. **Collector 尽量无状态**：状态存 Redis，Collector 可随意扩缩容
3. **快速路径优先**：MQ/DB/已有 peer.service 直接放行，减少 Redis 压力
4. **优雅降级**：Redis 不可用 → 放行不填充 → 虚拟节点兜底 → 拓扑图不丢边
5. **精度交给查询层**：两端独立出指标，去重和合并在查询时按需处理
