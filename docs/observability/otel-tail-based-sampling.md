# OpenTelemetry 延迟采样（Tail-Based Sampling）方案设计

> 通过延迟采样策略，在控制链路存储成本的同时，完整保留错误链路和慢请求链路，为问题排查提供完整上下文。

## 背景与挑战

### 为什么需要采样？

在大规模分布式系统中，链路追踪数据量巨大。以一个日均 10 亿请求的系统为例：

| 指标 | 数值 |
|:---|:---|
| 日请求量 | 10 亿 |
| 平均 Span 数/Trace | 15 个 |
| 平均 Span 大小 | 500 bytes |
| **日存储量（无采样）** | **7.5 TB** |
| 1% 采样后存储量 | 75 GB |

不采样会带来：
- **存储成本爆炸**：每天数 TB 的存储开销
- **网络带宽压力**：大量数据传输影响业务
- **查询性能下降**：海量数据导致检索变慢

### 传统采样的痛点

#### Head-Based Sampling（头部采样）

在请求入口处决定是否采样，典型实现如 `TraceIdRatioBased`：

```
请求入口 → 根据 TraceId 决定采样 → 后续 Span 继承采样决策
```

**优点**：实现简单，资源消耗低  
**缺点**：无法感知请求结果，可能丢弃重要的错误/慢请求链路

#### 问题场景

```
用户投诉：订单支付失败

运维排查：
1. 查找该用户的 TraceId → 找到了
2. 查询链路详情 → "该链路未被采样，无数据"
3. 无法定位问题根因 → 😭
```

### 延迟采样的价值

**Tail-Based Sampling（延迟采样/尾部采样）** 在链路完成后再决定是否保留，可以：

- ✅ 100% 保留错误链路
- ✅ 100% 保留慢请求链路
- ✅ 按比例采样正常链路
- ✅ 支持基于业务属性的采样策略

---

## 方案设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              探针层 (Agent)                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                                      │
│  │ Service │  │ Service │  │ Service │   上报所有 Span 数据                  │
│  │    A    │  │    B    │  │    C    │   (不做采样决策)                      │
│  └────┬────┘  └────┬────┘  └────┬────┘                                      │
└───────┼───────────┼───────────┼─────────────────────────────────────────────┘
        │           │           │
        ▼           ▼           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Collector 层 (采样决策)                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Tail Sampling Processor                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │   │
│  │  │ 错误检测    │  │ 延迟检测    │  │ 比例采样    │                   │   │
│  │  │ error=true  │  │ latency>2s  │  │ ratio=1%    │                   │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                   │   │
│  │         │ 100%保留       │ 100%保留       │ 按比例                   │   │
│  │         └────────────────┴────────────────┘                          │   │
│  │                          │                                           │   │
│  │                          ▼                                           │   │
│  │              ┌─────────────────────┐                                 │   │
│  │              │   Bloom Filter      │  记录采样的 TraceId             │   │
│  │              │   (Redis)           │  按 appId:serviceName 分片      │   │
│  │              └─────────────────────┘                                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌────────────────────────┐    ┌────────────────────────┐                   │
│  │   Exporter 1 (实时)    │    │   Exporter 2 (延迟)    │                   │
│  │   所有 Span → Kafka    │    │   采样决策 → Kafka     │                   │
│  │   (realtime-topic)     │    │   (delayed-topic)      │                   │
│  └───────────┬────────────┘    └───────────┬────────────┘                   │
└──────────────┼─────────────────────────────┼────────────────────────────────┘
               │                             │
               ▼                             ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│   Kafka: realtime-topic  │    │   Kafka: delayed-topic   │
│   (所有原始 Span 数据)   │    │   (采样决策消息)         │
└───────────┬──────────────┘    └───────────┬──────────────┘
            │                               │
            ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│   Writer 1 (实时写入)    │    │   Writer 2 (延迟写入)    │
│   消费 → 写入实时存储    │    │   消费 → 查询 → 写入     │
└───────────┬──────────────┘    └───────────┬──────────────┘
            │                               │
            ▼                               │
┌──────────────────────────┐                │
│   实时存储 (Buffer)      │ ◄──────────────┘ 查询采样的 Span
│   TTL: 10-30 分钟        │
│   (Elasticsearch/ClickHouse)              │
└──────────────────────────┘                │
                                            ▼
                              ┌──────────────────────────┐
                              │   最终存储 (持久化)      │
                              │   TTL: 7-30 天           │
                              │   (Elasticsearch/ClickHouse)
                              └──────────────────────────┘
```

### 核心组件说明

#### 1. Collector 采样决策层

Collector 是整个方案的核心，负责：

**采样策略判断**：

| 策略 | 条件 | 采样率 | 说明 |
|:---|:---|:---|:---|
| 错误采样 | `status.code = ERROR` 或 `error = true` | 100% | 必须保留 |
| 慢请求采样 | `duration > threshold` | 100% | 阈值可配置 |
| 比例采样 | 正常请求 | 1%-10% | 按业务需求配置 |
| 属性采样 | 特定 `user_id` / `order_id` | 100% | 支持业务定制 |

**布隆过滤器管理**：

布隆过滤器的核心职责是**记录需要保留的 TraceId**，供 Writer2 查询时判断该 Trace 是否需要写入最终存储。

```go
// Redis Key 设计
// 格式: bloom:{appId}:{serviceName}:{时间窗口}
// 示例: bloom:order-service:payment-api:202401011200

type BloomFilterManager struct {
    redisClient *redis.Client
    windowSize  time.Duration  // 时间窗口，如 10 分钟
}

// MarkSampled 在 Collector 中标记需要采样的 TraceId
func (m *BloomFilterManager) MarkSampled(appId, serviceName, traceId string) error {
    key := m.buildKey(appId, serviceName)
    // 使用 Redis 的 BF.ADD 命令
    return m.redisClient.Do(ctx, "BF.ADD", key, traceId).Err()
}

// IsSampled 供 Writer2 查询判断该 Trace 是否需要保留
func (m *BloomFilterManager) IsSampled(appId, serviceName, traceId string) (bool, error) {
    key := m.buildKey(appId, serviceName)
    // 使用 Redis 的 BF.EXISTS 命令
    return m.redisClient.Do(ctx, "BF.EXISTS", key, traceId).Bool()
}

// BatchIsSampled 批量查询 TraceId 是否已被标记采样
// 使用 Redis Pipeline 减少网络往返，适用于 Writer2 批量处理场景
func (m *BloomFilterManager) BatchIsSampled(appId, serviceName string, traceIds []string) map[string]bool {
    if len(traceIds) == 0 {
        return make(map[string]bool)
    }
    
    key := m.buildKey(appId, serviceName)
    result := make(map[string]bool, len(traceIds))
    
    // 使用 Pipeline 批量查询，将 N 次网络往返减少为 1 次
    pipe := m.redisClient.Pipeline()
    cmds := make([]*redis.Cmd, len(traceIds))
    
    for i, traceId := range traceIds {
        cmds[i] = pipe.Do(ctx, "BF.EXISTS", key, traceId)
    }
    
    _, err := pipe.Exec(ctx)
    if err != nil && err != redis.Nil {
        // Pipeline 执行失败，返回空结果（保守策略：不采样）
        log.Warn("batch bloom filter query failed", "error", err)
        return result
    }
    
    // 解析结果
    for i, traceId := range traceIds {
        exists, err := cmds[i].Bool()
        if err == nil {
            result[traceId] = exists
        }
        // 查询失败的 TraceId 默认为 false（不采样）
    }
    
    return result
}
```

> **设计说明**：Collector 只负责写入（`MarkSampled`），Writer2 只负责查询（`IsSampled`）。这种职责分离使得 Collector 无需关心去重逻辑，保持流式处理的简洁性。

#### 2. 双 Kafka Topic 设计

**realtime-topic（实时 Topic）**：

```json
{
  "traceId": "abc123",
  "spanId": "span456",
  "parentSpanId": "span123",
  "operationName": "HTTP GET /api/orders",
  "serviceName": "order-service",
  "appId": "order-app",
  "startTime": 1704067200000,
  "duration": 150,
  "status": "OK",
  "attributes": {
    "http.method": "GET",
    "http.status_code": 200
  }
}
```

**delayed-topic（延迟 Topic）**：

```json
{
  "traceId": "abc123",
  "appId": "order-app",
  "serviceName": "order-service",
  "sampledAt": 1704067200000,
  "reason": "error",           // 采样原因: error/slow/ratio
  "spanCount": 15              // 该 Trace 的 Span 数量
}
```

#### 3. 双 Writer 架构

**Writer 1（实时写入）**：

```go
type RealtimeWriter struct {
    consumer    kafka.Consumer
    storage     Storage  // 实时存储（短 TTL）
    batchSize   int
    flushInterval time.Duration
}

func (w *RealtimeWriter) Run() {
    batch := make([]Span, 0, w.batchSize)
    ticker := time.NewTicker(w.flushInterval)
    
    for {
        select {
        case msg := <-w.consumer.Messages():
            span := parseSpan(msg)
            batch = append(batch, span)
            if len(batch) >= w.batchSize {
                w.storage.BatchWrite(batch)
                batch = batch[:0]
            }
        case <-ticker.C:
            if len(batch) > 0 {
                w.storage.BatchWrite(batch)
                batch = batch[:0]
            }
        }
    }
}
```

**Writer 2（延迟写入）**：

Writer2 负责消费采样决策消息，从实时存储查询 Span 数据，写入最终存储。需要处理**分布式去重**和**查询可靠性**问题。

```go
type DelayedWriter struct {
    consumer      kafka.Consumer
    realtimeStore Storage           // 实时存储（查询源）
    finalStore    Storage           // 最终存储（写入目标）
    bloomFilter   *BloomFilterManager
    deduper       *DistributedDeduper  // 分布式去重器
    config        DelayedWriterConfig
}

