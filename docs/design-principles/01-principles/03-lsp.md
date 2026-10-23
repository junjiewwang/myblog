# 里氏替换原则（LSP）：儿子，要能顶替老子

> 一句话：**子类必须能无差别地替换父类，且不破坏父类对外承诺的行为契约。**
> 凡是父类能出现的地方，换成子类，行为必须依然正确。

---

## 从 OCP 的「抽象」说起

上一篇我们靠 `Parser` 接口实现了 OCP——加协议「只增不改」。但这里藏着一个**隐含前提**：

> 你新注册的那个 `Parser` 实现，必须真的能当好一个 `Parser`。

如果某个「Parser」实现 `Parse()` 时偷偷抛个 `not implemented`，或者只解析前 100 行就悄悄返回——那这个接口抽象就是**纸糊的**：编译能过，运行就炸。OCP 的「封闭」就守不住了。

**OCP 让抽象成为可能，LSP 保证抽象是真的。**

---

## 原则是什么

LSP（Liskov Substitution Principle），由 Barbara Liskov 提出：

> 如果 S 是 T 的子类型，那么任何使用 T 的地方，都可以用 S 替换，而不改变程序的正确性。

最容易被误解的一点：**编译器只检查「方法签名」，不检查「行为契约」。** 签名一样 ≠ 能替换。LSP 管的是后者——子类必须在**行为上**兑现父类的承诺，包括：

- 不能抛父类没声明会抛的异常（语义上的意外失败）；
- 不能强化前置条件（要求调用方做更多，否则就错）；
- 不能弱化后置条件（返回比父类承诺更少/更差的结果）。

---

## 真实案例：存储后端「可替换」的契约

查询层为了能换存储引擎（这是 OCP 篇提到的那根「存储引擎」变化轴），会依赖一个存储抽象接口（`【业界通用】` OTel 存储 / 时序库常见设计）。假设它长这样：

```go
// 存储查询抽象：承诺"既能范围查，也能即时查"
type QueryEngine interface {
    QueryRange(q Query) ([]Sample, error)  // 范围查询，返回时间序列
    QueryPoint(q Query) (Sample, error)    // 即时查询，返回单点
}
```

VictoriaMetrics 能同时兑现这两个承诺。但假设某天你接了一个「只做即时查询」的轻量后端，为了赶紧接入，它这么写：

```go
// 反例：谎报支持范围查询，破坏接口契约
type LiteEngine struct{}

func (l *LiteEngine) QueryRange(q Query) ([]Sample, error) {
    return nil, errors.New("not implemented") // ← 父类承诺"能做"，子类却说"做不了"
}
func (l *LiteEngine) QueryPoint(q Query) (Sample, error) {
    return l.pointQuery(q) // 只实现了一半
}
```

这看起来「只是偷懒」，但它是**实打实的 LSP 违反**：任何依赖 `QueryEngine` 的代码（比如一个「查最近 1 小时趋势」的查询器），一换上 `LiteEngine` 就炸。**「可替换」的承诺被单方面撕毁了。**

---

## 正反对比（Go）

**反例**：子类抛 `not implemented`（上文）。

**正例**：要么真正兑现契约，要么**缩小接口**（这正好引出下一篇 ISP）：

```go
// 方案 A：真的兑现契约（完整实现范围查询）
type ClickHouseEngine struct{}
func (c *ClickHouseEngine) QueryRange(q Query) ([]Sample, error) { /* 真实现 */ }
func (c *ClickHouseEngine) QueryPoint(q Query) (Sample, error)  { /* 真实现 */ }

// 方案 B：如果确实只支持即时查询，就只实现"即时查询"这个小接口，
//        而不是去实现一个自己兑现不了的胖接口（见下一篇 ISP）
type PointQueryEngine interface {
    QueryPoint(q Query) (Sample, error)
}
```

关键：**你不该去「假装」实现一个自己满足不了的接口。**

<details>
<summary>💭 想一想：为什么编译器发现不了 LSP 违反？</summary>

**答案**：因为 `QueryRange` 的签名（`(Query) ([]Sample, error)`）在 `LiteEngine` 里一模一样，编译、类型检查全通过。但「父类的承诺」——「范围查询是可用的」——是一个**写在文档/命名/语义里的契约**，编译器看不到。LSP 违反本质是「签名诚实、行为撒谎」，只能靠**测试和评审**兜住。

</details>

---

## 违反 LSP 的三个典型信号

代码里一旦出现这些味道，大概率是在撕毁替换契约：

| 信号 | 例子 |
|------|------|
| **抛 `NotImplemented` / `UnsupportedOperation`** | 上面 `LiteEngine` 的 `QueryRange` |
| **强化前置条件** | 子类要求调用方「必须先调 init() 否则返回错误」，而父类没这个要求 |
| **弱化后置条件** | 父类承诺「返回排序后的完整序列」，子类却返回未排序或截断的数据 |

---

## 红线：LSP 不是「继承语法」问题

1. **LSP 和继承没有必然绑定**。Go 没有继承，用的是「接口 + 实现」，但 LSP 照样成立——它管的是「实现是否兑现接口契约」。
2. **契约必须是显式的**。如果父类/接口从没承诺过「范围查询可用」，那子类不实现它就不算违反 LSP。契约没写清，别拿 LSP 乱扣帽子。
3. **多数 LSP 违反，根子在于「接口太胖」**——一个接口塞了太多方法，逼着实现者去填自己用不上的坑。

这个「根子」，就是下一篇要治的病。

---

## 小结

- LSP = 子类必须在**行为上**兑现父类契约，签名相同 ≠ 能替换；
- 典型违反：抛 `NotImplemented`、强化前置、弱化后置；
- 违反 LSP 的根源往往是**接口太胖**，实现者被迫实现用不上的方法——解决办法是「把胖接口拆成多个瘦接口」。

👉 下一篇：[接口隔离原则 ISP](/design-principles/01-principles/04-isp.md)

---

<details>
<summary>📌 本文事实来源</summary>

- 「存储引擎替换」的变化轴、查询抽象：`【业界通用】` OTel/时序数据库常见分层设计
- 本节 `QueryEngine` 接口与 `LiteEngine` 为说明 LSP 的示意性代码 `【推断】`
- 采样策略的接口可替换性（辅助理解）：`【实测】` [延迟采样方案](/observability/design/otel-tail-based-sampling.md)

</details>
