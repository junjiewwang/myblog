# 桥接模式：让「抽象」和「实现」两个维度各自变化

> 一句话：**把「抽象」和「实现」拆成两个独立的维度，让它们各自扩展、互不影响。**
> 用组合替代「一个维度继承另一个维度」。

---

## 它解决什么尴尬

当一个概念有**两个独立的变化维度**时，用继承会爆炸。比如「数据 API」有「查询 / 写入」等形态，「存储引擎」有「VM / ClickHouse」等实现——如果用继承，就得写 `VMQueryAPI`、`ClickHouseQueryAPI`、`VMWriteAPI`…（M 种 API × N 种引擎 = M×N 个类）。

桥接模式把「抽象维度（API）」和「实现维度（引擎）」拆开，用**组合**连接：`API 持有引擎`。这样 API 加一个、引擎加一个，是 M + N，而不是 M × N。

---

## APM 落点：数据接口与存储引擎解耦

APM 查询/写入的「接口形态」和「存储引擎」正是两个独立维度（`【业界通用】` 可观测存储分层设计）：接口形态可能扩展（加批量查询、加流式接口），存储引擎也可能替换（VM → ClickHouse）。桥接让两者互不牵连。

---

## Go 代码

```go
// 实现维度：存储引擎（独立变化）
type StorageEngine interface {
    Write(rows []Row) error
    Query(q Query) ([]Sample, error)
}

type VictoriaMetricsEngine struct{}
type ClickHouseEngine struct{}

func (v *VictoriaMetricsEngine) Query(q Query) ([]Sample, error) { /* VM 实现 */ }
func (c *ClickHouseEngine) Query(q Query) ([]Sample, error)      { /* CH 实现 */ }

// 抽象维度：数据 API（独立变化），通过组合持有"实现"
type MetricAPI struct {
    engine StorageEngine // 桥：抽象与实现之间的连接点
}

func (m *MetricAPI) Ingest(rows []Row) error {
    return m.engine.Write(rows)
}

func (m *MetricAPI) Query(q Query) ([]Sample, error) {
    return m.engine.Query(q)
}
```

```go
// 两个维度自由组合，无需 M×N 个类
vmAPI := &MetricAPI{engine: &VictoriaMetricsEngine{}}
chAPI := &MetricAPI{engine: &ClickHouseEngine{}}
// 将来加一个"批量 API"，或加一个"新引擎"，都只加一个，互不影响
```

<details>
<summary>💭 想一想：桥接和适配器，都涉及「两个东西对接」，区别在哪？</summary>

**答案**：区别在**时机和目的**：
- **桥接**：是**设计时**的决策，主动把「抽象」和「实现」拆成两个维度，让它们**各自演进**；
- **适配器**：是**事后**的补救，两个已经存在且不兼容的东西，加个翻译层让它俩**能一起用**。

一句话：**桥接是「设计出来的分家」，适配器是「事后凑合的翻译」。** 桥接解决「如何避免 M×N 爆炸」，适配器解决「如何让不匹配的对接上」。

</details>

---

## 对应原则

- **OCP**：抽象维度、实现维度都能各自扩展；
- **组合优于继承**：用「API 持有引擎」替代「API 继承引擎」；
- **SRP**：抽象职责（对外接口）与实现职责（存储细节）分离。

## 何时别用（红线）

1. **只有一个维度在变**：如果「引擎」永远只有一种，桥接就是多余的一层抽象（和普通接口依赖没区别）。
2. **两个维度其实强耦合**：如果「API 形态」和「引擎」本质绑定（换引擎必然换 API），拆开反而别扭。
3. **别和「依赖注入」混为一谈**：桥接关注「抽象与实现的分层设计」，注入只是「怎么把实现传进去」。

---

<details>
<summary>📌 本文事实来源</summary>

- 数据接口/存储引擎分层、存储引擎替换：`【业界通用】` 可观测存储分层设计
- 桥接模式定义：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为示意性简化 `【推断】`

</details>
