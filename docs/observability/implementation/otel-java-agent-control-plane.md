
# OpenTelemetry Java Agent 控制平面扩展方案

## 一、架构概述

### 1.1 整体架构

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        Control Plane Server (Collector)                   │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │   Config API    │  │    Task API     │  │      Status API         │  │
│  │  /v1/control/   │  │  /v1/control/   │  │    /v1/control/         │  │
│  │    config       │  │     tasks       │  │      status             │  │
│  └────────▲────────┘  └────────▲────────┘  └────────────▲────────────┘  │
│           │                    │                         │               │
└───────────┼────────────────────┼─────────────────────────┼───────────────┘
            │  Long Poll         │  Long Poll              │  Periodic
            │  (60s)             │  (10s)                  │  (60s)
┌───────────┼────────────────────┼─────────────────────────┼───────────────┐
│           │                    │                         │               │
│  ┌────────┴────────────────────┴─────────────────────────┴────────────┐  │
│  │                     ControlPlaneManager                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │  │
│  │  │ ConfigPoll   │  │  TaskPoll    │  │    StatusReport          │ │  │
│  │  │ Scheduler    │  │  Scheduler   │  │    Scheduler             │ │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────────┘ │  │
│  └─────────┼─────────────────┼──────────────────────┼────────────────┘  │
│            │                 │                      │                    │
│  ┌─────────▼─────────────────▼──────────────────────▼─────────────────┐ │
│  │                   ControlPlaneClient                               │ │
│  │         (HTTP/Protobuf or gRPC implementation)                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────────┐   │
│  │ OtlpHealth      │  │ DynamicConfig   │  │ DynamicSampler         │   │
│  │ Monitor         │◄─│ Manager         │──│ (Hot-Updatable)        │   │
│  └────────┬────────┘  └─────────────────┘  └────────────────────────┘   │
│           │                                                              │
│  ┌────────▼─────────────────────────────────────────────────────────┐   │
│  │              HealthMonitoringSpanExporter                         │   │
│  │                    (Wraps OTLP Exporter)                          │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│                        Java Agent (opentelemetry-java)                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.2 模块结构

```
sdk-extensions/controlplane/
├── src/main/java/io/opentelemetry/sdk/extension/controlplane/
│   ├── ControlPlaneManager.java          # 控制平面管理器 (核心协调器)
│   ├── client/
│   │   ├── ControlPlaneClient.java       # 客户端接口定义
│   │   ├── HttpControlPlaneClient.java   # HTTP/Protobuf 实现
│   │   └── GrpcControlPlaneClient.java   # gRPC 实现 (预留)
│   ├── config/
│   │   └── ControlPlaneConfig.java       # 配置类 (复用 OTLP 配置)
│   ├── dynamic/
│   │   ├── DynamicConfigManager.java     # 动态配置管理器
│   │   └── DynamicSampler.java           # 动态采样器
│   ├── health/
│   │   └── OtlpHealthMonitor.java        # OTLP 健康监控
│   ├── identity/
│   │   └── AgentIdentityProvider.java    # Agent 身份提供者
│   ├── spi/
│   │   ├── ControlPlaneAutoConfigurationProvider.java  # SPI 自动配置
│   │   └── HealthMonitoringSpanExporter.java           # 健康监控包装器
│   └── task/
│       ├── TaskResultPersistence.java    # 任务结果持久化
│       └── TaskResultSizePolicy.java     # 大结果处理策略
└── build.gradle.kts
```

## 二、核心组件设计

### 2.1 ControlPlaneManager (控制平面管理器)

**职责**: 协调所有控制平面组件，管理生命周期

```java
public final class ControlPlaneManager implements Closeable {
    // 连接状态
    public enum ConnectionState {
        CONNECTED,      // 已连接
        CONNECTING,     // 连接中
        DISCONNECTED,   // 已断开
        WAITING_FOR_OTLP // 等待 OTLP 恢复
    }
    
    // 核心组件
    private final ControlPlaneClient client;
    private final OtlpHealthMonitor healthMonitor;
    private final DynamicConfigManager configManager;
    private final DynamicSampler dynamicSampler;
    
    // 定时任务
    private ScheduledFuture<?> configPollTask;    // 配置轮询
    private ScheduledFuture<?> taskPollTask;      // 任务轮询
    private ScheduledFuture<?> statusReportTask;  // 状态上报
    private ScheduledFuture<?> cleanupTask;       // 清理任务
}
```

