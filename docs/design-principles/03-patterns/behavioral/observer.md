# 观察者模式：状态变了，自动通知「关心的人」

> 一句话：**建立一对多的依赖，一个对象状态变化时，自动通知所有依赖它的对象。**
> 也叫「发布-订阅」。

---

## 它解决什么尴尬

一个对象的状态变了，有**多个**对象关心这个变化，但**它不该知道**这些对象是谁。比如：探针状态从 `STARTING` 变成 `RUNNING`，可能同时有「日志模块」「看门狗」「状态上报器」都想收到通知——如果探针硬编码去挨个调用它们，就耦合死了。

观察者模式让「变化方」和「关心方」解耦：变化方只管「广播」，不关心谁在听。

---

## 真实案例：Arthas 的 StateEventBus

你的 [Arthas 生命周期管理](/observability/arthas/otel-arthas-lifecycle-management.md) 里，有一个 `ArthasStateEventBus`（`【实测】`），专门做这件事：

> 生命周期状态变化（`StateEvent.STARTING / RUNNING / STOPPED`）通过事件总线发布，多个订阅者各自响应——正是观察者模式的落地。

关键点：状态机发布 `StateEvent.RUNNING` 时，它**不知道**、也**不需要知道**有哪些订阅者在听。

---

## Go 代码

```go
// 事件：状态变化
type StateEvent int

const (
    Starting StateEvent = iota
    Running
    Stopped
)

// 观察者：收到事件的回调
type Listener func(event StateEvent, reason string)

// 被观察者：事件总线，负责订阅与广播
type EventBus struct {
    mu        sync.RWMutex
    listeners map[StateEvent][]Listener
}

func NewEventBus() *EventBus {
    return &EventBus{listeners: make(map[StateEvent][]Listener)}
}

// 订阅：某个模块"关心"某类事件
func (b *EventBus) Subscribe(event StateEvent, l Listener) {
    b.mu.Lock()
    defer b.mu.Unlock()
    b.listeners[event] = append(b.listeners[event], l)
}

// 发布：状态变化时广播，不关心谁在听
func (b *EventBus) Publish(event StateEvent, reason string) {
    b.mu.RLock()
    ls := append([]Listener(nil), b.listeners[event]...) // 拷贝，避免并发修改
    b.mu.RUnlock()
    for _, l := range ls {
        l(event, reason)
    }
}
```

```go
// 状态机：只负责发布，不负责通知谁
func (m *LifecycleManager) setState(s State) {
    m.state = s
    m.eventBus.Publish(StateEvent(s), "state changed")
}

// 订阅方 1：状态上报器
m.eventBus.Subscribe(Running, func(e StateEvent, reason string) {
    emitter.reportRunning() // 上报 RUNNING 到控制面
})

// 订阅方 2：看门狗
m.eventBus.Subscribe(Stopped, func(e StateEvent, reason string) {
    watchdog.reset() // 停止时重置看门狗
})
```

<details>
<summary>💭 想一想：观察者模式的核心价值，是「自动通知」还是「解耦」？</summary>

**答案**：是**解耦**。「自动通知」只是表象。真正的价值在于：**状态变化方（发布者）和响应方（订阅者）互相不知道对方的存在**。你可以随时增删订阅者，而发布者一行代码都不用改。这也正是 LoD（最少知识）的体现——发布者只和「事件总线」这个直接朋友打交道，不和任何具体订阅者打交道。

</details>

---

## 对应原则

- **LoD**：发布者只认事件总线，不认识具体订阅者；
- **DIP**：订阅者依赖「事件」抽象，而非具体发布者；
- **SRP**：把「状态变化」和「响应变化」拆给不同的模块。

## 何时别用（红线）

1. **同步调用就够时别硬上**。如果只有一个响应者、且调用顺序固定，直接函数调用更清晰，事件总线反而掩盖了调用关系。
2. **警惕「事件满天飞」**：订阅关系太多时，一个事件触发一串不可见的调用链，调试起来像在追「幽灵」。事件要有明确的命名和职责。
3. **注意并发安全**：`Publish` 里回调可能被并发执行，订阅/取消订阅要加锁（上面代码已用 `RWMutex` + 拷贝兜底）。

---

<details>
<summary>📌 本文事实来源</summary>

- ArthasStateEventBus、StateEvent.STARTING/RUNNING/STOPPED、状态订阅：`【实测】` [Arthas 生命周期管理](/observability/arthas/otel-arthas-lifecycle-management.md)
- 观察者模式定义：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为示意性简化 `【推断】`

</details>
