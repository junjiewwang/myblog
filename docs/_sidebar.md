<!-- 侧边栏导航 -->

* **🏠 首页**
  * [首页](/)

* **📡 可观测性 & APM**
  * **📐 方案设计**
    * [OTel 延迟采样方案设计](/observability/design/otel-tail-based-sampling.md)
    * [服务拓扑图实现方案设计](/observability/design/service-topology-design.md)
    * [peer.service 拓扑补齐方案](/observability/design/peer-service-topology-design.md)
    * [动态类增强与还原调研](/observability/design/otel-dynamic-instrumentation-design.md)
  * **🔨 工程实现**
    * [Java Agent 控制平面架构](/observability/implementation/otel-java-agent-control-plane.md)
    * [控制面长连接与任务系统](/observability/implementation/otel-controlplane-longpoll-task-system.md)
    * [Bootstrap ClassLoader 注入修复](/observability/implementation/otel-bootstrap-classloader-injection.md)
  * **🔧 Arthas 深度集成**
    * [Arthas Tunnel Extension](/observability/arthas/otel-arthas-tunnel-extension.md)
    * [Arthas 生命周期管理](/observability/arthas/otel-arthas-lifecycle-management.md)
    * [Arthas Tunnel 分布式升级](/observability/arthas/otel-arthas-tunnel-distributed-upgrade.md)
    * [Arthas SpyAPI 初始化机制分析](/observability/arthas/otel-arthas-spyapi-initialization.md)
  * **📊 指标存储**
    * [一个指标的冒险之旅](/observability/victoriametrics/metric-journey.md)
    * [🏰 健忘的守门人：布隆过滤器](/observability/victoriametrics/bloom-filter-gatekeeper.md)
    * [Go 高并发技巧](/observability/victoriametrics/go-concurrency-primitives.md)

* **☕ Java 深度**
  * [Java HPROF 解析器调试之旅](/java/一次Java%20HPROF解析器的深度调试之旅.md)
  * [Arthas AnsiLog 可配置输出流方案](/java/arthas-ansilog-configurable-printstream.md)
  * [Arthas + async-profiler 性能分析](/java/arthas-async-profiler.md)

* **🤖 AI 工程**
  * [上下文工程：跨会话记忆共享的挑战与方案](/ai-engineering/context-engineering-thinking.md)
  * [AI Agent 面试 31 问：从原理到生产的深度回答指南](/ai-engineering/ai-agent-interview-guide.md)

* **🗄️ 数据库**
  * [MySQL 联合索引优化实战](/database/mysql-index-optimization-case.md)

* **🔢 算法**
  * **🔗 链表**
    * [翻转链表](/algorithms/list/reverse-linked-list.md)
  * *（树 / 排序 / 图 / 动态规划 待补充）*

* **🧱 设计原则与模式**
  * **📖 序章**
    * [为什么 AI 时代更需要设计原则](/design-principles/00-prologue/why-design-principles.md)
  * **📐 六大设计原则**
    * [单一职责 SRP](/design-principles/01-principles/01-srp.md)
    * [开放封闭 OCP](/design-principles/01-principles/02-ocp.md)
    * [里氏替换 LSP](/design-principles/01-principles/03-lsp.md)
    * [接口隔离 ISP](/design-principles/01-principles/04-isp.md)
    * [依赖倒置 DIP](/design-principles/01-principles/05-dip.md)
    * [迪米特法则 LoD](/design-principles/01-principles/06-lod.md)
  * **🛠️ 工程实践原则**
    * [高内聚低耦合](/design-principles/02-engineering/01-cohesion-coupling.md)
    * [可扩展性](/design-principles/02-engineering/02-extensibility.md)
    * [健壮性](/design-principles/02-engineering/03-robustness.md)
    * [可单元测试](/design-principles/02-engineering/04-testability.md)
  * **⚙️ 设计模式**
    * [设计模式总纲](/design-principles/03-patterns/overview.md)
    * **🏗️ 创建型**
      * [工厂方法](/design-principles/03-patterns/creational/factory-method.md)
      * [抽象工厂](/design-principles/03-patterns/creational/abstract-factory.md)
      * [建造者](/design-principles/03-patterns/creational/builder.md)
      * [单例](/design-principles/03-patterns/creational/singleton.md)
      * [原型](/design-principles/03-patterns/creational/prototype.md)
    * **🧩 结构型**
      * [适配器](/design-principles/03-patterns/structural/adapter.md)
      * [装饰器](/design-principles/03-patterns/structural/decorator.md)
      * [门面](/design-principles/03-patterns/structural/facade.md)
      * [组合](/design-principles/03-patterns/structural/composite.md)
      * [代理](/design-principles/03-patterns/structural/proxy.md)
      * [桥接](/design-principles/03-patterns/structural/bridge.md)
      * [享元](/design-principles/03-patterns/structural/flyweight.md)
    * **🔀 行为型**
      * [策略](/design-principles/03-patterns/behavioral/strategy.md)
      * [观察者](/design-principles/03-patterns/behavioral/observer.md)
      * [状态](/design-principles/03-patterns/behavioral/state.md)
      * [模板方法](/design-principles/03-patterns/behavioral/template-method.md)
      * [责任链](/design-principles/03-patterns/behavioral/chain-of-responsibility.md)
      * [命令](/design-principles/03-patterns/behavioral/command.md)
      * [中介者](/design-principles/03-patterns/behavioral/mediator.md)
      * [备忘录](/design-principles/03-patterns/behavioral/memento.md)
      * [迭代器](/design-principles/03-patterns/behavioral/iterator.md)
      * [解释器](/design-principles/03-patterns/behavioral/interpreter.md)
      * [访问者](/design-principles/03-patterns/behavioral/visitor.md)
  * **🏭 业务实践**
    * [重构实战：600 行 if-else 的救赎](/design-principles/04-practice/01-real-world-refactor.md)
    * [反模式与过度设计](/design-principles/04-practice/02-anti-patterns.md)
  * **🤖 Agent 时代**
    * [用设计原则给 AI 写 Prompt](/design-principles/05-agent-era/design-with-ai-agent.md)

* **🛠️ 工程实践**
  * [Lima + Docker + Minikube 环境搭建](/mac/lima-docker-minikube-setup.md)

* **🎵 音乐笔记**
  * **🎸 学习路线**
    * [吉他学习笔记](/music/guitar-learning.md)
    * [进阶学习计划](/music/guitar-advanced-plan.md)
  * **🎼 乐理基础**
    * [节奏系统基础](/music/rhythm-system-foundation.md)
    * [指板音名图](/music/guitar-fretboard.md)
    * [音级与功能和声](/music/guitar-scale-degrees.md)
    * [自然大调音阶](/music/guitar-major-scales.md)
    * [五度圈](/music/guitar-circle-of-fifths.md)
    * [调式与组成音](/music/guitar-modes.md)
    * [七调式系统教程](/music/guitar-modes-tutorial.md)
  * **🎯 和弦与音阶系统**
    * [和弦系统基础（C调）](/music/chord-system-foundation.md)
    * [CAGED 和弦系统](/music/guitar-caged.md)
    * [和弦转位与指板](/music/guitar-chord-inversions.md)
    * [Drop2 和弦与转位](/music/guitar-drop2.md)
    * [3NPS 音阶系统](/music/guitar-3nps.md)
  * **🛠️ 工具与实践**
    * [AlphaTex 编谱实战指南](/music/guitar-alphatex-guide.md)
  * **🎹 其他**
    * [五线谱快速记忆](/music/piano-staff-memory.md)

* **📄 关于我**
  * [简历](/resume/README.md)