**关键机制**:
- **OTLP 健康联动**: 只有当 OTLP 导出健康时才连接控制平面
- **优雅降级**: OTLP 不健康时暂停控制平面连接，恢复后自动重连
- **状态上报不中断**: 即使 OTLP 不健康，状态上报仍然继续

### 2.2 ControlPlaneClient (控制平面客户端)

**职责**: 定义与控制平面服务通信的标准接口

```java
public interface ControlPlaneClient extends Closeable {
    // 长轮询拉取配置
    CompletableFuture<ConfigResponse> getConfig(ConfigRequest request);
    
    // 长轮询拉取任务
    CompletableFuture<TaskResponse> getTasks(TaskRequest request);
    
    // 上报状态
    CompletableFuture<StatusResponse> reportStatus(StatusRequest request);
    
    // 分片上传大结果
    CompletableFuture<ChunkedUploadResponse> uploadChunkedResult(ChunkedTaskResult chunk);
}
```

**API 定义**:

| API | 方法 | 路径 | 说明 |
|-----|------|------|------|
| getConfig | POST | /v1/control/config | 长轮询获取配置，支持版本号和 ETag |
| getTasks | POST | /v1/control/tasks | 长轮询获取任务 |
| reportStatus | POST | /v1/control/status | 上报 Agent 状态和任务结果 |
| uploadChunkedResult | POST | /v1/control/upload-chunk | 分片上传大结果 |

### 2.3 OtlpHealthMonitor (OTLP 健康监控)

**职责**: 通过滑动窗口统计 OTLP 导出成功率，判断健康状态

```java
public final class OtlpHealthMonitor {
    public enum HealthState {
        UNKNOWN,    // 未知 (初始状态)
        HEALTHY,    // 健康
        DEGRADED,   // 降级 (部分失败)
        UNHEALTHY   // 不健康
    }
    
    private final int windowSize;           // 滑动窗口大小 (默认 100)
    private final double healthyThreshold;  // 健康阈值 (默认 0.9)
    private final double unhealthyThreshold;// 不健康阈值 (默认 0.5)
    
    public void recordSuccess();            // 记录成功
    public void recordFailure(String error);// 记录失败
    public boolean isHealthy();             // 检查是否健康
    public double getSuccessRate();         // 获取成功率
}
```

**健康判定规则**:
- 成功率 >= 90%: **HEALTHY**
- 成功率 50% ~ 90%: **DEGRADED**
- 成功率 <= 50%: **UNHEALTHY**

### 2.4 DynamicConfigManager (动态配置管理器)

**职责**: 管理从控制平面下发的配置，支持热更新

```java
public final class DynamicConfigManager {
    // 可热更新组件注册表
    private final Map<String, HotUpdatableComponent> components;
    
    // 注册组件
    public void registerComponent(String name, HotUpdatableComponent component);
    
    // 应用配置
    public ConfigApplyResult applyConfig(AgentConfigData config);
    
    // 可热更新组件接口
    public interface HotUpdatableComponent {
        void update(Object config);
    }
}
```

**支持的配置类型**:
- `sampler`: 采样配置 (采样率、采样类型)
- `batch_processor`: 批处理配置 (队列大小、延迟等)
- `resource`: 动态资源属性
- `extension`: 扩展配置 (JSON)

### 2.5 DynamicSampler (动态采样器)

**职责**: 支持运行时动态更新采样策略

```java
public final class DynamicSampler implements Sampler, HotUpdatableComponent {
    private final AtomicReference<Sampler> delegate;
    
    // 更新采样器
    public void update(Sampler newSampler);
    
    // 更新采样率
    public void updateRatio(double ratio);
    
    // 更新为 ParentBased
    public void updateParentBased(double ratio);
    
    // 支持的采样类型
    public enum SamplerType {
        ALWAYS_ON,
        ALWAYS_OFF,
        TRACE_ID_RATIO,
        PARENT_BASED,
        RULE_BASED
    }
}
```

