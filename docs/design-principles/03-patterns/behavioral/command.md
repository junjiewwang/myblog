# 命令模式：把「动作」封装成对象

> 一句话：**把一个「请求/动作」封装成对象，让「发出动作的人」和「执行动作的人」解耦。**
> 命令可以被排队、延迟执行、记录日志、甚至撤销。

---

## 它解决什么尴尬

有一类「动作」需要被当作「数据」来对待——要下发、要排队、要记录、可能要撤销。如果动作只是「直接调一个函数」，那「下发一个任务」「重放一批任务」「记录任务历史」都做不了。

命令模式把「动作」封装成对象，让它像数据一样被传递、存储、执行。

---

## 真实案例：控制平面的 Task 下发

你的 [Java Agent 控制平面](/observability/implementation/otel-java-agent-control-plane.md) 里，控制面会通过 **Task API** 给 Agent 下发任务（`【实测】`）——比如 `arthas_attach`、`arthas_detach`。这些任务本质上就是「命令」：控制面（发出方）不关心 Agent 具体怎么执行，Agent（执行方）拿到命令对象后执行。

关键点：任务被**序列化下发、排队、由 TaskDispatcher 统一执行**——这正是命令模式「动作当数据」的价值。

---

## Go 代码

```go
// 命令接口：所有任务动作的统一契约
type Command interface {
    Execute(ctx TaskContext) TaskResult
}

// 具体命令 1：attach
type AttachCommand struct{ PID int }

func (c *AttachCommand) Execute(ctx TaskContext) TaskResult {
    // 启动 Arthas + 等待就绪
    return attachArthas(c.PID)
}

// 具体命令 2：detach
type DetachCommand struct{ PID int }

func (c *DetachCommand) Execute(ctx TaskContext) TaskResult {
    // 停止 Arthas + 状态纠偏
    return detachArthas(c.PID)
}

// 调用者：接收命令并执行，不关心具体是 attach 还是 detach
type TaskInvoker struct{}

func (i *TaskInvoker) Invoke(cmd Command, ctx TaskContext) TaskResult {
    return cmd.Execute(ctx) // 统一执行入口
}
```

因为「动作」成了对象，你可以对它做很多「函数做不到」的事：

```go
// 排队：命令对象可以放进队列
queue := make(chan Command, 100)
queue <- &AttachCommand{PID: 123}

// 记录：把命令序列化存起来做审计
logCmd(cmd)

// 撤销：如果命令带 Undo，可以回滚
```

<details>
<summary>💭 想一想：命令模式和「直接调用」相比，多出来的价值是什么？</summary>

**答案**：多出来的价值是「**动作变成了可以被管理的数据**」。直接调用是「发生即执行」，命令模式是「先有对象、再决定何时何地执行」。所以一切需要「延迟、排队、重放、撤销、审计」动作的场景，都值得用命令模式。代价是：为每个动作多建一个类型，动作太少时不划算。

</details>

---

## 对应原则

- **OCP**：加一个新任务（新命令）不改调用者；
- **SRP**：调用者只管「调度执行」，命令对象只管「具体怎么做」；
- **DIP**：调用者依赖 `Command` 抽象，不依赖具体任务。

## 何时别用（红线）

1. **动作就是「调一下」、无需排队/撤销/审计**：命令模式是纯负担，直接函数调用即可。
2. **命令对象越来越多**（几十上百个单方法类型）时，要反思是不是过度设计了。
3. **不需要「撤销」时，别为了「未来可能要撤销」硬给每个命令加 `Undo`**——YAGNI。

---

<details>
<summary>📌 本文事实来源</summary>

- 控制平面 Task API 任务下发（arthas_attach/arthas_detach）、TaskDispatcher 统一执行：`【实测】` [Java Agent 控制平面](/observability/implementation/otel-java-agent-control-plane.md)、[Arthas 生命周期管理](/observability/arthas/otel-arthas-lifecycle-management.md)
- 命令模式定义：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为示意性简化 `【推断】`

</details>