func (w *DelayedWriter) Run() {
    for msg := range w.consumer.Messages() {
        decision := parseSamplingDecision(msg)
        
        // 1. 分布式去重：确保同一 Trace 只处理一次
        if !w.deduper.TryAcquire(decision.TraceId) {
            continue  // 已被其他 Writer 实例处理
        }
        defer w.deduper.Release(decision.TraceId)
        
        // 2. 二次确认：通过布隆过滤器确认该 Trace 确实需要采样
        sampled, _ := w.bloomFilter.IsSampled(decision.AppId, decision.ServiceName, decision.TraceId)
        if !sampled {
            continue  // 布隆过滤器中不存在，可能是误发的消息
        }
        
        // 3. 带重试的查询：从实时存储获取 Span 数据
        spans, err := w.queryWithRetry(decision)
        if err != nil {
            log.Error("query spans failed after retries", "traceId", decision.TraceId, "error", err)
            w.sendToDeadLetter(decision, err)  // 写入死信队列
            continue
        }
        
        // 4. 完整性检查
        if len(spans) == 0 {
            log.Warn("no spans found for sampled trace", "traceId", decision.TraceId)
            w.metrics.IncSpanLoss(decision.AppId, decision.ServiceName)
            continue
        }
        
        // 5. 写入最终存储
        if err := w.finalStore.BatchWrite(spans); err != nil {
            log.Error("write to final storage failed", "error", err)
            w.sendToDeadLetter(decision, err)
        }
    }
}
```

---

## 关键设计细节

### 1. 布隆过滤器参数设计

布隆过滤器需要在**误判率**和**内存占用**之间权衡：

| 参数 | 推荐值 | 说明 |
|:---|:---|:---|
| 预期元素数量 | 100 万/窗口 | 根据 QPS 和时间窗口计算 |
| 误判率 | 0.1% (0.001) | 误判只会导致少量**未标记**的 TraceId 被**误判为已标记**，即多保留一些正常链路，不会丢失数据 |
| 时间窗口 | 10 分钟 | 与实时存储 TTL 配合 |
| 内存占用 | ~1.8 MB/过滤器 | 100 万元素 + 0.1% 误判率 |

**容量规划公式**：

```
# 布隆过滤器预期元素数量计算
expected_elements = QPS × 时间窗口(秒) × 采样率

# 示例：10000 QPS，10 分钟窗口，5% 采样率
expected_elements = 10000 × 600 × 0.05 = 300,000

# 布隆过滤器内存计算（bits）
# 公式：m = -n × ln(p) / (ln(2))²
# n = 元素数量，p = 误判率
memory_bits = -300000 × ln(0.001) / (ln(2))² ≈ 4.3M bits ≈ 0.54 MB

# 实时存储容量计算
buffer_storage = QPS × 平均Span大小 × TTL(秒)
buffer_storage = 10000 × 500B × 1800s = 9 GB

# Kafka Topic 容量计算（单 Topic 方案）
kafka_storage = QPS × 平均Span大小 × 保留时间(秒) × 副本数
kafka_storage = 10000 × 500B × 7200s × 3 = 108 GB
```

```bash
# Redis Bloom Filter 创建命令
BF.RESERVE bloom:order-service:payment-api:202401011200 0.001 1000000
```

**时间窗口 Key 设计**：

布隆过滤器的 key 包含时间窗口，Collector 写入和 Writer2 查询必须使用一致的时间窗口计算逻辑：

```go
// buildKey 构建布隆过滤器的 Redis Key
// 时间窗口按 10 分钟对齐，确保 Collector 和 Writer2 使用相同的 key
func (m *BloomFilterManager) buildKey(appId, serviceName string) string {
    // 按时间窗口对齐（向下取整到 10 分钟边界）
    windowStart := time.Now().Truncate(m.windowSize)
    return fmt.Sprintf("bloom:%s:%s:%s", appId, serviceName, windowStart.Format("200601021504"))
}

// buildKeyForTime 根据指定时间构建 key（用于查询历史窗口）
func (m *BloomFilterManager) buildKeyForTime(appId, serviceName string, t time.Time) string {
    windowStart := t.Truncate(m.windowSize)
    return fmt.Sprintf("bloom:%s:%s:%s", appId, serviceName, windowStart.Format("200601021504"))
}

// IsSampledWithFallback 查询时同时检查当前窗口和前一个窗口
// 避免因窗口切换导致的漏查（Collector 写入窗口 N，Writer2 查询时已切换到窗口 N+1）
func (m *BloomFilterManager) IsSampledWithFallback(appId, serviceName, traceId string) (bool, error) {
    now := time.Now()
    
    // 查询当前窗口
    currentKey := m.buildKeyForTime(appId, serviceName, now)
    exists, err := m.redisClient.Do(ctx, "BF.EXISTS", currentKey, traceId).Bool()
    if err == nil && exists {
        return true, nil
    }
    
    // 查询前一个窗口（处理窗口边界问题）
    prevKey := m.buildKeyForTime(appId, serviceName, now.Add(-m.windowSize))
    return m.redisClient.Do(ctx, "BF.EXISTS", prevKey, traceId).Bool()
}
```

> **注意**：单 Topic 方案中，Writer2 延迟消费 30-60 秒，需要确保布隆过滤器的时间窗口（10 分钟）能覆盖这个延迟。如果延迟超过时间窗口，需要查询多个窗口或增大窗口大小。

### 2. 时间窗口与 TTL 设计

```
时间线：
├─────────────────────────────────────────────────────────────────►
│
│  T0: Span 产生
│  │
│  T0+1s: Collector 接收，流式判断采样条件
│         - 写入 realtime-topic（所有 Span）
│         - 若触发采样，写入布隆过滤器 + delayed-topic
│  │
│  T0+2s: Writer1 消费，写入实时存储
│  │
│  T0+10s: Writer2 消费延迟消息（可配置延迟）
│  │
│  T0+12s: Writer2 从实时存储查询该 Trace 的所有 Span
│  │
│  T0+13s: Writer2 写入最终存储
│  │
│  T0+30min: 实时存储 TTL 过期，数据删除
│
│  推荐配置：
│  - delayed-topic 消费延迟: 10-30 秒（确保同一 Trace 的所有 Span 都已写入实时存储）
│  - 实时存储 TTL: 20-30 分钟（留足够余量）
```

### 3. 流式采样决策

**设计理念**：Collector 采用**流式处理**，逐个 Span 进行采样判断，无需聚合完整 Trace。

**核心逻辑**：

```go
type StreamingSampler struct {
    bloomFilter   *BloomFilterManager
    kafkaProducer kafka.Producer
    config        SamplingConfig
}

// ProcessSpan 流式处理每个 Span
func (s *StreamingSampler) ProcessSpan(span Span) {
    traceId := span.TraceId
    appId := span.Attributes["appId"]
    serviceName := span.Attributes["serviceName"]
    
    // 判断当前 Span 是否触发采样条件
    sampled, reason := s.shouldSample(span)
    
    if sampled {
        // 1. 标记到布隆过滤器（供 Writer2 查询）
        s.bloomFilter.MarkSampled(appId, serviceName, traceId)
        // 2. 发送采样决策到 delayed-topic
        s.sendSamplingDecision(traceId, appId, serviceName, reason)
    }
}

func (s *StreamingSampler) shouldSample(span Span) (bool, string) {
    // 策略1: 错误 Span 必采
    if span.Status == "ERROR" || span.Attributes["error"] == "true" {
        return true, "error"
    }
    
    // 策略2: 慢请求必采（单个 Span 耗时超阈值）
    if span.Duration > s.config.SlowThreshold {
        return true, "slow"
    }
    
    // 策略3: 比例采样（基于 TraceId 哈希，保证同一 Trace 决策一致）
    if s.ratioSample(span.TraceId) {
        return true, "ratio"
    }
    
    return false, ""
}

// ratioSample 基于 TraceId 的确定性采样
func (s *StreamingSampler) ratioSample(traceId string) bool {
    // 使用 TraceId 哈希确保同一 Trace 的所有 Span 决策一致
    hash := fnv.New32a()
    hash.Write([]byte(traceId))
    return hash.Sum32()%10000 < uint32(s.config.SampleRate*10000)
}
```

**流式处理的优势**：

| 特性 | 说明 |
|:---|:---|
| **低内存占用** | 无需缓存完整 Trace，逐条处理 |
| **低延迟** | Span 到达即处理，无需等待窗口 |
| **高吞吐** | 无状态处理，易于水平扩展 |
| **实时响应** | 错误 Span 立即触发采样决策 |

**注意事项**：

- 同一个 Trace 可能有多个 Span 触发采样，会产生重复的采样决策消息
- 布隆过滤器的写入是幂等的，重复写入不影响结果
- Writer2 端通过分布式去重保证每个 Trace 只处理一次

### 4. Writer2 分布式去重

在多 Writer2 实例部署场景下，同一个 Trace 的采样决策消息可能被多个实例消费（如 Kafka 重平衡、消息重复等），需要分布式去重。

**基于 Redis 的分布式锁方案**：

```go
type DistributedDeduper struct {
    redisClient *redis.Client
    lockTTL     time.Duration  // 锁超时时间，如 5 分钟
    keyPrefix   string
}

// TryAcquire 尝试获取处理权，返回 true 表示获取成功
func (d *DistributedDeduper) TryAcquire(traceId string) bool {
    key := fmt.Sprintf("%s:dedup:%s", d.keyPrefix, traceId)
    
    // 使用 SETNX 实现分布式锁
    ok, err := d.redisClient.SetNX(ctx, key, "1", d.lockTTL).Result()
    if err != nil {
        log.Warn("dedup acquire failed", "error", err)
        return true  // Redis 故障时降级为允许处理（可能重复，但不丢数据）
    }
    return ok
}

// Release 释放处理权（可选，依赖 TTL 自动过期）
func (d *DistributedDeduper) Release(traceId string) {
    // 通常不需要主动释放，依赖 TTL 过期即可
    // 如果需要快速释放，可以调用 DEL
}
```

**基于 Kafka 消费者组的天然去重**：

```yaml
# 更简单的方案：利用 Kafka 分区 + 消费者组
kafka:
  delayed-topic:
    partitions: 32
    partition_key: traceId  # 同一 TraceId 的消息落到同一分区
    
# 每个分区只被一个 Writer2 实例消费，天然去重
# 但需要处理消费者重平衡时的重复消费问题
```

**混合方案（推荐）**：

```go
func (w *DelayedWriter) Run() {
    for msg := range w.consumer.Messages() {
        decision := parseSamplingDecision(msg)
        
        // 1. 先用本地缓存快速去重（处理短时间内的重复消息）
        if w.localCache.Contains(decision.TraceId) {
            continue
        }
        w.localCache.Add(decision.TraceId)
        
        // 2. 再用 Redis 分布式去重（处理跨实例的重复）
        if !w.deduper.TryAcquire(decision.TraceId) {
            continue
        }
        
        // ... 后续处理
    }
}
```

### 5. 实时存储查询可靠性

Writer2 从实时存储查询 Span 时，可能遇到以下问题：

| 问题 | 原因 | 影响 |
|:---|:---|:---|
| 部分 Span 未写入 | Writer1 处理延迟、网络抖动 | 查询到不完整的 Trace |
| Span 已过期 | 实时存储 TTL 过短、Writer2 积压 | 查询不到数据 |
| 查询超时 | 实时存储负载高 | 处理失败 |

**带重试和退避的查询策略**：

```go
type RetryConfig struct {
    MaxRetries     int           // 最大重试次数
    InitialDelay   time.Duration // 初始延迟
    MaxDelay       time.Duration // 最大延迟
    BackoffFactor  float64       // 退避因子
}