### 2.6 TaskResultSizePolicy (任务结果大小策略)

**职责**: 处理大体积任务结果

```java
public final class TaskResultSizePolicy {
    private final long compressionThreshold;  // 压缩阈值 (默认 1KB)
    private final long chunkedThreshold;      // 分片阈值 (默认 50MB)
    private final long chunkSize;             // 分片大小 (默认 10MB)
    private final long maxSize;               // 最大阈值 (默认 200MB)
    
    public TaskResultWrapper process(String taskId, byte[] data, String dataType);
}
```

**处理策略**:
| 数据大小 | 处理方式 |
|---------|---------|
| < 1KB | 直接上传 |
| 1KB ~ 50MB | GZIP 压缩后上传 |
| 50MB ~ 200MB | 分片上传 (每片 10MB) |
| > 200MB | 拒绝上传 |

## 三、配置参数

### 3.1 配置键定义

```properties
# ===== 基础配置 =====
otel.agent.control.enabled=true                    # 启用控制平面
otel.exporter.otlp.endpoint=http://localhost:4317  # 复用 OTLP endpoint
otel.exporter.otlp.protocol=grpc                   # 复用 OTLP 协议 (grpc/http/protobuf)

# ===== 控制平面特定配置 =====
otel.agent.control.http.base.path=/v1/control      # HTTP 基础路径
otel.agent.control.http.long.poll.timeout=60s      # 长轮询超时

# ===== 轮询间隔 =====
otel.agent.control.config.poll.interval=30s        # 配置轮询间隔
otel.agent.control.task.poll.interval=10s          # 任务轮询间隔
otel.agent.control.status.report.interval=60s      # 状态上报间隔

# ===== 健康监控配置 =====
otel.agent.control.health.window.size=100          # 滑动窗口大小
otel.agent.control.health.healthy.threshold=0.9    # 健康阈值
otel.agent.control.health.unhealthy.threshold=0.5  # 不健康阈值

# ===== 任务结果配置 =====
otel.agent.control.task.result.compression.threshold=1KB    # 压缩阈值
otel.agent.control.task.result.chunked.threshold=50MB       # 分片阈值
otel.agent.control.task.result.chunk.size=10MB              # 分片大小
otel.agent.control.task.result.max.size=200MB               # 最大限制

# ===== 持久化配置 =====
otel.agent.control.storage.dir=~/.otel-agent/control       # 存储目录
otel.agent.control.storage.max.files=100                   # 最大文件数
otel.agent.control.storage.max.size=50MB                   # 最大存储空间

# ===== 重试配置 =====
otel.agent.control.retry.max.attempts=5            # 最大重试次数
otel.agent.control.retry.initial.backoff=1s        # 初始退避时间
otel.agent.control.retry.max.backoff=30s           # 最大退避时间
otel.agent.control.retry.backoff.multiplier=2.0    # 退避倍数
```

## 四、通信协议设计

### 4.1 请求/响应 DTO

#### ConfigRequest
```java
interface ConfigRequest {
    String getAgentId();                // Agent 唯一标识
    String getCurrentConfigVersion();   // 当前配置版本
    String getCurrentEtag();            // ETag (用于缓存)
    long getLongPollTimeoutMillis();    // 长轮询超时
}
```

#### ConfigResponse
```java
interface ConfigResponse {
    boolean isSuccess();
    boolean hasChanges();               // 是否有配置变更
    String getConfigVersion();          // 新配置版本
    String getEtag();                   // 新 ETag
    byte[] getConfigData();             // 配置数据 (Protobuf)
    String getErrorMessage();
    long getSuggestedPollIntervalMillis();  // 建议的轮询间隔
}
```

#### TaskInfo
```java
interface TaskInfo {
    String getTaskId();                 // 任务 ID
    String getTaskType();               // 任务类型
    String getParametersJson();         // 任务参数 (JSON)
    int getPriority();                  // 优先级
    long getTimeoutMillis();            // 执行超时
    long getCreatedAtUnixNano();        // 创建时间
    long getExpiresAtUnixNano();        // 过期时间
}
```

### 4.2 Agent 身份标识

