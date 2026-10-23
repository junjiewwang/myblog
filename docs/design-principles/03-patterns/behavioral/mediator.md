# 中介者模式：让一组对象「都只和一个中间人说话」

> 一句话：**用一个中介对象，集中协调多个对象之间的交互，让它们互相不直接依赖。**
> N 个对象从「两两直连」收敛为「都连中介者」。

---

## 它解决什么尴尬

一组对象需要**互相协作**，如果让它们两两直接调用，对象越多，连接越爆炸（N 个对象 → N×(N-1) 条连接），改一个对象要动一堆。

中介者模式引入一个「中间人」，所有对象只和它交互，由它统一协调——**把多对多，收敛成一对多。**

---

## 真实案例：ControlPlaneManager 协调三个调度器

你的 [Java Agent 控制平面](/observability/implementation/otel-java-agent-control-plane.md) 里，`ControlPlaneManager` 协调着三个调度器（`【实测】`）：

```
ControlPlaneManager
├── ConfigPoll Scheduler    # 配置轮询
├── TaskPoll Scheduler      # 任务轮询
└── StatusReport Scheduler  # 状态上报
```

这三个调度器**彼此不直接对话**——比如「任务执行结果」不该由 `TaskPoll` 直接塞给 `StatusReport`，而是统一交给 `ControlPlaneManager` 协调转发。`ControlPlaneManager` 就是那个「中间人」。

> 诚实说明：在 Go 工程里，中介者模式用得不多，常被「组合 + 门面」替代。但它「集中协调、让组件互不直连」的思想，在你的控制平面里真实存在。

---

## Go 代码

```go
// 中介者：集中协调各组件，组件之间不直接依赖
type ControlPlaneManager struct {
    configPoller  *ConfigPollScheduler
    taskPoller    *TaskPollScheduler
    statusReporter *StatusReportScheduler
}

// 任务执行结果 → 统一走 Manager 转发给状态上报器，而不是 TaskPoll 直接调 StatusReport
func (m *ControlPlaneManager) OnTaskFinished(result TaskResult) {
    m.statusReporter.Report(result) // 中间人统一协调
}

// 组件只依赖中介者，不依赖其他组件
type TaskPollScheduler struct {
    manager *ControlPlaneManager
}

func (t *TaskPollScheduler) poll() {
    result := t.executeTask()
    t.manager.OnTaskFinished(result) // 交给中介者，而不是直接找 StatusReport
}
```

这样，`TaskPollScheduler` 不需要知道 `StatusReportScheduler` 的存在；将来加一个「日志上报器」，也只需在中介者里加转发逻辑，组件之间无感。

<details>
<summary>💭 想一想：中介者模式最大的代价是什么？</summary>

**答案**：是「**中介者本身变成上帝对象**」。所有协调逻辑都集中到中介者身上，组件是解耦了，但中介者会越来越大、越来越复杂，成为新的耦合中心。所以中介者模式是一把双刃剑：**它能消除组件间的网状依赖，但代价是制造一个庞大的中介者**。判断标准是：如果协调逻辑本身很复杂，别硬塞给一个中介者，考虑拆分成多个更小范围的协调者。

</details>

---

## 对应原则

- **LoD**：组件只和中介者这个「直接朋友」打交道，不认识彼此；
- **SRP**：把「交互/协调」的职责从各组件中剥离，集中到中介者；
- **OCP**：加新组件 = 在中介者加转发，不改已有组件。

## 何时别用（红线）

1. **组件之间交互简单、数量少**：直接调用更清晰，别为 2 个对象上中介者。
2. **协调逻辑会不断膨胀**：中介者模式会把复杂度「搬」到中介者，而非「消」掉，要警惕中介者变成上帝类。
3. **Go 里优先考虑组合/门面**：中介者模式源自「对象互相发消息」的场景，Go 的显式调用风格下，先用简单组合，确有必要再上中介者。

---

<details>
<summary>📌 本文事实来源</summary>

- ControlPlaneManager 协调 ConfigPoll/TaskPoll/StatusReport 三调度器：`【实测】` [Java Agent 控制平面](/observability/implementation/otel-java-agent-control-plane.md)
- 中介者模式定义：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为示意性简化 `【推断】`

</details>
