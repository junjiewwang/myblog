# 组合模式：把「整体」和「部分」统一起来处理

> 一句话：**用树形结构表示「整体-部分」关系，让调用方能用同一套方式处理「单个对象」和「组合对象」。**
> 叶子节点和树枝节点实现同一个接口，调用方不用区分。

---

## 它解决什么尴尬

有些概念天然是「树」：一个规则由子规则组成，子规则还能继续组合。如果调用方要「先判断是不是叶子、再递归处理」，就得写一堆 `if` 区分叶子/树枝。

组合模式让**叶子（Leaf）和组合（Composite）实现同一个接口**，调用方一律调用同一个方法，递归在组合对象内部完成。

---

## APM 落点：告警规则树 / 标签表达式

APM 的告警规则、过滤条件常常是树形结构：`(cpu > 80) AND (host == "web-1" OR host == "web-2")`（`【业界通用】` 监控系统常见设计）。这是一个「条件（叶子）+ 逻辑运算（组合）」的树，组合模式天然适配。

---

## Go 代码

```go
// 组件接口：叶子和组合都实现它
type Rule interface {
    Match(ctx Context) bool
}

// 叶子节点：单个条件
type Condition struct {
    field string
    op    string
    value float64
}

func (c *Condition) Match(ctx Context) bool {
    return compare(ctx.Get(c.field), c.op, c.value)
}

// 组合节点：AND 逻辑，由子规则组成
type AndRule struct {
    children []Rule // 子规则可以是叶子，也可以是另一个组合
}

func (a *AndRule) Match(ctx Context) bool {
    for _, child := range a.children {
        if !child.Match(ctx) { // 递归：不区分叶子还是组合
            return false
        }
    }
    return true
}

// 组合节点：OR 逻辑
type OrRule struct {
    children []Rule
}

func (o *OrRule) Match(ctx Context) bool {
    for _, child := range o.children {
        if child.Match(ctx) {
            return true
        }
    }
    return false
}
```

```go
// 组装一棵规则树：(cpu > 80) AND (host == web-1 OR host == web-2)
rule := &AndRule{children: []Rule{
    &Condition{field: "cpu", op: ">", value: 80},
    &OrRule{children: []Rule{
        &Condition{field: "host", op: "==", value: 1},
        &Condition{field: "host", op: "==", value: 2},
    }},
}}
rule.Match(ctx) // 调用方只认 Rule 接口，不关心树有多深
```

<details>
<summary>💭 想一想：组合模式最核心的价值是什么？</summary>

**答案**：是「**调用方无需区分叶子与组合**」。它把「递归」这件麻烦事藏进了组合对象内部，调用方拿到的永远是 `Rule`，调用 `Match` 即可。**「统一接口」带来的好处是：树的深度、结构变化，都不影响调用方**——你可以在任意位置加一层 `And`，外面代码一行不用改。

</details>

---

## 对应原则

- **SRP**：叶子管「判断」，组合管「递归」，职责清晰；
- **OCP**：加新规则类型（如 `NotRule`）不改调用方；
- **多态**：统一接口，消除「判断叶子/组合」的分支。

## 何时别用（红线）

1. **结构不是树、没有「整体-部分」关系**：别硬套组合，强行把平级对象变成树是扭曲。
2. **叶子和组合的接口差异很大**：如果它们很难统一到同一个接口，说明不适合组合模式。
3. **树很深、需要频繁遍历**：组合模式的递归有开销，性能敏感场景要评估。

---

<details>
<summary>📌 本文事实来源</summary>

- 告警规则/标签表达式的树形结构：`【业界通用】` 监控系统（如 Prometheus alerting rules）常见设计
- 组合模式定义：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为示意性简化 `【推断】`

</details>