```java
public interface AgentIdentity {
    String getAgentId();        // 格式: {hostname}-{pid}-{startTime}
    String getHostname();       // 主机名
    long getPid();              // 进程 ID
    long getStartTime();        // 启动时间
    String getServiceName();    // 服务名
    String getServiceNamespace();// 服务命名空间
    String getSdkVersion();     // SDK 版本
}
```

## 五、Collector 端实现指导

### 5.1 需要实现的 API

```
POST /v1/control/config
POST /v1/control/tasks
POST /v1/control/status
POST /v1/control/upload-chunk
```

### 5.2 配置下发协议 (Protobuf)

```protobuf
message AgentConfig {
    string config_version = 1;
    SamplerConfig sampler = 2;
    BatchConfig batch = 3;
    map<string, string> dynamic_resource_attributes = 4;
    string extension_config_json = 5;
}

message SamplerConfig {
    enum SamplerType {
        ALWAYS_ON = 0;
        ALWAYS_OFF = 1;
        TRACE_ID_RATIO = 2;
        PARENT_BASED = 3;
        RULE_BASED = 4;
    }
    SamplerType type = 1;
    double ratio = 2;
}

message BatchConfig {
    int32 max_export_batch_size = 1;
    int32 max_queue_size = 2;
    int64 schedule_delay_millis = 3;
    int64 export_timeout_millis = 4;
}
```

### 5.3 任务协议 (Protobuf)

```protobuf
message Task {
    string task_id = 1;
    string task_type = 2;           // 如: "heap_dump", "thread_dump", "config_export"
    string parameters_json = 3;
    int32 priority = 4;
    int64 timeout_millis = 5;
    int64 created_at_unix_nano = 6;
    int64 expires_at_unix_nano = 7;
}

message TaskResult {
    string task_id = 1;
    string status = 2;              // "SUCCESS", "FAILED", "TIMEOUT"
    bytes result_data = 3;
    string error_message = 4;
    int64 completed_at_unix_nano = 5;
}
```

### 5.4 状态上报协议

```protobuf
message AgentStatus {
    string agent_id = 1;
    int64 timestamp_unix_nano = 2;
    HealthStatus health = 3;
    repeated TaskResult completed_tasks = 4;
    map<string, string> metrics = 5;
}

message HealthStatus {
    string state = 1;               // "HEALTHY", "DEGRADED", "UNHEALTHY"
    double success_rate = 2;
    int64 success_count = 3;
    int64 failure_count = 4;
    string current_config_version = 5;
}
```

## 六、opentelemetry-java-instrumentation 集成指导

### 6.1 集成方式

通过 SPI 机制自动集成:

```java
// META-INF/services/io.opentelemetry.sdk.autoconfigure.spi.AutoConfigurationCustomizerProvider
io.opentelemetry.sdk.extension.controlplane.spi.ControlPlaneAutoConfigurationProvider
```

### 6.2 自动配置流程

```
1. Resource 自定义 → 初始化 Agent 身份
2. Sampler 自定义 → 包装为 DynamicSampler
3. SpanExporter 自定义 → 包装为 HealthMonitoringSpanExporter
4. TracerProvider 自定义 → 启动 ControlPlaneManager
```

### 6.3 扩展点

```java
// 注册自定义可热更新组件
configManager.registerComponent("custom", config -> {
    // 处理自定义配置
});

// 监听配置变更
configManager.addListener((config, applied, failed) -> {
    // 处理配置变更事件
});

// 监听健康状态变化
healthMonitor.addListener((previous, current) -> {
    // 处理健康状态变化
});
```

## 七、关键设计原则

### 7.1 OTLP 优先原则
- 控制平面连接依赖 OTLP 健康状态
- OTLP 不健康时暂停控制平面连接
- 避免在数据链路故障时增加额外负担

### 7.2 配置复用原则
- 复用 OTLP 的 endpoint、protocol、headers 配置
- 控制平面服务部署在同一 Collector 上
- 减少配置复杂度

### 7.3 优雅降级原则
- 控制平面故障不影响核心数据链路
- 支持本地持久化和重试
- 支持大结果分片上传

### 7.4 热更新原则
- 所有配置支持运行时更新
- 无需重启应用
- 版本控制和部分生效支持

---