func (w *DelayedWriter) queryWithRetry(decision SamplingDecision) ([]Span, error) {
    var spans []Span
    var lastErr error
    
    delay := w.config.Retry.InitialDelay
    
    for i := 0; i <= w.config.Retry.MaxRetries; i++ {
        if i > 0 {
            time.Sleep(delay)
            // 指数退避
            delay = time.Duration(float64(delay) * w.config.Retry.BackoffFactor)
            if delay > w.config.Retry.MaxDelay {
                delay = w.config.Retry.MaxDelay
            }
        }
        
        spans, lastErr = w.realtimeStore.QueryByTrace(
            decision.AppId,
            decision.ServiceName,
            decision.TraceId,
        )
        
        if lastErr == nil && len(spans) > 0 {
            return spans, nil
        }
        
        log.Debug("query retry", 
            "attempt", i+1, 
            "traceId", decision.TraceId,
            "spanCount", len(spans),
            "error", lastErr)
    }
    
    return spans, fmt.Errorf("query failed after %d retries: %w", 
        w.config.Retry.MaxRetries, lastErr)
}
```

**配置建议**：

```yaml
delayed_writer:
  retry:
    max_retries: 3
    initial_delay: 2s      # 首次重试等待 2 秒
    max_delay: 10s         # 最大等待 10 秒
    backoff_factor: 2.0    # 每次翻倍
    
  # 重试时间线示例：
  # 第 1 次查询：T+0s
  # 第 2 次重试：T+2s  (等待 2s)
  # 第 3 次重试：T+6s  (等待 4s)
  # 第 4 次重试：T+16s (等待 10s，达到上限)
```

**死信队列处理**：

```go
// 多次重试失败后，写入死信队列，避免阻塞正常处理
func (w *DelayedWriter) sendToDeadLetter(decision SamplingDecision, err error) {
    dlqMsg := DeadLetterMessage{
        Decision:   decision,
        Error:      err.Error(),
        FailedAt:   time.Now(),
        RetryCount: w.config.Retry.MaxRetries,
    }
    
    if err := w.dlqProducer.Send(dlqMsg); err != nil {
        log.Error("send to dead letter queue failed", "error", err)
        // 记录指标，便于告警
        w.metrics.IncDeadLetterFailed()
    }
}

// 定期处理死信队列（可以是独立的服务或定时任务）
func (w *DelayedWriter) processDeadLetterQueue() {
    for msg := range w.dlqConsumer.Messages() {
        dlqMsg := parseDeadLetterMessage(msg)
        
        // 检查是否已超过最终重试时间（如 1 小时）
        if time.Since(dlqMsg.FailedAt) > time.Hour {
            log.Warn("dead letter message expired", "traceId", dlqMsg.Decision.TraceId)
            w.metrics.IncSpanLoss(dlqMsg.Decision.AppId, dlqMsg.Decision.ServiceName)
            continue
        }
        
        // 重新尝试查询和写入
        spans, err := w.queryWithRetry(dlqMsg.Decision)
        if err != nil {
            // 重新放回死信队列，等待下次处理
            w.sendToDeadLetter(dlqMsg.Decision, err)
            continue
        }
        
        w.finalStore.BatchWrite(spans)
    }
}
```

### 6. Span 丢失的监控与告警

由于网络、存储等问题，部分 Span 可能会丢失。需要建立完善的监控体系：

```yaml
# 新增监控指标
metrics:
  # Span 丢失相关
  - name: writer_span_loss_total
    type: counter
    labels: [app_id, service_name, reason]  # reason: query_failed/empty_result/ttl_expired
    
  - name: writer_dead_letter_total
    type: counter
    labels: [app_id, service_name]
    
  - name: writer_query_retry_total
    type: counter
    labels: [app_id, service_name, attempt]

# 告警规则
groups:
  - name: span-loss-alerts
    rules:
      - alert: SpanLossRateHigh
        expr: |
          sum(rate(writer_span_loss_total[5m])) 
          / sum(rate(collector_sampling_decisions_total[5m])) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Span 丢失率超过 1%，请检查实时存储和 Writer 状态"
          
      - alert: DeadLetterQueueBacklog
        expr: writer_dead_letter_queue_size > 10000
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "死信队列积压过多，可能存在系统性问题"
```

### 7. 分布式 Collector 的一致性

当部署多个 Collector 实例时，同一个 Trace 的 Span 可能分散到不同实例：

```
Service A (span1) ──► Collector 1
Service B (span2) ──► Collector 2  ← 同一个 TraceId
Service C (span3) ──► Collector 1
```

**解决方案**：基于 TraceId 的一致性路由

```yaml
# 方案1: 使用负载均衡器的一致性哈希
# Nginx 配置
upstream collectors {
    hash $http_x_trace_id consistent;
    server collector-1:4317;
    server collector-2:4317;
    server collector-3:4317;
}

