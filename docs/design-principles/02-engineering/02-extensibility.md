# 可扩展性：为变化留一个「插槽」

> 一句话：**把「会变的部分」设计成「插槽」，新功能通过「插入」实现，而不是「修改」实现。**
> 可扩展性，是 OCP 的工程化落地。

---

## 从 OCP 到「可扩展性」

上一篇讲清了「聚」与「散」。但一个系统「结构清晰」还不够，它还要「**扛得住变化**」——这正是 OCP 追求的东西。而可扩展性，回答的是 OCP 落地时的具体问题：

> 那个「扩展点」到底怎么设计？在 Go 里长什么样？什么时候该留、什么时候别留？

---

## 扩展点的三种形态

在 Go 工程里，把「变化点」做成「插槽」，常见三种形态：

| 形态 | 机制 | 何时变化 | 例子 |
|------|------|----------|------|
| **接口 + 注册表** | `Register()` 运行时注册，`Get()` 按需取 | 运行时 | 协议 parser、采样策略 |
| **配置驱动** | 用配置文件/远程配置改变行为 | 部署期 | 采样率、开关 |
| **构建标签** | `//go:build` 编译期选择实现 | 编译期 | 不同平台/存储后端 |

本文聚焦最核心的**「接口 + 注册表」**——它也是六大原则篇里反复出现的那套。

---

## 真实案例：接入层的两个「插槽」

你的接入层其实已经有两个成熟的扩展点（`【实测】` [指标冒险之旅](/observability/victoriametrics/metric-journey.md)、[延迟采样方案](/observability/design/otel-tail-based-sampling.md)）：

**插槽 1：协议解析器**（加协议 = 加一个 parser）

```go
// 扩展点：协议 → 解析器的注册表
var parsers = map[string]func() Parser{}

func Register(name string, factory func() Parser) { parsers[name] = factory }
func GetParser(contentType string) (Parser, error) {
    f, ok := parsers[contentType]
    if !ok {
        return nil, ErrUnsupportedProtocol
    }
    return f(), nil
}
```

**插槽 2：采样策略**（加采样算法 = 加一个 Sampler）

```go
// 扩展点：采样策略接口，head-based / tail-based 都是它的实现
type Sampler interface {
    ShouldSample(ctx SamplingContext) bool
}

type TraceIdRatioBased struct{ ratio float64 }
type TailBased struct{ /* 基于结果采样 */ }
```

一个「会加协议」的接入层，和一个「会加采样策略」的采样器，本质上用的是**同一个套路**：把变化轴抽成接口，把稳定流程写成依赖接口的代码，变化时只「插入」新实现。

<details>
<summary>💭 想一想：同样是「加功能」，注册表方案和「改 switch」到底差在哪？</summary>

**答案**：差在**「动没动已验证的核心」**。改 `switch` 是修改一个已经上线、经过验证的分发逻辑——每次改动都有回归风险；而注册表方案里，分发逻辑（`GetParser`）是稳定不变的，新功能落在「新文件里的新实现 + 一行 `Register`」上，核心零改动。**可扩展性的本质，是让「高频变化」发生在「低风险的新代码」里，而不是「高风险的老代码」里。**

</details>

---

## 正反对比：一个「不可扩展」和「可扩展」的采样器

**反例**：采样逻辑写死，加策略要改核心：

```go
func ShouldSample(traceID string, ratio float64, isError bool) bool {
    // 头部采样逻辑写死在这里
    if isError {
        return true // 错误链路必采样
    }
    return hash(traceID)%10000 < uint64(ratio*10000)
}
// 想加"尾部采样"？只能改这个函数，或再写一个 if-else
```

**正例**：策略抽象成接口，加策略只新增：

```go
func (s *SamplingService) ShouldSample(ctx SamplingContext) bool {
    for _, sampler := range s.samplers { // 稳定流程：依次问每个策略
        if sampler.ShouldSample(ctx) {
            return true
        }
    }
    return false
}
// 新增策略 = 新写一个 struct 实现 Sampler，注入即可，核心不动
```

---

## 什么时候「留插槽」，什么时候「别过度设计」

这是可扩展性最难的一步——**留插槽是要成本的**（接口、注册表、间接调用都是开销）。给你一个判断公式：

> **值得留插槽的条件 = 变化的频率 × 变化的影响面**

| 场景 | 频率 | 影响面 | 决策 |
|------|------|--------|------|
| 协议种类（接入层） | 高（持续接入新协议） | 大 | ✅ 必须留 |
| 采样策略 | 中（算法演进） | 中 | ✅ 值得留 |
| 存储引擎 | 低（几年换一次） | 大 | ⚠️ 视情况 |
| 「未来可能支持 Excel 导出」 | 极低（纯想象） | 小 | ❌ 别留（YAGNI） |

关键心法：**等第二处变化出现时，再抽接口**。第一处变化就抽象，方向往往抽错（这也是「过早抽象」反模式，见业务实践篇）。

---

## 红线：可扩展 ≠ 可读

1. **扩展点的数量要和「真实变化轴」对齐**。别为一个 10 年不变的模块预留 5 个接口。
2. **「插入」的新实现，也必须遵守已有的契约**——这就是 LSP 篇说的：扩展点开得再多，实现者违约就全白搭。
3. **注册表要有「兜底」**：`GetParser` 返回 `ErrUnsupportedProtocol` 而不是 panic，是扩展点健壮性的底线。

---

## 小结

- 可扩展性 = 把变化轴抽成「接口 + 注册表」等扩展点；
- 接入层的「协议 parser 注册表」「采样 Sampler」是真实扩展点；
- 留插槽前用「频率 × 影响面」判断，等第二处变化再抽象；
- 可扩展了之后，新问题来了：**新插入的实现如果「执行失败」了，系统怎么体面地扛住？**

👉 下一篇：[健壮性](/design-principles/02-engineering/03-robustness.md)

---

<details>
<summary>📌 本文事实来源</summary>

- 协议归一化、采样策略 head-based/tail-based：`【实测】` [指标冒险之旅](/observability/victoriametrics/metric-journey.md)、[延迟采样方案](/observability/design/otel-tail-based-sampling.md)
- 「接口 + 注册表」扩展点形态：`【业界通用】` Go 插件式设计（database/sql driver 注册）
- 本节 Go 代码为示意性简化 `【推断】`

</details>
