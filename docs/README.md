# 可观测性工程师的技术博客

> 专注 APM / OpenTelemetry / Arthas 方向，记录真实的方案设计与问题排查

---

## ⭐ 代表作

### 方案设计

| 文章 | 关键词 |
|------|--------|
| [OTel 延迟采样方案设计](/observability/design/otel-tail-based-sampling.md) | 头部采样 vs 尾部采样、完整架构决策、性能优化 |
| [服务拓扑图实现方案](/observability/design/service-topology-design.md) | peer.service 配对、Redis 分层架构、实时拓扑 |
| [Java Agent 控制平面架构](/observability/implementation/otel-java-agent-control-plane.md) | 远程配置下发、零重启生效、长连接 + 任务系统 |

### 深度排查

| 文章 | 关键词 |
|------|--------|
| [一次 HPROF 解析器的深度调试之旅](/java/一次Java%20HPROF解析器的深度调试之旅.md) | 二进制格式解析、6→37077 类、逐字节定位 |
| [Arthas SpyAPI 初始化机制分析](/observability/arthas/otel-arthas-spyapi-initialization.md) | 二次 attach 空转、可证伪指标定位、根因修复 |
| [Bootstrap ClassLoader 注入修复](/observability/implementation/otel-bootstrap-classloader-injection.md) | 类加载隔离、Agent 与宿主冲突、源码级排查 |

### 工程实现

| 文章 | 关键词 |
|------|--------|
| [控制面长连接与任务系统](/observability/implementation/otel-controlplane-longpoll-task-system.md) | 事件驱动、状态机、自愈机制 |
| [Arthas Tunnel 分布式架构升级](/observability/arthas/otel-arthas-tunnel-distributed-upgrade.md) | Redis Lua 精度丢失修复、分布式一致性 |
| [Arthas 生命周期管理](/observability/arthas/otel-arthas-lifecycle-management.md) | attach/detach 全链路闭环、异常自愈 |

---

## 📂 全部内容

### 📡 可观测性 & APM

**方案设计**
- [OTel 延迟采样方案设计](/observability/design/otel-tail-based-sampling.md)
- [服务拓扑图实现方案设计](/observability/design/service-topology-design.md)
- [peer.service 拓扑补齐方案](/observability/design/peer-service-topology-design.md)
- [动态类增强与还原调研](/observability/design/otel-dynamic-instrumentation-design.md)

**工程实现**
- [Java Agent 控制平面架构](/observability/implementation/otel-java-agent-control-plane.md)
- [控制面长连接与任务系统](/observability/implementation/otel-controlplane-longpoll-task-system.md)
- [Bootstrap ClassLoader 注入修复](/observability/implementation/otel-bootstrap-classloader-injection.md)

**Arthas 深度集成**
- [Arthas Tunnel Extension](/observability/arthas/otel-arthas-tunnel-extension.md)
- [Arthas 生命周期管理](/observability/arthas/otel-arthas-lifecycle-management.md)
- [Arthas Tunnel 分布式升级](/observability/arthas/otel-arthas-tunnel-distributed-upgrade.md)
- [Arthas SpyAPI 初始化机制分析](/observability/arthas/otel-arthas-spyapi-initialization.md)

### ☕ Java 深度

- [HPROF 解析器调试之旅](/java/一次Java%20HPROF解析器的深度调试之旅.md)
- [Arthas AnsiLog 可配置输出流方案](/java/arthas-ansilog-configurable-printstream.md)
- [Arthas + async-profiler 性能分析](/java/arthas-async-profiler.md)

### 🗄️ 数据库

- [MySQL 联合索引优化实战](/database/mysql-index-optimization-case.md)

### 🔢 算法

- [翻转链表：把一个「简单」问题讲透](/algorithms/list/reverse-linked-list.md) — 4 种实现 + 复杂度推导 + 执行过程动画

### 🧱 设计原则与模式

- [系列导读](/design-principles/README.md) — 六大原则 + 23 模式 + 业务实践，以 APM 四层架构为贯穿案例
- [六大设计原则](/design-principles/01-principles/01-srp.md) — SRP/OCP/LSP/ISP/DIP/LoD 一条因果链，从「变化」讲起
- [工程实践原则](/design-principles/02-engineering/01-cohesion-coupling.md) — 高内聚低耦合 / 可扩展性 / 健壮性 / 可测试性
- [设计模式总纲](/design-principles/03-patterns/overview.md) — 三分类地图 + 「原则→模式」映射表 + 23 模式 APM 落点
- [23 种设计模式](/design-principles/03-patterns/creational/factory-method.md) — 创建型 5 / 结构型 7 / 行为型 11，每篇含 APM 真实落点与 Go 代码
- [业务实践](/design-principles/04-practice/01-real-world-refactor.md) — 重构实战完整闭环 + 反模式与过度设计
- [Agent 时代](/design-principles/05-agent-era/design-with-ai-agent.md) — 用设计原则指挥 AI 写「能改」的代码

### 🛠️ 工程实践

- [Lima + Docker + Minikube 环境搭建](/mac/lima-docker-minikube-setup.md)

### 🎵 音乐笔记

- [吉他学习笔记](/music/guitar-learning.md) — 从乐理基础到进阶调式系统的完整学习记录

---

<p align="center">
  <sub>📅 持续更新中 · 专注深度，拒绝水文</sub>
</p>
