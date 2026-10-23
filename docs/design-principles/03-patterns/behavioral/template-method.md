# 模板方法模式：固定流程骨架，子类填空

> 一句话：**在父类里定义一个算法的「固定骨架」，把「可变步骤」留给子类去实现。**
> 流程的「顺序」由父类定死，步骤的「具体做法」由子类决定。

---

## 它解决什么尴尬

有一类操作，**整体流程固定，但中间某些步骤因场景而异**。比如「执行一个任务」，流程永远是「校验 → 幂等 → 执行 → 终态上报」，但「执行」这一步，attach 任务和 detach 任务完全不同。

如果不抽骨架，每个任务各写一遍完整流程，那「校验」「幂等」「终态上报」这些**公共逻辑就会被复制粘贴 N 遍**——DRY 被破坏，改一处要改 N 处。

模板方法把「不变的部分」锁在父类，把「变的部分」留给子类填空。

---

## 真实案例：任务执行骨架

你的 [Arthas 生命周期管理](/observability/arthas/otel-arthas-lifecycle-management.md) 里，任务执行层有明确的固定流程（`【实测】`）：

> TaskDispatcher 负责「幂等分发、超时控制、终态去重」，而 ArthasAttachExecutor / ArthasDetachExecutor 各自实现「attach / detach」的具体逻辑。

这正是一个模板方法：**「分发 → 幂等 → 执行 → 终态去重」是骨架，「attach 还是 detach」是可变步骤。**

---

## Go 代码

```go
// 可变步骤：具体任务要实现的差异逻辑
type TaskSteps interface {
    Run(task Task) TaskResult
}

// 模板方法：固定"校验 → 幂等 → 执行 → 终态上报"骨架
type TaskDispatcher struct {
    steps    TaskSteps
    running  *Set // 运行中任务集合
    reported *Set // 已上报终态集合
}

// Execute 是模板方法：流程顺序写死，Run 这步交给 steps
func (d *TaskDispatcher) Execute(task Task) TaskResult {
    // ① 固定步骤：时效性校验
    if err := d.validate(task); err != nil {
        return TaskResult{Failed: err}
    }
    // ② 固定步骤：幂等，防重复执行
    if !d.running.Add(task.ID) {
        return TaskResult{Duplicate: true}
    }
    defer d.running.Remove(task.ID)

    // ③ 可变步骤：交给具体任务实现
    result := d.steps.Run(task)

    // ④ 固定步骤：终态去重上报
    d.reportTerminal(task.ID, result)
    return result
}
```

```go
// 具体任务 1：Attach
type AttachSteps struct{ pid int }

func (a *AttachSteps) Run(task Task) TaskResult {
    // 启动 Arthas + 等待 Tunnel 就绪 + 自愈清理
    return attach(a.pid)
}

// 具体任务 2：Detach
type DetachSteps struct{ pid int }

func (d *DetachSteps) Run(task Task) TaskResult {
    // 停止 Arthas + 状态纠偏
    return detach(d.pid)
}
```

`validate`、幂等、终态上报只写一次；「attach / detach」的差异各自填空。**加一个新任务，只需新写一个 `TaskSteps` 实现，公共流程零复制。**

<details>
<summary>💭 想一想：模板方法的「骨架」和「步骤」的边界，怎么划？</summary>

**答案**：划界标准是「**什么稳定、什么会变**」。骨架 = 稳定不变的部分（校验、幂等、上报，所有任务都一样）；步骤 = 会变的部分（attach/detach 的逻辑，每个任务不同）。**如果某个步骤也不稳定（比如连「校验」每个任务都不同），那它就不该待在骨架上**——要么继续下沉为钩子，要么这个「公共流程」根本不存在，别硬套模板方法。

</details>

---

## 对应原则

- **OCP**：加新任务不改骨架，只新增 `TaskSteps` 实现；
- **DRY**：公共流程只写一次，消除复制粘贴；
- **SRP**：骨架职责（流程编排）与步骤职责（具体逻辑）分离。

## 何时别用（红线）

1. **流程本身不稳定时别用**。如果「骨架」三天两头改，模板方法会让子类被父类的改动牵连。
2. **别为了「消除几行重复」硬抽骨架**。重复太小时，抽象成本可能高于收益。
3. **Go 里没有继承**，模板方法常用「接口 + 组合」模拟（如上面 `TaskSteps`）。注意别把可变步骤抽成「函数字段」——那会滑向策略模式，语义就变了（模板方法强调「流程顺序固定」，策略强调「算法可替换」）。

---

<details>
<summary>📌 本文事实来源</summary>

- TaskDispatcher 幂等分发/超时控制/终态去重、ArthasAttachExecutor/ArthasDetachExecutor 各自执行：`【实测】` [Arthas 生命周期管理](/observability/arthas/otel-arthas-lifecycle-management.md)
- 模板方法模式定义：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为「真实实现的忠实简化」 `【推断】`

</details>
