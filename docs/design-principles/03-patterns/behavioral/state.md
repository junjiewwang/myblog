# 状态模式：把「状态」变成对象，消灭 if-else 状态机

> 一句话：**让对象的行为随内部状态改变，并把「每个状态的行为」封装成独立的类。**
> 当一个对象的「行为」由它的「状态」决定，且状态会变时，用状态模式。

---

## 它解决什么尴尬

一个对象有多个状态，每个状态下同一个动作的行为不同。最直接的写法是用「枚举 + if-else」做状态机——但状态一多，`if` 就密密麻麻地铺满每个方法，改一个状态要动好几处。

---

## 真实案例：探针（Arthas）的生命周期状态机

你的 [Arthas 生命周期管理](/observability/arthas/otel-arthas-lifecycle-management.md) 里，明确写了一个状态机（`【实测】`）：

```
STOPPED → STARTING → RUNNING → IDLE → STOPPING → STOPPED
```

它实际用的是「枚举 + 守卫」的**简单状态机**写法：

```go
// Arthas 实际做法：枚举 + 条件守卫（简单状态机）
const (
    Stopped State = iota
    Starting
    Running
    Idle
    Stopping
)

func (l *Lifecycle) tryStart() {
    if l.state != Stopped { // 守卫：只有 STOPPED 才能启动
        return
    }
    l.state = Starting
    // 启动 + 看门狗 + 就绪等待...
}
```

这种写法在**状态少、转换简单**时完全够用，也是最务实的做法。

但假设生命周期再复杂一点——比如不同状态下「收到停止信号」「收到外部信号回灌」的行为都不一样，`if l.state == X` 就会散落在 `tryStart`、`syncStopped`、`onExternalSignal` 等多个方法里，形成**散布的状态判断**。这时候，状态模式登场。

---

## Go 代码（状态模式）

```go
// 状态接口：把「每个状态的行为」封装成对象
type State interface {
    Name() string
    OnStart(l *Lifecycle) error
    OnStop(l *Lifecycle) error
}

// 状态 1：STOPPED——允许启动，已停止则无需再停
type StoppedState struct{}

func (s *StoppedState) Name() string { return "STOPPED" }
func (s *StoppedState) OnStart(l *Lifecycle) error {
    l.setState(&StartingState{})
    return l.bootstrap.start()
}
func (s *StoppedState) OnStop(l *Lifecycle) error { return nil } // 已停，幂等

// 状态 2：RUNNING——不允许重复启动，允许停止
type RunningState struct{}

func (s *RunningState) Name() string { return "RUNNING" }
func (s *RunningState) OnStart(l *Lifecycle) error {
    return ErrAlreadyRunning // 契约：运行中不能重复启动
}
func (s *RunningState) OnStop(l *Lifecycle) error {
    l.setState(&StoppingState{})
    return l.bootstrap.stop()
}

// 上下文：只持有当前状态，行为委托给状态对象
type Lifecycle struct {
    state     State
    bootstrap *Bootstrap
}

func (l *Lifecycle) Start() error { return l.state.OnStart(l) } // 委托
func (l *Lifecycle) Stop() error  { return l.state.OnStop(l) }
func (l *Lifecycle) setState(s State) { l.state = s }
```

现在，`Start()` / `Stop()` 里**没有任何 if-else**——每个状态自己决定「在我这个状态下，这个动作该怎么做」。加一个新状态 = 新增一个 `State` 实现，上下文不用改。

<details>
<summary>💭 想一想：状态模式和策略模式长得像，到底差在哪？</summary>

**答案**：差在「**谁来决定切换**」。
- **策略模式**：切换由**外部调用方**决定（`SamplerService` 注入哪个 `Sampler`）；
- **状态模式**：切换由**状态自身**决定（`StoppedState.OnStart` 内部把自己 `setState` 成 `StartingState`）。

所以策略的各个实现「互相不知道对方」，而状态的各个实现「明确知道下一个状态是谁」。**状态模式管理的是一张有向的状态转换图，策略模式管理的是一组平级的可选项。**

</details>

---

## 对应原则

- **SRP**：把「每个状态的行为」拆成独立类，消除一个类里的大段状态判断；
- **OCP**：加新状态不改上下文，只新增状态类；
- **LSP**：每个 `State` 实现都兑现 `OnStart/OnStop` 契约（如 `RunningState` 明确「拒绝重复启动」）。

## 何时别用（红线）

1. **状态少、转换简单时，别上状态模式**。Arthas 那种「枚举 + 守卫」才是正确选择——状态模式会为 6 个状态造出 6 个类，性价比极低。**先用简单状态机，等 if-else 真的爆炸了再重构。**
2. **状态转换规则本身不稳定时**，状态模式让转换关系散落在各状态类里，反而难看清「完整的状态图」。此时用「转换表」可能更清晰。
3. **别把「多个布尔标志」硬说成状态**。只有真正互斥、且驱动行为变化的状态，才值得建模。

---

<details>
<summary>📌 本文事实来源</summary>

- 探针生命周期状态机 STOPPED→STARTING→RUNNING→IDLE→STOPPING→STOPPED、看门狗、外部信号回灌（syncStoppedFromExternalSignal）：`【实测】` [Arthas 生命周期管理](/observability/arthas/otel-arthas-lifecycle-management.md)
- 状态模式定义、与策略模式的区别：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为「真实状态机的模式化示意」 `【推断】`

</details>
