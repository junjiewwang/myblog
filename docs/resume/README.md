# 个人简历

> 5 年+后端开发经验，专注可观测性（APM）方向。工作之余深入研究 OpenTelemetry、Arthas 等开源项目，独立设计并实现了 Java Agent 远程控制平面、Arthas 生命周期管理等系统。擅长字节码增强、分布式诊断平台设计、JVM 深度调优。

---

## 基本信息

- **方向**：后台开发（Java / Go）· 可观测性 / APM
- **经验**：5 年+（2020 年毕业）
- **学历**：本科 · 计算机科学与技术 · 西安工业大学
- **证书**：CET-6 · 软考中级（软件设计师）
- **联系**：[📧 Email](mailto:wangjj815@foxmail.com) · [💻 GitHub](https://github.com/junjiewwang)

---

## 技能

| 领域 | 技能栈 | 掌握程度 |
|------|--------|---------|
| 核心语言 | Java、Go | 深入 JVM 内存模型 / 字节码 / 类加载机制 |
| 可观测性 | OpenTelemetry、Arthas、ByteBuddy | 源码级研究，有 Issue 反馈与方案设计 |
| 通信协议 | gRPC / Protobuf / WebSocket / 长轮询 | 独立设计控制面协议 |
| 中间件 | MySQL、Redis、Kafka、ElasticSearch | 生产使用与调优经验 |
| 基础设施 | Docker、Kubernetes、Linux | 容器化部署与运维 |
| 框架 | Spring Boot、Gin | 微服务开发 |

---

## 工作经历

### 某头部云厂商 · 后端开发工程师 · 2022.03 - 至今

**团队**：可观测性平台（APM / 基础监控）

- 参与 APM 产品日常需求开发与迭代
- 参与私有化项目交付，适配多客户环境
- 参与核心链路性能调优，排查 JVM 内存泄漏与 FullGC 问题
- 负责部分模块的 Bug 修复与稳定性优化

### 某央企研发中心 · Java 开发工程师 · 2020.01 - 2022.02

**团队**：数字中台

- 负责资源调度微服务的需求分析、设计与开发（容器调度、故障迁移、健康检测）
- 基于 Spring Boot + Etcd + Docker 实现计算代理集群管理

---

## 技术项目（个人研究与实践）

> 以下项目基于工作中观察到的真实痛点，利用业余时间独立设计、实现与验证，完整代码与设计文档均可展示。

### Agent 远程控制平面

**痛点**：生产环境大量 Java Agent 实例缺乏统一管控能力，配置变更需逐个重启

**方案**：设计基于 Protobuf + 长轮询的分布式管控架构，支持配置热更新、采样策略下发与远程诊断；采用 AtomicReference 无锁热切换 + 指数退避重连 + 4 态连接状态机保障可靠性

**成果**：配置下发 P99 < 1s，指令到达率 > 99.5%（本地压测验证）

[→ 详细设计文档](projects/agent-control-plane.md)

### Arthas 生命周期管理

**痛点**：Arthas 依赖人工 SSH 逐台操作，状态黑盒，异常难恢复

**方案**：设计 6 态生命周期状态机（STOPPED → STARTING → RUNNING → IDLE → STOPPING），实现启动看门狗（60s 超时）、Tunnel 断线治理（5 分钟重连窗口 + 超时销毁）、幂等分发与任务时效校验

**成果**：连接成功率从模拟场景的 ~85% 提升至 99.9%+，故障可自愈

[→ 详细设计文档](projects/arthas-tunnel-extension.md)

### HPROF 解析器调试

**痛点**：解析大堆快照时数据严重丢失，仅识别到 6 个类

**方案**：通过字节级偏移追踪 + xxd 原始字节对比，定位到 CLASS_DUMP 解析时少跳过 1 个 reserved ID 字段导致后续所有记录偏移错乱

**成果**：类识别 6 → 37,077，gcRoots 3 → 7,030

[→ 详细调试记录](/java/一次Java%20HPROF解析器的深度调试之旅.md)

### 分布式 Arthas Tunnel 架构升级

**痛点**：跨节点 WebSocket 代理连接失败率高

**方案**：定位 Redis Lua 中 cjson 对 19 位时间戳的科学计数法精度丢失问题，统一为 13 位 UnixMilli；实现内部专用入口解耦内外协议

**成果**：跨节点代理延迟 < 50ms，连接成功率 99.9%+

[→ 详细设计文档](/observability/arthas/otel-arthas-tunnel-distributed-upgrade.md)

---

## 核心能力

**可观测性**：OpenTelemetry · Arthas · 链路追踪 · 指标采集

**JVM 深度**：ByteBuddy 字节码增强 · 类加载机制 · 内存泄漏排查 · FullGC 调优

**系统设计**：分布式控制面 · 状态机 · 长连接通信 · SPI 插件化 · 优雅降级

**工程实践**：设计模式（8+ 种实践应用）· 协议设计（Protobuf）· 容错与自愈

---

## 其他

- **开源参与**：向 Arthas 反馈 Agent 内嵌场景日志冲突问题（[Issue #3126](https://github.com/alibaba/arthas/issues/3126)），后续 4.1.5 版本已支持
- **技术输出**：维护[技术博客](/)，持续记录可观测性源码研究、JVM 调优与系统设计实践
- **自驱学习**：所有技术项目均为业余时间独立完成，源于对可观测性领域的持续深耕
