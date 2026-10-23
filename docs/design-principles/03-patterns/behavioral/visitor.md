# 访问者模式：把「操作」和「结构」分开

> 一句话：**在不改变对象结构的前提下，给一组结构稳定的对象增加新的操作。**
> 操作被封装成「访问者」，对象只需「接受」访问者来访。

---

## 它解决什么尴尬

有一组**结构相对稳定**的对象（比如三种信号类型：Metric / Span / Log），你希望对它们施加**多种不同的操作**（编码、校验、导出、统计…）。

如果把这些操作直接写在每个类型里，每加一种操作，就要改所有类型——**结构稳定、操作多变**时，访问者模式能把「新操作」收敛到「新访问者」里，而不是散布到各个类型。

---

## APM 落点：对不同信号类型做统一处理

APM 的核心数据有三种信号：**Metric / Span / Log**。对它们常有「同一批操作」——序列化、过滤、采样、导出（`【业界通用】` OTel pdata 的处理方式之一）。访问者模式可以让「加一种新操作」只新增一个访问者。

---

## Go 代码

```go
// 被访问的结构：三种信号类型
type Signal interface {
    Accept(v Visitor) // 接受访问者
}

type MetricSignal struct{}
type SpanSignal struct{}
type LogSignal struct{}

func (m *MetricSignal) Accept(v Visitor) { v.VisitMetric(m) }
func (s *SpanSignal) Accept(v Visitor)   { v.VisitSpan(s) }
func (l *LogSignal) Accept(v Visitor)    { v.VisitLog(l) }

// 访问者：一种「操作」
type Visitor interface {
    VisitMetric(m *MetricSignal)
    VisitSpan(s *SpanSignal)
    VisitLog(l *LogSignal)
}

// 具体操作 1：编码器
type Encoder struct{}

func (e *Encoder) VisitMetric(m *MetricSignal) { /* metric 编码 */ }
func (e *Encoder) VisitSpan(s *SpanSignal)     { /* span 编码 */ }
func (e *Encoder) VisitLog(l *LogSignal)       { /* log 编码 */ }

// 具体操作 2：采样器（新增操作，不改任何 Signal 类型）
type Sampler struct{}

func (s *Sampler) VisitMetric(m *MetricSignal) { /* metric 采样 */ }
func (s *Sampler) VisitSpan(sp *SpanSignal)    { /* span 采样 */ }
func (s *Sampler) VisitLog(l *LogSignal)       { /* log 采样 */ }
```

```go
// 使用：对一批信号施加某个操作
signals := []Signal{&MetricSignal{}, &SpanSignal{}, &LogSignal{}}
enc := &Encoder{}
for _, s := range signals {
    s.Accept(enc) // 动态分派到对应的 Visit 方法
}
```

<details>
<summary>💭 想一想：访问者模式最核心的代价是什么？</summary>

**答案**：是**「加结构很痛」**。访问者模式用「结构稳定」换「操作易加」——加一种新操作（新访问者）很轻松，但**加一种新的信号类型**（比如加 `TraceSignal`），就要改 `Visitor` 接口和所有已有访问者。所以它的适用前提非常明确：**结构极少变、操作频繁变**。如果反过来（结构常变），千万别用访问者。

</details>

---

## 对应原则

- **OCP**：加操作不改结构，新增访问者即可；
- **SRP**：把「操作逻辑」从数据结构里剥离，数据结构只负责 `Accept`。

## 何时别用（红线）

1. **结构会频繁增删类型**：访问者模式会让「加类型」成为灾难（改接口 + 改所有实现）。
2. **Go 里常用「类型断言 + switch」替代**：`switch v := signal.(type)` 更简单直接。访问者模式在 Go 里属于「重武器」，除非操作种类多且结构极稳定，否则别用。
3. **操作会破坏封装**：访问者通常需要访问对象内部，往往要暴露字段，得不偿失时就用普通方法。

---

<details>
<summary>📌 本文事实来源</summary>

- Metric/Span/Log 三类信号及处理：`【业界通用】` OpenTelemetry 数据模型（pdata）
- 访问者模式定义及双分派机制：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为示意性简化 `【推断】`

</details>
