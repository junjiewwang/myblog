# 策略模式：让算法「可替换」

> 一句话：**把一组可互换的算法各自封装，让它们能独立于使用方而变化。**
> 使用方不关心「用哪个算法」，只关心「有个算法能干活」。

---

## 它解决什么尴尬

有一段逻辑，它的**算法会变**，但**使用它的地方不该变**。比如：采样算法今天用「按比例采样」，明天要换成「错误链路必采」，后天可能要「按耗时采样」。

如果把这些算法用 `if-else` 写死在调用方里，每换一种算法就要改调用方——这正是策略模式要消除的。

---

## 真实案例：APM 采样策略

你的 [延迟采样方案](/observability/design/otel-tail-based-sampling.md) 里，采样策略天然就是一个「策略族」（`【实测】`）：

- **头部采样**（Head-Based）：入口按 TraceId 比例决定是否采样；
- **尾部采样**（Tail-Based）：请求结束后，错误/慢请求必采；
- **动态采样**（DynamicSampler）：采样率可热更新。

它们的**使用方**（采样决策器）不该关心具体是哪种，只该关心「这个 trace 要不要采」。

---

## Go 代码

```go
// 策略接口：所有采样算法的统一契约
type Sampler interface {
    ShouldSample(ctx SamplingContext) bool
}

// 策略 1：头部采样——按 TraceId 哈希比例
type TraceIdRatioBased struct{ ratio float64 }

func (s *TraceIdRatioBased) ShouldSample(ctx SamplingContext) bool {
    return hash(ctx.TraceID)%10000 < uint64(s.ratio*10000)
}

// 策略 2：尾部采样——错误/慢请求命中即采
type TailBased struct{ policies []Policy }

func (s *TailBased) ShouldSample(ctx SamplingContext) bool {
    for _, p := range s.policies {
        if p.Match(ctx) { // 命中错误策略、慢请求策略等
            return true
        }
    }
    return false
}
```

```go
// 使用方：只依赖 Sampler 接口，注入哪个策略就用哪个
type SamplerService struct {
    sampler Sampler
}

func (s *SamplerService) Decide(ctx SamplingContext) bool {
    return s.sampler.ShouldSample(ctx) // 不关心具体策略
}
```

加一个新策略 = 新写一个 `Sampler` 实现，`SamplerService` 一行不动。

<details>
<summary>💭 想一想：策略模式和「改 if-else」的区别，关键在哪？</summary>

**答案**：关键在「**变化发生的位置**」。`if-else` 方案里，变化发生在**使用方内部**（要改 `SamplerService`）；策略模式里，变化发生在**新文件里的新实现**（`SamplerService` 稳定）。前者每次变更都有回归风险，后者核心零改动。**策略模式是 OCP 在「算法替换」这个场景下的标准招式。**

</details>

---

## 对应原则

- **OCP**：加策略不改使用方，对扩展开放；
- **LSP**：每个 `Sampler` 实现都能无差别替换（`ShouldSample` 契约必须兑现）；
- **DIP**：使用方依赖 `Sampler` 抽象，而非具体算法。

## 何时别用（红线）

1. **算法几乎不变**：如果采样策略十年才调一次，硬抽 `Sampler` 接口是过度设计，一个函数就够了。
2. **策略数量固定且极少**：只有两种策略、且不会再加时，`if-else` 反而更直白。
3. **别为了「未来可能」提前抽策略**——记住「等第二处变化再抽象」。

---

<details>
<summary>📌 本文事实来源</summary>

- head-based / tail-based 采样策略、TraceIdRatioBased、DynamicSampler：`【实测】` [延迟采样方案](/observability/design/otel-tail-based-sampling.md)、[Java Agent 控制平面](/observability/implementation/otel-java-agent-control-plane.md)
- 策略模式定义：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为示意性简化 `【推断】`

</details>
