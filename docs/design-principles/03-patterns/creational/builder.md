# 建造者模式：分步构建复杂对象

> 一句话：**把「复杂对象的构建」和它的「表示」分离，用分步、链式的方式构建。**
> 当对象的构造参数多、可选组合复杂时，建造者让构建过程清晰可控。

---

## 它解决什么尴尬

一个对象的构造参数很多，且很多是**可选的**。如果全靠构造函数，会变成 `NewQuery(metric, "", "", 0, 0, nil, nil, ...)` 这种「参数黑洞」，调用方根本不知道每个空参数是什么意思。

建造者模式用「分步设置 + 最后 Build」的方式，让构建过程**可读、可组合**。

---

## APM 落点：复杂查询条件的构建

APM 的查询请求往往参数繁多：指标名、时间范围、步长、过滤标签、聚合函数…（`【业界通用】` 时序查询常见设计）。用建造者，可以链式地、只填需要的部分。

---

## Go 代码

```go
// 复杂对象：查询请求，参数多、多可选
type QueryRequest struct {
    metric  string
    start   time.Time
    end     time.Time
    step    time.Duration
    filters []string
}

// 建造者：分步设置
type QueryBuilder struct {
    req QueryRequest
}

func NewQueryBuilder(metric string) *QueryBuilder {
    return &QueryBuilder{req: QueryRequest{metric: metric}}
}

func (b *QueryBuilder) Range(start, end time.Time) *QueryBuilder {
    b.req.start, b.req.end = start, end
    return b // 返回自身，支持链式
}

func (b *QueryBuilder) Step(step time.Duration) *QueryBuilder {
    b.req.step = step
    return b
}

func (b *QueryBuilder) Filter(f string) *QueryBuilder {
    b.req.filters = append(b.req.filters, f)
    return b
}

func (b *QueryBuilder) Build() QueryRequest {
    return b.req
}
```

```go
// 链式构建：只填需要的，可读性极强
req := NewQueryBuilder("cpu_usage").
    Range(time.Now().Add(-time.Hour), time.Now()).
    Step(time.Minute).
    Filter(`host="web-1"`).
    Build()
```

对比构造函数的「参数黑洞」，建造者让每个字段的语义一目了然。

<details>
<summary>💭 想一想：建造者模式和「直接构造 + setter」有什么区别？</summary>

**答案**：核心区别在「**构建的不变式**」。建造者把「中间状态」隔离在 builder 里，`Build()` 时才一次性产出**完整、合法**的最终对象（可以在 Build 时校验）；而「new + setter」会让对象处于「半初始化」的非法状态暴露在外。**建造者的价值是：构建过程分步走，但最终对象一次成型、保证完整。**

</details>

---

## 对应原则

- **SRP**：构建职责（builder）与对象本身职责分离；
- **封装**：中间构建状态不外泄，最终对象完整合法；
- **可读性**：链式构建比「参数黑洞」清晰。

## 何时别用（红线）

1. **参数就两三个**：别上建造者，直接构造函数更简洁。
2. **参数大多必填、没有可选组合**：构造函数 + 具名参数（Go 里用 struct 字面量）就够，建造者是多余。
3. **Go 里的惯用替代**：`struct 字面量 + 可选字段` 往往比 builder 更直白，尤其配合「functional options」模式（`WithXxx()` 函数）是 Go 社区更常见的做法。

---

<details>
<summary>📌 本文事实来源</summary>

- 时序查询请求的多参数构建：`【业界通用】` Prometheus/时序库查询 API 常见设计
- 建造者模式定义：`【业界通用】` GoF《设计模式》
- Go functional options 惯用法：`【业界通用】` Go 社区最佳实践
- 本节 Go 代码为示意性简化 `【推断】`

</details>