# 方案2: 使用 Kafka 分区
# 探针直接写入 Kafka，按 TraceId 分区
# Collector 消费特定分区
```

---

## 存储设计

### 实时存储（Buffer Storage）

**特点**：
- 高写入吞吐
- 短 TTL（10-30 分钟）
- 支持按 TraceId 快速查询

**推荐方案**：

| 存储 | 优点 | 缺点 |
|:---|:---|:---|
| Elasticsearch | 查询灵活，生态成熟 | 资源消耗较大 |
| ClickHouse | 写入性能极高 | 实时查询延迟稍高 |
| Redis (TimeSeries) | 超低延迟 | 内存成本高 |

**Elasticsearch 索引设计**：

```json
{
  "settings": {
    "number_of_shards": 6,
    "number_of_replicas": 1,
    "index.lifecycle.name": "traces-buffer-policy",
    "refresh_interval": "1s"
  },
  "mappings": {
    "properties": {
      "traceId": { "type": "keyword" },
      "spanId": { "type": "keyword" },
      "appId": { "type": "keyword" },
      "serviceName": { "type": "keyword" },
      "operationName": { "type": "keyword" },
      "startTime": { "type": "date", "format": "epoch_millis" },
      "duration": { "type": "long" },
      "status": { "type": "keyword" },
      "attributes": { "type": "object", "enabled": false }
    }
  }
}
```

**ILM 策略**：

```json
{
  "policy": {
    "phases": {
      "hot": {
        "actions": {
          "rollover": {
            "max_age": "10m",
            "max_size": "10gb"
          }
        }
      },
      "delete": {
        "min_age": "30m",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

### 最终存储（Persistent Storage）

**特点**：
- 长期保留（7-30 天）
- 支持复杂查询和分析
- 成本优化

**推荐方案**：与实时存储相同技术栈，但使用不同的索引/表和 TTL 策略。

---

## 监控与运维

### 关键监控指标

```yaml
# Prometheus 指标示例
metrics:
  # Collector 层
  - name: collector_spans_received_total
    type: counter
    labels: [app_id, service_name]
    
  - name: collector_sampling_decisions_total
    type: counter
    labels: [app_id, service_name, reason]  # reason: error/slow/ratio/dropped
    
  - name: collector_bloom_filter_operations_total
    type: counter
    labels: [operation]  # add
    
  # Writer1 层
  - name: writer1_spans_written_total
    type: counter
    labels: [app_id, service_name]
    
  - name: writer1_write_latency_seconds
    type: histogram
    
  # Writer2 层
  - name: writer2_traces_processed_total
    type: counter
    labels: [app_id, service_name, result]  # result: success/failed/deduplicated
    
  - name: writer2_query_latency_seconds
    type: histogram
    labels: [app_id, service_name]
    
  - name: writer2_query_retry_total
    type: counter
    labels: [app_id, service_name, attempt]  # attempt: 1/2/3
    
  - name: writer2_span_loss_total
    type: counter
    labels: [app_id, service_name, reason]  # reason: query_failed/empty_result/ttl_expired
    
  - name: writer2_dead_letter_total
    type: counter
    labels: [app_id, service_name]
    
  - name: writer2_dedup_hit_total
    type: counter
    labels: [source]  # source: local_cache/redis
    
  - name: writer2_lag_seconds
    type: gauge
    labels: [partition]
```

### 告警规则

```yaml
groups:
  - name: tail-sampling-alerts
    rules:
      # 采样率异常
      - alert: SamplingRateTooHigh
        expr: |
          sum(rate(collector_sampling_decisions_total{reason="ratio"}[5m])) 
          / sum(rate(collector_spans_received_total[5m])) > 0.15
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "采样率超过预期阈值 (当前: {{ $value | humanizePercentage }})"
          
      # Span 丢失率过高
      - alert: SpanLossRateHigh
        expr: |
          sum(rate(writer2_span_loss_total[5m])) 
          / sum(rate(collector_sampling_decisions_total[5m])) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Span 丢失率超过 1%，请检查实时存储和 Writer2 状态"
          
      # 死信队列积压
      - alert: DeadLetterQueueBacklog
        expr: writer2_dead_letter_queue_size > 10000
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "死信队列积压 {{ $value }} 条，可能存在系统性问题"
          
      # Writer2 消费延迟过高
      - alert: Writer2LagTooHigh
        expr: max(writer2_lag_seconds) > 300
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Writer2 消费延迟超过 5 分钟，可能导致数据丢失"
          
      # 查询重试率过高
      - alert: QueryRetryRateHigh
        expr: |
          sum(rate(writer2_query_retry_total{attempt="3"}[5m])) 
          / sum(rate(writer2_traces_processed_total[5m])) > 0.05
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "查询重试率过高，实时存储可能存在性能问题"
```

### Trace 完整性监控

Trace 完整性是尾部采样方案的核心质量指标，需要量化监控：

**完整性定义**：

```
Trace 完整性 = 实际采样的 Span 数 / 预期采样的 Span 数

预期采样的 Span 数 = Collector 标记采样的 TraceId 对应的所有 Span 数
实际采样的 Span 数 = Writer2 成功写入最终存储的 Span 数
```

**监控指标**：

```yaml
metrics:
  # Trace 完整性相关
  - name: trace_expected_spans_total
    type: counter
    labels: [app_id, service_name]
    description: "Collector 标记采样的 Trace 预期 Span 数（从 Kafka 消息中统计）"
    
  - name: trace_actual_spans_total
    type: counter
    labels: [app_id, service_name]
    description: "Writer2 实际写入的 Span 数"
    
  - name: trace_completeness_ratio
    type: gauge
    labels: [app_id, service_name]
    description: "Trace 完整性比率，1.0 表示完全完整"
    
  - name: trace_incomplete_total
    type: counter
    labels: [app_id, service_name, reason]
    description: "不完整 Trace 数量，reason: partial/missing/expired"
```

**告警规则**：

```yaml
groups:
  - name: trace-completeness-alerts
    rules:
      # Trace 完整性低于阈值
      - alert: TraceCompletenessLow
        expr: |
          (
            sum(rate(trace_actual_spans_total[5m])) by (app_id, service_name)
            / sum(rate(trace_expected_spans_total[5m])) by (app_id, service_name)
          ) < 0.95
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Trace 完整性低于 95%，app={{ $labels.app_id }}"
          
      # 不完整 Trace 数量过多
      - alert: IncompleteTracesHigh
        expr: |
          sum(rate(trace_incomplete_total[5m])) by (app_id, service_name) > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "不完整 Trace 数量过多，请检查数据流"
```

**完整性检测实现**：

由于从最终存储抽样的 TraceId 在实时存储中大概率已过期，推荐采用**实时流式对比**方案：

```go
// TraceCompletenessChecker 实时流式完整性检测
type TraceCompletenessChecker struct {
    // 使用滑动窗口记录预期和实际 Span 数
    expectedSpans sync.Map  // traceId -> expectedCount (从 Collector 采样决策消息获取)
    actualSpans   sync.Map  // traceId -> actualCount (从 Writer2 写入结果获取)
    
    metrics       *Metrics
    windowSize    time.Duration  // 检测窗口，如 5 分钟
    cleanupTicker *time.Ticker
}

// RecordExpected 由 Collector 或 delayed-topic 消费者调用
// 当产生采样决策时，记录预期的 Span 数量
func (c *TraceCompletenessChecker) RecordExpected(traceId string, spanCount int) {
    c.expectedSpans.Store(traceId, &traceExpectation{
        count:     spanCount,
        createdAt: time.Now(),
    })
    c.metrics.AddExpectedSpans(spanCount)
}

// RecordActual 由 Writer2 调用
// 当成功写入 Span 时，累加实际数量
func (c *TraceCompletenessChecker) RecordActual(traceId string, spanCount int) {
    c.actualSpans.Store(traceId, &traceActual{
        count:     spanCount,
        createdAt: time.Now(),
    })
    c.metrics.AddActualSpans(spanCount)
}

// Run 定期检测完整性并清理过期数据
func (c *TraceCompletenessChecker) Run(ctx context.Context) {
    checkTicker := time.NewTicker(30 * time.Second)
    cleanupTicker := time.NewTicker(c.windowSize)
    defer checkTicker.Stop()
    defer cleanupTicker.Stop()
    
    for {
        select {
        case <-ctx.Done():
            return
            
        case <-checkTicker.C:
            c.checkCompleteness()
            
        case <-cleanupTicker.C:
            c.cleanup()
        }
    }
}

func (c *TraceCompletenessChecker) checkCompleteness() {
    now := time.Now()
    checkThreshold := now.Add(-2 * time.Minute)  // 只检查 2 分钟前的数据，给 Writer2 足够时间处理
    
    c.expectedSpans.Range(func(key, value interface{}) bool {
        traceId := key.(string)
        expected := value.(*traceExpectation)
        
        // 跳过太新的数据
        if expected.createdAt.After(checkThreshold) {
            return true
        }
        
        // 查找实际写入数量
        actualVal, ok := c.actualSpans.Load(traceId)
        if !ok {
            // 完全没有写入，标记为 missing
            c.metrics.IncIncompleteTrace("missing")
            log.Warn("trace missing", "traceId", traceId, "expected", expected.count)
            return true
        }
        
        actual := actualVal.(*traceActual)
        completeness := float64(actual.count) / float64(expected.count)
        
        if completeness < 1.0 {
            c.metrics.IncIncompleteTrace("partial")
            log.Warn("trace incomplete",
                "traceId", traceId,
                "expected", expected.count,
                "actual", actual.count,
                "completeness", completeness)
        }
        
        c.metrics.SetTraceCompleteness(traceId, completeness)
        return true
    })
}

func (c *TraceCompletenessChecker) cleanup() {
    expireTime := time.Now().Add(-c.windowSize)
    
    c.expectedSpans.Range(func(key, value interface{}) bool {
        if value.(*traceExpectation).createdAt.Before(expireTime) {
            c.expectedSpans.Delete(key)
        }
        return true
    })
    
    c.actualSpans.Range(func(key, value interface{}) bool {
        if value.(*traceActual).createdAt.Before(expireTime) {
            c.actualSpans.Delete(key)
        }
        return true
    })
}

type traceExpectation struct {
    count     int
    createdAt time.Time
}

type traceActual struct {
    count     int
    createdAt time.Time
}
```

> **注意**：完整性检测依赖 `spanCount` 字段，有以下几种获取方式：
> 1. **流式计数**（推荐）：Writer2 在处理时，按 TraceId 聚合计数，作为 `expected`；写入成功后计数作为 `actual`
> 2. **Root Span 携带**：在 Root Span 的 Attributes 中携带预估的 Span 数量（需要 SDK 支持）
> 3. **统计估算**：基于历史数据统计每个服务的平均 Span 数，作为参考值
>
> 由于 Tail-Based Sampling 是流式处理，Collector 无法预知完整 Trace 的 Span 数量，推荐使用方式 1。

---

## 容错与降级

### 故障场景处理

| 故障场景 | 影响 | 处理策略 |
|:---|:---|:---|
| Redis 不可用 | 布隆过滤器失效 | Collector 降级为全量发送采样决策；Writer2 降级为全量写入 |
| 实时存储写入失败 | Span 数据丢失 | Writer1 写入本地磁盘缓冲，恢复后重放 |
| 实时存储查询失败 | 无法获取 Span | Writer2 重试 + 死信队列 + 人工介入 |
| 延迟 Topic 积压 | 查询时数据已过期 | 增加实时存储 TTL，扩容 Writer2，告警通知 |
| Collector 宕机 | 部分 Span 未处理 | 依赖 Kafka 消费位点，重启后继续消费 |
| Writer2 宕机 | 采样决策未处理 | Kafka 消费者组自动重平衡，其他实例接管 |
| **Writer1 宕机恢复** | **时序错位，Writer2 查不到数据** | **Lag 感知延迟 / 进度同步 / 死信队列延迟重试** |

### 数据丢失风险点

```
┌─────────────────────────────────────────────────────────────────────┐
│                        数据流与丢失风险点                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Agent ──①──► Collector ──②──► Kafka ──③──► Writer1 ──④──► 实时存储 │
│                   │                                         │       │
│                   └──②──► Kafka ──③──► Writer2 ──⑤──────────┘       │
│                                           │                         │
│                                           └──⑥──► 最终存储          │
│                                                                     │
│  风险点说明：                                                        │
│  ① Agent 上报失败：网络问题、Agent 崩溃                              │
│  ② Collector 处理失败：OOM、处理逻辑异常                             │
│  ③ Kafka 写入/消费失败：Kafka 集群故障、分区不可用                    │
│  ④ Writer1 写入失败：实时存储不可用、写入超时                         │
│  ⑤ Writer2 查询失败：实时存储查询超时、数据已过期（最高风险）          │
│  ⑥ Writer2 写入失败：最终存储不可用                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**风险点 ⑤ 是最需要关注的**，因为：
- 实时存储有 TTL，数据会过期
- Writer2 积压会导致查询时数据已不存在
- 一旦丢失无法恢复

### Writer1 宕机恢复场景

当 Writer1 宕机后恢复，会出现**时序错位**问题：

```
时间线：
T0:     Writer1 宕机，停止消费 realtime-topic
T0+10s: Writer2 正常消费 delayed-topic，查询实时存储 → 查不到数据
T0+30s: Writer1 恢复，开始消费积压的 Kafka 消息
T0+35s: Writer1 将 T0 时刻的 Span 写入实时存储
        但 Writer2 已处理过该 TraceId（放入死信队列或标记丢失）
```

**核心问题**：Writer2 消费速度 > Writer1 恢复后的写入速度，导致查询时数据还未写入。

**解决方案：基于 Kafka Lag 的动态延迟调整**

```go
type LagAwareDelayedWriter struct {
    *DelayedWriter
    kafkaAdmin     kafka.AdminClient
    lagThreshold   int64         // Lag 阈值，超过则增加延迟
    baseDelay      time.Duration // 基础消费延迟
    maxDelay       time.Duration // 最大消费延迟
}

// 监控 Writer1 的消费 Lag
func (w *LagAwareDelayedWriter) getWriter1Lag() (int64, error) {
    // 获取 realtime-topic 的消费者组 Lag
    lag, err := w.kafkaAdmin.GetConsumerGroupLag("writer1-group", "realtime-topic")
    return lag, err
}

// 动态调整消费延迟
func (w *LagAwareDelayedWriter) Run() {
    for msg := range w.consumer.Messages() {
        decision := parseSamplingDecision(msg)
        
        // 1. 检查 Writer1 的 Lag 情况
        lag, err := w.getWriter1Lag()
        if err == nil && lag > w.lagThreshold {
            // Writer1 有积压，说明可能刚恢复或处理较慢
            // 动态增加延迟，等待 Writer1 追上
            dynamicDelay := w.calculateDynamicDelay(lag)
            log.Info("writer1 lag detected, adding delay", 
                "lag", lag, 
                "delay", dynamicDelay)
            time.Sleep(dynamicDelay)
        }
        
        // 2. 正常处理流程
        w.processDecision(decision)
    }
}

func (w *LagAwareDelayedWriter) calculateDynamicDelay(lag int64) time.Duration {
    // 根据 Lag 量计算延迟：Lag 越大，延迟越长
    // 假设 Writer1 处理速度为 10000 条/秒
    estimatedCatchUpTime := time.Duration(lag/10000) * time.Second
    
    delay := w.baseDelay + estimatedCatchUpTime
    if delay > w.maxDelay {
        delay = w.maxDelay
    }
    return delay
}
```

**方案二：死信队列延迟重试**

利用死信队列的延迟重试机制，在 Writer1 恢复后自动重新处理：

```go
type SmartDeadLetterProcessor struct {
    dlqConsumer   kafka.Consumer
    realtimeStore Storage
    finalStore    Storage
    kafkaAdmin    kafka.AdminClient
}

func (p *SmartDeadLetterProcessor) Run() {
    for msg := range p.dlqConsumer.Messages() {
        dlqMsg := parseDeadLetterMessage(msg)
        
        // 1. 检查 Writer1 是否已追上（Lag 接近 0）
        lag, _ := p.kafkaAdmin.GetConsumerGroupLag("writer1-group", "realtime-topic")
        if lag > 1000 {
            // Writer1 还在追赶，延迟处理
            p.requeueWithDelay(dlqMsg, 30*time.Second)
            continue
        }
        
        // 2. Writer1 已追上，重新查询
        spans, err := p.realtimeStore.QueryByTrace(
            dlqMsg.Decision.AppId,
            dlqMsg.Decision.ServiceName,
            dlqMsg.Decision.TraceId,
        )
        
        if err != nil || len(spans) == 0 {
            // 检查是否已超过实时存储 TTL
            if time.Since(dlqMsg.OriginalTime) > 25*time.Minute {
                log.Warn("span data expired, marking as lost", 
                    "traceId", dlqMsg.Decision.TraceId)
                p.metrics.IncSpanLoss(dlqMsg.Decision.AppId, 
                    dlqMsg.Decision.ServiceName, "ttl_expired")
                continue
            }
            // 还有时间，继续延迟重试
            p.requeueWithDelay(dlqMsg, 10*time.Second)
            continue
        }
        
        // 3. 成功获取数据，写入最终存储
        p.finalStore.BatchWrite(spans)
        log.Info("recovered span from dead letter", 
            "traceId", dlqMsg.Decision.TraceId,
            "spanCount", len(spans))
    }
}

func (p *SmartDeadLetterProcessor) requeueWithDelay(msg DeadLetterMessage, delay time.Duration) {
    msg.RetryCount++
    msg.NextRetryAt = time.Now().Add(delay)
    // 重新放入延迟队列（可以使用 Kafka 的延迟消息或 Redis 的 ZSET）
    p.dlqProducer.SendWithDelay(msg, delay)
}
```

**方案三：Writer2 消费位点协调（推荐）**

最可靠的方案是让 Writer2 的消费进度**不超过** Writer1。核心思想：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         进度同步架构                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   realtime-topic                          delayed-topic                 │
│   ┌─────────────┐                         ┌─────────────┐               │
│   │ msg1 (T=10) │                         │ msg1 (T=10) │               │
│   │ msg2 (T=11) │                         │ msg2 (T=11) │               │
│   │ msg3 (T=12) │ ◄── Writer1 消费到这里   │ msg3 (T=12) │               │
│   │ msg4 (T=13) │                         │ msg4 (T=13) │ ◄── Writer2   │
│   │ msg5 (T=14) │                         │ msg5 (T=14) │     等待      │
│   └─────────────┘                         └─────────────┘               │
│          │                                       │                      │
│          │ 上报进度 T=12                          │ 检查进度             │
│          ▼                                       ▼                      │
│   ┌─────────────────────────────────────────────────────┐               │
│   │                    Redis                            │               │
│   │  writer1:progress = 12 (时间戳)                     │               │
│   │  writer1:partition:0:offset = 1000                  │               │
│   │  writer1:heartbeat = 1704067200                     │               │
│   └─────────────────────────────────────────────────────┘               │
│                                                                         │
│   规则：Writer2 只消费 T <= Writer1.progress - safety_margin 的消息      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**完整实现**：

```go
// ==================== 进度协调器 ====================

type ConsumerCoordinator struct {
    redisClient     *redis.Client
    keyPrefix       string
    heartbeatTTL    time.Duration  // 心跳过期时间
    progressTTL     time.Duration  // 进度信息过期时间
}

func NewConsumerCoordinator(redisClient *redis.Client) *ConsumerCoordinator {
    return &ConsumerCoordinator{
        redisClient:  redisClient,
        keyPrefix:    "tail_sampling",
        heartbeatTTL: 30 * time.Second,
        progressTTL:  5 * time.Minute,
    }
}

// Writer1Progress 表示 Writer1 的消费进度
type Writer1Progress struct {
    Timestamp      time.Time         // 最新处理消息的时间戳
    PartitionOffsets map[int32]int64 // 各分区的消费位点
    UpdatedAt      time.Time         // 进度更新时间
    InstanceId     string            // Writer1 实例 ID
}

// SetWriter1Progress Writer1 上报消费进度
func (c *ConsumerCoordinator) SetWriter1Progress(progress Writer1Progress) error {
    pipe := c.redisClient.Pipeline()
    
    // 1. 设置时间戳进度（用于 Writer2 判断）
    progressKey := fmt.Sprintf("%s:writer1:progress", c.keyPrefix)
    pipe.Set(ctx, progressKey, progress.Timestamp.UnixMilli(), c.progressTTL)
    
    // 2. 设置各分区的 offset（用于精确追踪）
    for partition, offset := range progress.PartitionOffsets {
        offsetKey := fmt.Sprintf("%s:writer1:partition:%d:offset", c.keyPrefix, partition)
        pipe.Set(ctx, offsetKey, offset, c.progressTTL)
    }
    
    // 3. 设置心跳（用于检测 Writer1 存活状态）
    heartbeatKey := fmt.Sprintf("%s:writer1:heartbeat:%s", c.keyPrefix, progress.InstanceId)
    pipe.Set(ctx, heartbeatKey, time.Now().UnixMilli(), c.heartbeatTTL)
    
    _, err := pipe.Exec(ctx)
    return err
}

// GetWriter1Progress 获取 Writer1 的消费进度
func (c *ConsumerCoordinator) GetWriter1Progress() (Writer1Progress, error) {
    progressKey := fmt.Sprintf("%s:writer1:progress", c.keyPrefix)
    
    val, err := c.redisClient.Get(ctx, progressKey).Int64()
    if err == redis.Nil {
        // 没有进度信息，返回保守值
        return Writer1Progress{
            Timestamp: time.Now().Add(-2 * time.Minute),
            UpdatedAt: time.Time{},
        }, nil
    }
    if err != nil {
        return Writer1Progress{}, err
    }
    
    return Writer1Progress{
        Timestamp: time.UnixMilli(val),
        UpdatedAt: time.Now(),
    }, nil
}

// IsWriter1Alive 检查 Writer1 是否存活
func (c *ConsumerCoordinator) IsWriter1Alive() (bool, error) {
    pattern := fmt.Sprintf("%s:writer1:heartbeat:*", c.keyPrefix)
    keys, err := c.redisClient.Keys(ctx, pattern).Result()
    if err != nil {
        return false, err
    }
    return len(keys) > 0, nil
}

// GetWriter1Instances 获取所有存活的 Writer1 实例
func (c *ConsumerCoordinator) GetWriter1Instances() ([]string, error) {
    pattern := fmt.Sprintf("%s:writer1:heartbeat:*", c.keyPrefix)
    keys, err := c.redisClient.Keys(ctx, pattern).Result()
    if err != nil {
        return nil, err
    }
    
    instances := make([]string, 0, len(keys))
    prefix := fmt.Sprintf("%s:writer1:heartbeat:", c.keyPrefix)
    for _, key := range keys {
        instances = append(instances, strings.TrimPrefix(key, prefix))
    }
    return instances, nil
}
```

```go
// ==================== Writer1 进度上报 ====================

type ProgressReportingWriter struct {
    *RealtimeWriter
    coordinator      *ConsumerCoordinator
    instanceId       string
    reportInterval   time.Duration
    
    // 追踪最新处理的消息
    mu               sync.RWMutex
    latestMsgTime    time.Time
    partitionOffsets map[int32]int64
}

func NewProgressReportingWriter(base *RealtimeWriter, coord *ConsumerCoordinator) *ProgressReportingWriter {
    return &ProgressReportingWriter{
        RealtimeWriter:   base,
        coordinator:      coord,
        instanceId:       uuid.New().String(),
        reportInterval:   5 * time.Second,
        partitionOffsets: make(map[int32]int64),
    }
}

func (w *ProgressReportingWriter) Run() {
    // 启动进度上报协程
    go w.progressReporter()
    
    // 正常消费处理
    for msg := range w.consumer.Messages() {
        span := parseSpan(msg)
        
        // 更新进度追踪
        w.updateProgress(msg)
        
        // 正常处理逻辑
        w.processSpan(span)
    }
}

func (w *ProgressReportingWriter) updateProgress(msg kafka.Message) {
    w.mu.Lock()
    defer w.mu.Unlock()
    
    // 更新消息时间戳（取消息中的业务时间戳）
    msgTime := extractMsgTimestamp(msg)
    if msgTime.After(w.latestMsgTime) {
        w.latestMsgTime = msgTime
    }
    
    // 更新分区 offset
    w.partitionOffsets[msg.Partition] = msg.Offset
}

func (w *ProgressReportingWriter) progressReporter() {
    ticker := time.NewTicker(w.reportInterval)
    defer ticker.Stop()
    
    for range ticker.C {
        w.mu.RLock()
        progress := Writer1Progress{
            Timestamp:        w.latestMsgTime,
            PartitionOffsets: copyMap(w.partitionOffsets),
            UpdatedAt:        time.Now(),
            InstanceId:       w.instanceId,
        }
        w.mu.RUnlock()
        
        if err := w.coordinator.SetWriter1Progress(progress); err != nil {
            log.Error("failed to report progress", "error", err)
            w.metrics.IncProgressReportFailed()
        }
    }
}

func extractMsgTimestamp(msg kafka.Message) time.Time {
    // 优先使用消息中的业务时间戳
    if ts, ok := msg.Headers["timestamp"]; ok {
        if t, err := strconv.ParseInt(string(ts), 10, 64); err == nil {
            return time.UnixMilli(t)
        }
    }
    // 降级使用 Kafka 消息时间戳
    return msg.Timestamp
}
```

```go
// ==================== Writer2 进度感知消费 ====================

type CoordinatedDelayedWriter struct {
    *DelayedWriter
    coordinator      *ConsumerCoordinator
    safetyMargin     time.Duration  // 安全边际
    maxWaitTime      time.Duration  // 最大等待时间
    checkInterval    time.Duration  // 进度检查间隔
    
    // 状态
    consecutiveWaits int            // 连续等待次数
    lastProgress     Writer1Progress
}

func NewCoordinatedDelayedWriter(
    base *DelayedWriter,
    coord *ConsumerCoordinator,
    config CoordinatedConfig,
) *CoordinatedDelayedWriter {
    return &CoordinatedDelayedWriter{
        DelayedWriter:  base,
        coordinator:    coord,
        safetyMargin:   config.SafetyMargin,   // 默认 10s
        maxWaitTime:    config.MaxWaitTime,    // 默认 60s
        checkInterval:  config.CheckInterval,  // 默认 2s
    }
}

func (w *CoordinatedDelayedWriter) Run() {
    for msg := range w.consumer.Messages() {
        decision := parseSamplingDecision(msg)
        
        // 等待 Writer1 追上
        if err := w.waitForWriter1(decision); err != nil {
            log.Error("wait for writer1 failed", "error", err)
            // 降级处理：直接尝试查询，失败则进入死信队列
        }
        
        // 正常处理流程
        w.processDecision(decision)
    }
}

// waitForWriter1 等待 Writer1 处理到指定时间点
func (w *CoordinatedDelayedWriter) waitForWriter1(decision SamplingDecision) error {
    decisionTime := time.UnixMilli(decision.SampledAt)
    targetTime := decisionTime.Add(-w.safetyMargin)  // 需要 Writer1 处理到的时间点
    
    startWait := time.Now()
    w.consecutiveWaits = 0
    
    for {
        // 1. 获取 Writer1 进度
        progress, err := w.coordinator.GetWriter1Progress()
        if err != nil {
            log.Warn("get writer1 progress failed", "error", err)
            // Redis 故障时降级：等待固定时间后继续
            time.Sleep(w.safetyMargin)
            return nil
        }
        w.lastProgress = progress
        
        // 2. 检查 Writer1 是否已处理到目标时间点
        if progress.Timestamp.After(targetTime) || progress.Timestamp.Equal(targetTime) {
            if w.consecutiveWaits > 0 {
                w.metrics.RecordWaitDuration(time.Since(startWait))
                log.Debug("writer1 caught up", 
                    "waitDuration", time.Since(startWait),
                    "consecutiveWaits", w.consecutiveWaits)
            }
            return nil
        }
        
        // 3. 检查是否超过最大等待时间
        if time.Since(startWait) > w.maxWaitTime {
            log.Warn("max wait time exceeded", 
                "decisionTime", decisionTime,
                "writer1Progress", progress.Timestamp,
                "waited", time.Since(startWait))
            w.metrics.IncMaxWaitExceeded()
            // 超时后仍然尝试处理，可能会失败进入死信队列
            return fmt.Errorf("max wait time exceeded")
        }
        
        // 4. 检查 Writer1 是否存活
        alive, _ := w.coordinator.IsWriter1Alive()
        if !alive {
            log.Warn("writer1 appears to be down", 
                "lastProgress", progress.Timestamp)
            w.metrics.IncWriter1DownDetected()
            // Writer1 宕机，等待更长时间
            time.Sleep(w.checkInterval * 2)
        } else {
            time.Sleep(w.checkInterval)
        }
        
        w.consecutiveWaits++
        w.metrics.IncWaitForWriter1()
        
        log.Debug("waiting for writer1", 
            "targetTime", targetTime,
            "writer1Progress", progress.Timestamp,
            "gap", targetTime.Sub(progress.Timestamp))
    }
}
```

```go
// ==================== 多 Writer1 实例场景 ====================

// 当有多个 Writer1 实例时，需要取所有实例的最小进度
type MultiInstanceCoordinator struct {
    *ConsumerCoordinator
}

// GetMinWriter1Progress 获取所有 Writer1 实例的最小进度
func (c *MultiInstanceCoordinator) GetMinWriter1Progress() (Writer1Progress, error) {
    instances, err := c.GetWriter1Instances()
    if err != nil {
        return Writer1Progress{}, err
    }
    
    if len(instances) == 0 {
        // 没有存活的 Writer1，返回保守值
        return Writer1Progress{
            Timestamp: time.Now().Add(-2 * time.Minute),
        }, nil
    }
    
    var minProgress Writer1Progress
    minProgress.Timestamp = time.Now()  // 初始化为当前时间
    
    pipe := c.redisClient.Pipeline()
    progressKeys := make([]string, len(instances))
    
    for i, instance := range instances {
        // 每个实例可能有自己的进度 key
        progressKeys[i] = fmt.Sprintf("%s:writer1:progress:%s", c.keyPrefix, instance)
        pipe.Get(ctx, progressKeys[i])
    }
    
    results, err := pipe.Exec(ctx)
    if err != nil && err != redis.Nil {
        return Writer1Progress{}, err
    }
    
    for _, result := range results {
        if result.Err() == nil {
            val, _ := result.(*redis.StringCmd).Int64()
            t := time.UnixMilli(val)
            if t.Before(minProgress.Timestamp) {
                minProgress.Timestamp = t
            }
        }
    }
    
    return minProgress, nil
}
```

```go
// ==================== 优雅降级处理 ====================

type GracefulCoordinatedWriter struct {
    *CoordinatedDelayedWriter
    fallbackMode     atomic.Bool     // 是否处于降级模式
    fallbackDuration time.Duration   // 降级模式持续时间
}

func (w *GracefulCoordinatedWriter) Run() {
    // 启动健康检查
    go w.healthChecker()
    
    for msg := range w.consumer.Messages() {
        decision := parseSamplingDecision(msg)
        
        if w.fallbackMode.Load() {
            // 降级模式：使用固定延迟替代进度同步
            w.processFallback(decision)
        } else {
            // 正常模式：进度同步
            w.processNormal(decision)
        }
    }
}

func (w *GracefulCoordinatedWriter) healthChecker() {
    ticker := time.NewTicker(10 * time.Second)
    consecutiveFailures := 0
    
    for range ticker.C {
        // 检查 Redis 和 Writer1 状态
        alive, err := w.coordinator.IsWriter1Alive()
        
        if err != nil || !alive {
            consecutiveFailures++
            if consecutiveFailures >= 3 {
                if !w.fallbackMode.Load() {
                    log.Warn("entering fallback mode", 
                        "reason", "writer1 unhealthy or redis error")
                    w.fallbackMode.Store(true)
                    w.metrics.IncFallbackModeEntered()
                }
            }
        } else {
            if w.fallbackMode.Load() {
                log.Info("exiting fallback mode", "reason", "writer1 recovered")
                w.fallbackMode.Store(false)
                w.metrics.IncFallbackModeExited()
            }
            consecutiveFailures = 0
        }
    }
}

func (w *GracefulCoordinatedWriter) processFallback(decision SamplingDecision) {
    // 降级模式：使用固定延迟
    // 假设 Writer1 恢复后能在 30 秒内追上
    time.Sleep(w.fallbackDuration)
    w.processDecision(decision)
}

func (w *GracefulCoordinatedWriter) processNormal(decision SamplingDecision) {
    if err := w.waitForWriter1(decision); err != nil {
        // 等待超时，仍然尝试处理
        log.Warn("wait timeout, processing anyway", "traceId", decision.TraceId)
    }
    w.processDecision(decision)
}
```

**进度同步方案的优势**：

| 特性 | 说明 |
|:---|:---|
| **精确控制** | 基于实际消费进度，而非估算 |
| **自适应** | Writer1 快则 Writer2 快，Writer1 慢则 Writer2 等待 |
| **故障感知** | 通过心跳检测 Writer1 存活状态 |
| **多实例支持** | 支持多 Writer1 实例，取最小进度 |
| **优雅降级** | Redis 故障或 Writer1 宕机时自动降级 |

**注意事项**：

1. **时钟同步**：各服务器时钟需要通过 NTP 同步，否则时间戳比较会不准确
2. **进度上报频率**：不宜过高（增加 Redis 压力）也不宜过低（延迟增加），推荐 5 秒
3. **安全边际**：考虑网络延迟和处理时间，推荐 10-15 秒
4. **Redis 高可用**：进度信息存储在 Redis，需要保证 Redis 高可用

**配置建议**：

```yaml
delayed_writer:
  # 方案选择
  coordination_mode: "progress_sync"  # lag_aware / progress_sync / dlq_retry
  
  # Lag 感知模式配置
  lag_aware:
    lag_threshold: 10000        # Lag 超过此值开始增加延迟
    base_delay: 10s             # 基础延迟
    max_delay: 60s              # 最大延迟
    writer1_throughput: 10000   # Writer1 预估吞吐量（条/秒）
  
  # 进度同步模式配置（推荐）
  progress_sync:
    safety_margin: 10s          # 安全边际，Writer2 落后 Writer1 的时间
    max_wait_time: 60s          # 最大等待时间，超过则降级处理
    check_interval: 2s          # 进度检查间隔
    progress_report_interval: 5s # Writer1 进度上报间隔
    heartbeat_ttl: 30s          # Writer1 心跳过期时间
    progress_ttl: 5m            # 进度信息过期时间
    fallback_duration: 30s      # 降级模式固定延迟
    
  # 死信队列重试配置
  dead_letter:
    retry_delays: [10s, 30s, 60s, 120s]  # 递增的重试延迟
    max_retry_duration: 25m              # 最大重试时长（需小于实时存储 TTL）

# Writer1 配置
realtime_writer:
  progress_report:
    enabled: true
    interval: 5s
    redis_key_prefix: "tail_sampling"
```

**进度同步的时序图**：

```
Writer1                    Redis                    Writer2
   │                         │                         │
   │  上报进度 T=100          │                         │
   ├────────────────────────►│                         │
   │                         │                         │
   │                         │  查询进度                │
   │                         │◄────────────────────────┤
   │                         │                         │
   │                         │  返回 T=100             │
   │                         ├────────────────────────►│
   │                         │                         │
   │                         │  消息时间 T=105         │
   │                         │  T=105 > T=100+10s?    │
   │                         │  否，继续处理           │
   │                         │                         │
   │  Writer1 宕机            │                         │
   │  ════════════════       │                         │
   │                         │                         │
   │                         │  消息时间 T=120         │
   │                         │  查询进度 T=100         │
   │                         │  T=120 > T=100+10s?    │
   │                         │  是，等待...            │
   │                         │◄────────────────────────┤
   │                         │                         │
   │  Writer1 恢复            │                         │
   │  ════════════════       │                         │
   │                         │                         │
   │  上报进度 T=115          │                         │
   ├────────────────────────►│                         │
   │                         │                         │
   │                         │  查询进度 T=115         │
   │                         │  T=120 > T=115+10s?    │
   │                         │  否，继续处理           │
   │                         ├────────────────────────►│
   │                         │                         │
```

**监控指标补充**：

```yaml
metrics:
  # Writer1 进度上报相关
  - name: writer1_progress_timestamp
    type: gauge
    labels: [instance_id]
    description: "Writer1 最新处理消息的时间戳"
    
  - name: writer1_progress_report_total
    type: counter
    labels: [instance_id, result]  # result: success / failed
    
  - name: writer1_lag_current
    type: gauge
    labels: [partition]
    
  # Writer2 进度同步相关
  - name: writer2_wait_for_writer1_total
    type: counter
    labels: [reason]  # reason: progress_behind / writer1_down
    
  - name: writer2_wait_duration_seconds
    type: histogram
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
    
  - name: writer2_max_wait_exceeded_total
    type: counter
    
  - name: writer2_fallback_mode
    type: gauge
    description: "1 表示处于降级模式，0 表示正常模式"
    
  - name: writer2_fallback_mode_transitions_total
    type: counter
    labels: [direction]  # direction: entered / exited
    
  # 死信队列恢复相关
  - name: dead_letter_recovered_total
    type: counter
    labels: [app_id, service_name]
```

### 降级开关

```yaml
# 配置中心
tail_sampling:
  enabled: true
  
  # 降级配置
  fallback:
    # Redis 故障时的降级策略
    redis_unavailable: "ratio_sampling"  # ratio_sampling / all / none
    redis_unavailable_ratio: 0.01
    
    # 实时存储故障时的降级策略
    buffer_unavailable: "local_disk"
    local_disk_path: "/data/spans-buffer"
    local_disk_max_size: "10GB"
```

---

## 性能优化

### 1. 批量操作

```go
// 批量写入布隆过滤器
func (m *BloomFilterManager) BatchMarkSampled(items []SamplingItem) error {
    pipe := m.redisClient.Pipeline()
    
    for _, item := range items {
        key := m.buildKey(item.AppId, item.ServiceName)
        pipe.Do(ctx, "BF.ADD", key, item.TraceId)
    }
    
    _, err := pipe.Exec(ctx)
    return err
}
```

### 2. 内存优化

```go
// 使用对象池减少 GC 压力
var spanPool = sync.Pool{
    New: func() interface{} {
        return &Span{}
    },
}

func getSpan() *Span {
    return spanPool.Get().(*Span)
}

func putSpan(s *Span) {
    s.Reset()
    spanPool.Put(s)
}
```

### 3. 并行查询与批量处理

```go
// Writer2 批量并行处理多个 Trace
func (w *DelayedWriter) BatchProcess(decisions []SamplingDecision) {
    var wg sync.WaitGroup
    semaphore := make(chan struct{}, w.config.Concurrency)  // 并发度控制
    
    for _, decision := range decisions {
        // 1. 本地去重
        if w.localCache.Contains(decision.TraceId) {
            w.metrics.IncDedupHit("local_cache")
            continue
        }
        w.localCache.Add(decision.TraceId)
        
        // 2. 分布式去重
        if !w.deduper.TryAcquire(decision.TraceId) {
            w.metrics.IncDedupHit("redis")
            continue
        }
        
        wg.Add(1)
        semaphore <- struct{}{}
        
        go func(d SamplingDecision) {
            defer wg.Done()
            defer func() { <-semaphore }()
            
            // 3. 带重试的查询
            spans, err := w.queryWithRetry(d)
            if err != nil {
                w.sendToDeadLetter(d, err)
                return
            }
            
            // 4. 批量写入最终存储
            if err := w.finalStore.BatchWrite(spans); err != nil {
                w.sendToDeadLetter(d, err)
            }
        }(decision)
    }
    
    wg.Wait()
}
```

---

## 备选方案：单 Topic 架构

上述方案采用双 Kafka Topic（realtime-topic + delayed-topic），Writer2 需要从实时存储查询数据，存在**时序依赖**问题。这里介绍一种简化的**单 Topic 架构**。

### 架构对比

**原方案（双 Topic）**：

```
Collector → realtime-topic → Writer1 → 实时存储 ←─┐
    │                                              │ 查询
    └──→ delayed-topic (采样决策) → Writer2 ───────┘
                                        │
                                        └──→ 最终存储
```

**备选方案（单 Topic）**：

```
                                    ┌──→ Writer1（实时消费）→ 实时存储
                                    │
Collector → Kafka (全量 Span) ──────┤
                                    │
                                    └──→ Writer2（延迟消费）→ 采样决策 → 最终存储
```

### 核心变化

| 对比项 | 原方案 | 备选方案 |
|:---|:---|:---|
| **Kafka Topic** | 2 个（realtime + delayed） | 1 个（全量 Span） |
| **Collector 职责** | 采样决策 + 双路输出 | 仅转发，不做采样 |
| **Writer2 数据来源** | 查询实时存储 | 直接从 Kafka 消费 |
| **时序依赖** | Writer2 依赖 Writer1 进度 | **无依赖** |
| **故障恢复** | 需要进度同步机制 | Kafka 重放即可 |

### 架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Collector 层                                │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  职责简化：                                                      │   │
│   │  1. 接收 Agent 上报的 Span                                      │   │
│   │  2. 流式判断是否触发采样条件 → 写入布隆过滤器                     │   │
│   │  3. 全量 Span → Kafka spans-topic                               │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │
                                     ▼
                      ┌──────────────────────────────────┐
                      │      Kafka: spans-topic          │
                      │      (全量 Span 数据)             │
                      │      保留时间: 1-2 小时           │
                      │      按 TraceId 分区              │
                      └──────────────┬───────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
     ┌──────────────────────────┐      ┌──────────────────────────┐
     │   Writer1 (实时消费)      │      │   Writer2 (延迟消费)      │
     │   Consumer Group: cg-rt  │      │   Consumer Group: cg-dl  │
     │                          │      │                          │
     │   全量写入实时存储         │      │   延迟 30-60s 消费        │
     │   支持实时查询            │      │   流式采样决策            │
     └───────────┬──────────────┘      └───────────┬──────────────┘
                 │                                 │
                 ▼                                 ▼
     ┌──────────────────────────┐      ┌──────────────────────────┐
     │   实时存储 (Buffer)       │      │   最终存储 (持久化)       │
     │   TTL: 10-30 分钟         │      │   TTL: 7-30 天           │
     │   支持实时查询            │      │   采样后的数据            │
     └──────────────────────────┘      └──────────────────────────┘
```

### Writer2 实现

```go
type SingleTopicDelayedWriter struct {
    consumer      kafka.Consumer
    bloomFilter   *BloomFilterManager
    finalStore    Storage
    config        SamplingConfig
    consumeDelay  time.Duration  // 延迟消费时间，如 30-60 秒
    batchSize     int            // 批量大小
    flushInterval time.Duration  // 刷新间隔
    metrics       *Metrics       // 监控指标
    
    // 失败处理
    localBuffer   *LocalDiskBuffer  // 本地磁盘缓冲，写入失败时暂存
    dlqProducer   kafka.Producer    // 死信队列生产者
    
    // 优雅关闭
    stopCh        chan struct{}
    wg            sync.WaitGroup
}

// Run 批量处理 + 统一延迟（推荐）
func (w *SingleTopicDelayedWriter) Run(ctx context.Context) error {
    batch := make([]Span, 0, w.batchSize)
    ticker := time.NewTicker(w.flushInterval)
    defer ticker.Stop()
    
    w.wg.Add(1)
    defer w.wg.Done()
    
    for {
        select {
        case <-ctx.Done():
            // 优雅关闭：处理剩余批次
            if len(batch) > 0 {
                w.processBatch(batch)
            }
            return ctx.Err()
            
        case <-w.stopCh:
            if len(batch) > 0 {
                w.processBatch(batch)
            }
            return nil
            
        case msg, ok := <-w.consumer.Messages():
            if !ok {
                return nil
            }
            span := parseSpan(msg)
            batch = append(batch, span)
            
            if len(batch) >= w.batchSize {
                w.processBatch(batch)
                batch = batch[:0]
            }
            
        case <-ticker.C:
            if len(batch) > 0 {
                w.processBatch(batch)
                batch = batch[:0]
            }
        }
    }
}

// processBatch 批量处理：按最大时间戳统一延迟
func (w *SingleTopicDelayedWriter) processBatch(batch []Span) {
    if len(batch) == 0 {
        return
    }
    
    // 1. 找到批次中最新的 Span 时间戳
    var maxTime int64
    for _, span := range batch {
        if span.StartTime > maxTime {
            maxTime = span.StartTime
        }
    }
    
    // 2. 统一延迟：只 sleep 一次
    spanTime := time.UnixMilli(maxTime)
    elapsed := time.Since(spanTime)
    if elapsed < w.consumeDelay {
        time.Sleep(w.consumeDelay - elapsed)
    }
    
    // 3. 按 appId:serviceName 分组，批量查询布隆过滤器
    grouped := make(map[string][]Span)  // key: appId:serviceName
    for _, span := range batch {
        key := fmt.Sprintf("%s:%s", span.AppId, span.ServiceName)
        grouped[key] = append(grouped[key], span)
    }
    
    // 4. 分组处理
    toWrite := make([]Span, 0, len(batch))
    for _, spans := range grouped {
        if len(spans) == 0 {
            continue
        }
        
        appId := spans[0].AppId
        serviceName := spans[0].ServiceName
        
        // 批量查询该分组的 TraceId（先去重，避免重复查询）
        traceIdSet := make(map[string]struct{}, len(spans))
        for _, span := range spans {
            traceIdSet[span.TraceId] = struct{}{}
        }
        traceIds := make([]string, 0, len(traceIdSet))
        for traceId := range traceIdSet {
            traceIds = append(traceIds, traceId)
        }
        sampledMap := w.bloomFilter.BatchIsSampled(appId, serviceName, traceIds)
        
        // 处理每个 Span
        for _, span := range spans {
            if sampledMap[span.TraceId] {
                toWrite = append(toWrite, span)
                continue
            }
            
            if shouldSample, reason := w.shouldSample(span); shouldSample {
                w.bloomFilter.MarkSampled(span.AppId, span.ServiceName, span.TraceId)
                toWrite = append(toWrite, span)
                w.metrics.IncSpanWritten(span.AppId, span.ServiceName, reason)
                continue
            }
            
            w.metrics.IncSpanDropped(span.AppId, span.ServiceName)
        }
    }
    
    // 5. 批量写入最终存储
    if len(toWrite) > 0 {
        if err := w.finalStore.BatchWrite(toWrite); err != nil {
            log.Error("batch write failed", "error", err, "count", len(toWrite))
            w.handleWriteFailure(toWrite, err)
        }
    }
}

// GracefulStop 优雅关闭
func (w *SingleTopicDelayedWriter) GracefulStop(timeout time.Duration) error {
    close(w.stopCh)
    
    done := make(chan struct{})
    go func() {
        w.wg.Wait()
        close(done)
    }()
    
    select {
    case <-done:
        return nil
    case <-time.After(timeout):
        return fmt.Errorf("graceful stop timeout after %v", timeout)
    }
}

func (w *SingleTopicDelayedWriter) shouldSample(span Span) (bool, string) {
    // 错误必采
    if span.Status == "ERROR" || span.Attributes["error"] == "true" {
        return true, "error"
    }
    
    // 慢请求必采
    if span.Duration > w.config.SlowThreshold {
        return true, "slow"
    }
    
    // 比例采样（基于 TraceId 哈希）
    if w.ratioSample(span.TraceId) {
        return true, "ratio"
    }
    
    return false, ""
}

// ratioSample 基于 TraceId 的确定性采样
func (w *SingleTopicDelayedWriter) ratioSample(traceId string) bool {
    hash := fnv.New32a()
    hash.Write([]byte(traceId))
    return hash.Sum32()%10000 < uint32(w.config.SampleRate*10000)
}

// handleWriteFailure 处理写入失败的 Span
func (w *SingleTopicDelayedWriter) handleWriteFailure(spans []Span, err error) {
    // 方案1: 写入本地磁盘缓冲
    if w.localBuffer != nil {
        if bufErr := w.localBuffer.Write(spans); bufErr != nil {
            log.Error("write to local buffer failed", "error", bufErr)
        } else {
            w.metrics.IncLocalBufferWrite(len(spans))
            return
        }
    }
    
    // 方案2: 写入死信队列
    for _, span := range spans {
        dlqMsg := DeadLetterMessage{
            Span:      span,
            Error:     err.Error(),
            FailedAt:  time.Now(),
        }
        if dlqErr := w.dlqProducer.Send(dlqMsg); dlqErr != nil {
            log.Error("send to dead letter queue failed", "error", dlqErr)
            w.metrics.IncDeadLetterFailed()
        }
    }
}
```

### 优缺点分析

**优点**：

| 优点 | 说明 |
|:---|:---|
| **彻底解决时序问题** | Writer2 不依赖 Writer1，不需要进度同步 |
| **故障恢复简单** | Writer2 宕机恢复后直接从 Kafka 继续消费 |
| **架构简化** | 去掉一个 Kafka Topic，Collector 逻辑简化 |
| **数据完整性** | Writer2 直接消费原始数据，不会因查询失败丢数据 |

**缺点**：

| 缺点 | 说明 | 缓解措施 |
|:---|:---|:---|
| **Kafka 存储压力增大** | 全量 Span 需要更长保留时间 | 合理设置保留时间（1-2 小时） |
| **Kafka 带宽翻倍** | 两个 Consumer Group 消费同一 Topic | 利用 Kafka 的 Page Cache |
| **Collector 仍需布隆过滤器** | 需要提前标记采样 TraceId | 可选，Writer2 也可自主决策 |

---

### 双方案详细对比

| 维度 | 双 Topic 方案 | 单 Topic 方案 |
|:---|:---|:---|
| **架构复杂度** | 较高：需要 2 个 Topic + 进度同步 | 较低：1 个 Topic，无进度同步 |
| **Kafka 资源** | 较低：delayed-topic 只存采样决策（消息小） | 较高：全量 Span 需要更长保留时间 |
| **时序依赖** | 有：Writer2 依赖 Writer1 进度 | 无：两个 Writer 完全独立 |
| **故障恢复** | 复杂：需要进度同步、死信队列重试 | 简单：直接从 Kafka 重放 |
| **数据完整性** | 有风险：查询失败可能丢数据 | 高：直接消费原始数据 |
| **实时存储依赖** | 强依赖：Writer2 必须查询实时存储 | 弱依赖：仅 Writer1 写入，Writer2 不查询 |
| **Collector 复杂度** | 较高：需要双路输出 | 较低：仅单路输出 + 布隆过滤器 |
| **消费延迟控制** | 精确：基于进度同步 | 粗略：基于固定延迟或消息时间戳 |
| **扩展性** | 较好：采样决策消息小，吞吐高 | 一般：全量消费，吞吐受限 |
| **运维复杂度** | 较高：需要监控进度同步、处理时序问题 | 较低：标准 Kafka 消费者组模式 |

**成本对比**（以 10000 QPS，平均 Span 500B 为例）：

| 资源 | 双 Topic 方案 | 单 Topic 方案 |
|:---|:---|:---|
| **Kafka 存储** | realtime: 36GB/h + delayed: ~1GB/h ≈ **37GB/h** | spans: 36GB/h × 2h = **72GB** |
| **Kafka 带宽** | 5MB/s × 2 (写入+消费) = **10MB/s** | 5MB/s × 3 (写入+2消费) = **15MB/s** |
| **实时存储** | 必须，9GB（TTL 30min） | 可选，9GB（仅供实时查询） |
| **Redis** | 布隆过滤器 + 进度同步 + 去重锁 | 布隆过滤器（可选） |

### 方案选择决策树

```
                        开始
                          │
                          ▼
              ┌─────────────────────┐
              │ 对时序问题容忍度？    │
              └─────────────────────┘
                    │         │
              零容忍 │         │ 可接受
                    ▼         │
              ┌──────────┐    │
              │ 单 Topic │    │
              │   方案   │    │
              └──────────┘    │
                              ▼
              ┌─────────────────────┐
              │ Kafka 资源是否受限？  │
              └─────────────────────┘
                    │         │
                受限 │         │ 充足
                    ▼         │
              ┌──────────┐    │
              │ 双 Topic │    │
              │   方案   │    │
              └──────────┘    │
                              ▼
              ┌─────────────────────┐
              │ 是否需要精确进度控制？ │
              └─────────────────────┘
                    │         │
                需要 │         │ 不需要
                    ▼         ▼
              ┌──────────┐ ┌──────────┐
              │ 双 Topic │ │ 单 Topic │
              │   方案   │ │   方案   │
              └──────────┘ └──────────┘
```

### 配置示例

```yaml
kafka:
  spans-topic:
    partitions: 64
    replication_factor: 3
    retention_ms: 7200000        # 保留 2 小时
    partition_key: traceId       # 按 TraceId 分区，保证顺序

writer1:
  consumer_group: "spans-realtime"
  # 实时消费，无延迟
  
writer2:
  consumer_group: "spans-delayed"
  consume_delay: 30s             # 延迟 30 秒消费
  
  sampling:
    slow_threshold: 2000ms
    sample_rate: 0.01            # 1% 比例采样
```

### 方案选择建议

| 场景 | 推荐方案 |
|:---|:---|
| **对架构简洁性要求高** | 单 Topic 方案 |
| **Kafka 资源受限** | 双 Topic 方案（采样决策消息小） |
| **对时序问题零容忍** | 单 Topic 方案 |
| **需要复杂的进度控制** | 双 Topic 方案 + 进度同步 |

### 单 Topic 方案的完整性检测

单 Topic 方案中没有采样决策消息，完整性检测需要调整为**基于 Trace 聚合的方式**：

```go
// SingleTopicCompletenessChecker 单 Topic 方案的完整性检测
// 通过比较 Writer1 和 Writer2 写入的 Span 数量来检测完整性
type SingleTopicCompletenessChecker struct {
    // Writer1 写入的 Span 计数（从实时存储统计）
    writer1Counts sync.Map  // traceId -> count
    // Writer2 写入的 Span 计数
    writer2Counts sync.Map  // traceId -> count
    
    metrics       *Metrics
    windowSize    time.Duration
}

// RecordWriter1 由 Writer1 调用，记录写入实时存储的 Span 数
func (c *SingleTopicCompletenessChecker) RecordWriter1(traceId string, count int) {
    c.writer1Counts.Store(traceId, &traceCount{
        count:     count,
        createdAt: time.Now(),
    })
}

// RecordWriter2 由 Writer2 调用，记录写入最终存储的 Span 数
func (c *SingleTopicCompletenessChecker) RecordWriter2(traceId string, count int) {
    c.writer2Counts.Store(traceId, &traceCount{
        count:     count,
        createdAt: time.Now(),
    })
}

// checkCompleteness 检测完整性
// 对于被采样的 Trace，Writer2 写入的 Span 数应该等于 Writer1 写入的 Span 数
func (c *SingleTopicCompletenessChecker) checkCompleteness() {
    checkThreshold := time.Now().Add(-2 * time.Minute)
    
    c.writer2Counts.Range(func(key, value interface{}) bool {
        traceId := key.(string)
        writer2Count := value.(*traceCount)
        
        if writer2Count.createdAt.After(checkThreshold) {
            return true  // 跳过太新的数据
        }
        
        // 查找 Writer1 的计数
        writer1Val, ok := c.writer1Counts.Load(traceId)
        if !ok {
            // Writer1 没有记录，可能是：
            // 1. Writer1 还没处理到（正常情况，因为 Writer2 延迟消费）
            // 2. Writer1 写入失败
            // 单 Topic 方案中，Writer2 延迟消费，所以 Writer1 应该先处理完
            c.metrics.IncIncompleteTrace("writer1_missing")
            return true
        }
        
        writer1Count := writer1Val.(*traceCount)
        completeness := float64(writer2Count.count) / float64(writer1Count.count)
        
        if completeness < 1.0 {
            c.metrics.IncIncompleteTrace("partial")
            log.Warn("trace incomplete",
                "traceId", traceId,
                "writer1Count", writer1Count.count,
                "writer2Count", writer2Count.count,
                "completeness", completeness)
        }
        
        return true
    })
}

type traceCount struct {
    count     int
    createdAt time.Time
}
```

> **注意**：单 Topic 方案的完整性检测依赖 Writer1 和 Writer2 都记录各自处理的 Span 数量。由于 Writer2 延迟消费，正常情况下 Writer1 会先处理完同一个 Trace 的所有 Span。

---

## 总结

### 方案优势

| 特性 | 说明 |
|:---|:---|
| **错误链路 100% 保留** | 问题排查有完整上下文 |
| **存储成本可控** | 正常链路按比例采样 |
| **灵活的采样策略** | 支持错误、延迟、比例、属性等多维度 |
| **高可用设计** | 多级降级策略，故障自愈 |

### 适用场景

- 大规模微服务系统（日请求量 > 1 亿）
- 对问题排查有严格要求的业务
- 存储成本敏感的场景

### 不适用场景

- 小规模系统（全量存储成本可接受）
- 对实时性要求极高的场景（延迟采样有 10-30 秒延迟）

---

## 参考资料

- [OpenTelemetry Collector - Tail Sampling Processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor)
- [Jaeger - Adaptive Sampling](https://www.jaegertracing.io/docs/latest/sampling/)
- [Redis Bloom Filter](https://redis.io/docs/stack/bloom/)
