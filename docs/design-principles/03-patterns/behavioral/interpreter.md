# 解释器模式：把「语言」解析成可执行的表达式树

> 一句话：**为一种「小语言」定义语法，并把语句解析成表达式树，逐节点求值执行。**
> 适用于语法简单、规则需要频繁扩展的「领域小语言（DSL）」。

---

## 它解决什么尴尬

有些需求本质是「让用户写一种小语言」：查询指标、配置告警规则、描述过滤条件。如果硬编码每个规则，规则一多就是 if-else 地狱；如果上完整编译器，又太重。

解释器模式走中间路线：**定义表达式 AST，把「语句」解析成树，再对树求值**。加一条新语法 = 加一个表达式节点类型。

---

## APM 落点：PromQL / 告警规则 DSL

APM 里最有代表性的「小语言」是 **PromQL**（指标查询语言）和告警规则 DSL（`【业界通用】` Prometheus 生态公开设计）。像 `rate(cpu_usage[5m]) > 0.8` 这样的表达式，就是被解析成一棵表达式树再求值的。

---

## Go 代码（简化版表达式求值）

```go
// 表达式接口：所有语法节点都实现 Eval
type Expr interface {
    Eval(ctx EvalContext) float64
}

// 字面量节点：一个常量
type Literal struct{ value float64 }

func (l *Literal) Eval(ctx EvalContext) float64 { return l.value }

// 二元运算节点：op + 左右子树
type Binary struct {
    op    string
    left  Expr
    right Expr
}

func (b *Binary) Eval(ctx EvalContext) float64 {
    l, r := b.left.Eval(ctx), b.right.Eval(ctx)
    switch b.op {
    case "+":
        return l + r
    case ">":
        if l > r {
            return 1
        }
        return 0
    default:
        return 0
    }
}
```

```go
// 表达式 "rate(cpu_usage) > 0.8" 解析成树：
//        >
//      /   \
//  rate()   0.8
tree := &Binary{
    op:    ">",
    left:  &FuncCall{name: "rate", args: []Expr{&Literal{value: 42}}},
    right: &Literal{value: 0.8},
}
result := tree.Eval(ctx) // 逐节点求值
```

加一种新运算（比如 `and`） = 新增一个表达式节点类型 + 在 parser 里注册，不影响已有节点。

<details>
<summary>💭 想一想：解释器模式最大的坑是什么？</summary>

**答案**：是**复杂度失控**。语法一旦变复杂（嵌套、优先级、类型、函数…），表达式树会爆炸式增长，自己手写解释器很快变成「又慢又难维护的迷你编译器」。所以解释器模式只适合**语法简单、稳定**的 DSL。**一旦语法复杂，请直接用现成的解析器生成器（如 ANTLR、yacc），别硬写。**

</details>

---

## 对应原则

- **组合**：表达式是「节点组合成树」，天然递归；
- **OCP**：加新语法节点不改已有节点；
- **SRP**：语法解析（parser）与求值（Eval）职责分离。

## 何时别用（红线）

1. **语法复杂**：直接上解析器生成器或现成库（PromQL 就该用现成解析器），手写解释器是负优化。
2. **规则固定、不需要用户自定义**：硬编码 + 配置表就够了，别造 DSL。
3. **性能敏感**：解释执行通常比编译慢，热路径上别用解释器。

---

<details>
<summary>📌 本文事实来源</summary>

- PromQL/告警规则 DSL：`【业界通用】` Prometheus 生态公开设计
- 解释器模式定义：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为示意性简化 `【推断】`

</details>
