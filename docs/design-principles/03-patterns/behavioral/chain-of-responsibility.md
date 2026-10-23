# 责任链模式：让数据「沿流水线」逐级处理

> 一句话：**把多个处理器串成一条链，请求沿链传递，每个处理器决定「处理」还是「传给下一个」。**
> 处理器之间互相解耦，各自只关心自己那一环。

---

## 它解决什么尴尬

有一段数据要经过**多个处理步骤**，步骤可以增删、调序。如果把这些步骤写死在一个大函数里（`step1(); step2(); step3();`），加一步就要改这个函数，步骤之间也耦合在一起。

责任链把「每个处理步骤」变成独立的处理器，再把它们串成链——加步骤、调顺序，只需改「链的组装」，不动每个处理器。

---

## 真实案例：OTel Collector 的 Pipeline

OpenTelemetry Collector 的数据处理就是一条责任链（`【业界通用】` OTel 官方设计）：

```
Receiver → Processor → Exporter
```

数据从 `Receiver` 进来，经过一系列 `Processor`（过滤、批处理、内存限制…），最后交给 `Exporter` 导出。**每一步都是一个独立组件，流水线可以自由组装**——这正是责任链的思想。

---

## Go 代码

```go
// 处理器：链上的一环
type PipelineStage interface {
    Process(data *Data) (*Data, error)
}

// 责任链：按顺序串联各处理器
type Pipeline struct {
    stages []PipelineStage
}

func (p *Pipeline) Process(data *Data) (*Data, error) {
    var err error
    for _, stage := range p.stages {
        data, err = stage.Process(data) // 传给下一个处理器
        if err != nil {
            return nil, err // 某个环节失败，终止链
        }
    }
    return data, nil
}
```

```go
// 各处理器：各自独立，只关心自己一环
type FilterProcessor struct{}      // 过滤不需要的数据
type BatchProcessor struct{}       // 批处理
type MemoryLimiter struct{}        // 内存限制

func (b *BatchProcessor) Process(d *Data) (*Data, error) { /* 攒批 */ }

// 组装链：顺序可自由调整、可增删
pipeline := &Pipeline{
    stages: []PipelineStage{
        &MemoryLimiter{},
        &FilterProcessor{},
        &BatchProcessor{},
        &Exporter{}, // 最后导出
    },
}
```

<details>
<summary>💭 想一想：责任链和「管道 Pipeline」是同一个东西吗？</summary>

**答案**：是「**同一种思想**」，但严格说略有差别——经典责任链里，每个处理器可以决定「**到此为止**」（处理完不再传递），而管道通常每个环节都**必须传递**。OTel 的 pipeline 更接近「管道」（数据流过每一环）。但它们的核心相同：**把顺序处理抽象成可组装的处理单元链**，让加环节、调顺序不影响已有环节。工程上两者经常混用，重点是理解「链式解耦」这个意图。

</details>

---

## 对应原则

- **OCP**：加一个处理步骤 = 新增一个 `PipelineStage`，不改已有环节；
- **SRP**：每个处理器只负责一环（过滤只管过滤、批处理只管攒批）；
- **LoD**：处理器之间互不认识，只通过链传递数据。

## 何时别用（红线）

1. **步骤固定、永不增删调序**：那一个函数顺序调用就够了，别为「想象的变化」上责任链。
2. **步骤之间有强数据依赖、顺序不能乱**时，链式抽象会掩盖这种依赖，要谨慎。
3. **每个环节都要做「是否传递」的判断**时才是经典责任链；如果每环都必传，用「管道/切片」更直白。

---

<details>
<summary>📌 本文事实来源</summary>

- Receiver→Processor→Exporter 流水线：`【业界通用】` OpenTelemetry Collector 官方架构
- 责任链模式定义：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为示意性简化 `【推断】`

</details>
