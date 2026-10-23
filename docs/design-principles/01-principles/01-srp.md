# 单一职责原则（SRP）：一个类，只能有一个「变心的理由」

> 一句话：**职责的边界，应该按「变化的原因」来切，而不是按「功能的多少」来数。**
> 一个模块只应该有一个引起它变化的原因。

---

## 回到序章那个「万能函数」

先复习一下序章里接入层的违章建筑——它到底坏在哪？答案不是「它太长」，而是它把**三根不同的变化轴**焊死在了一起：

```go
func handleWrite(w http.ResponseWriter, r *http.Request) {
    // 变化轴 A：协议种类变了（Prometheus → Influx → OTel...）要改这里
    switch contentType { ... }

    // 变化轴 B：索引策略变了（高基数治理、标签模型调整）要改这里
    id := indexDB.GetOrCreateID(name, labels)

    // 变化轴 C：存储引擎变了（VM → ClickHouse）也要改这里
    storage.Insert(id, ts, value)
}
```

**「一个函数干了很多事」不是问题，「一件事变化会牵动另一件事」才是问题。**

---

## 原则是什么

SRP（Single Responsibility Principle）的原话：

> A class should have only one reason to change.
> —— 一个类应该只有一个「引起它变化的原因」。

关键在最后两个词：**reason to change（变化的原因）**。所以判断标准不是「这个类是不是只做了一件事」，而是：

> **如果两段逻辑会因为不同的原因、在不同的时间点、由不同的人来改，那它们就不该待在同一个模块里。**

---

## 真实案例：接入层的三件「不同的活」

这条原则在你的 APM 博客里其实已经落地了——数据接入被分成了三个变化轴完全不同的环节（`【实测】` [指标冒险之旅](/observability/victoriametrics/metric-journey.md)）：

| 环节 | 职责 | 变化的原因 |
|------|------|-----------|
| **归一化**（InsertCtx） | 把 14 种协议方言翻译成统一的 `rawRow` | 新增协议种类 |
| **索引**（indexdb） | 把标签串映射成 `MetricID` | 标签模型、高基数策略 |
| **存储**（storage） | 把 `rawRow` 落盘 | 存储引擎替换 |

这三个环节「变化的节奏」完全不同：你可能今天加一个 Influx 协议（只动归一化），明天优化高基数治理（只动索引），后天把 VM 换成 ClickHouse（只动存储）。**把它们焊在一个函数里，任何一次变化都要冒着碰坏另两个的风险。**

控制平面也是同一套逻辑（`【实测】` [Java Agent 控制平面](/observability/implementation/otel-java-agent-control-plane.md)）：Config / Task / Status 三个 API 各管一件事——配置下发、任务下发、状态上报，三个独立的变化轴，所以拆成三个 API，而不是一个「大而全」的 `/v1/control`。

---

## 正反对比（Go）

**反例**：三根变化轴焊死在一个函数里（上文 `handleWrite`）。

**正例**：按「变化的原因」切成三个各自独立的职责：

```go
// 职责 1：解析——只关心"字节 → rawRow"，随协议种类变化
type Parser interface {
    Parse(data []byte) ([]RawRow, error)
}

// 职责 2：索引——只关心"标签 → MetricID"，随标签模型变化
type Indexer interface {
    GetOrCreateID(labels Labels) (uint64, error)
}

// 职责 3：存储——只关心"rawRow 落盘"，随存储引擎变化
type Storage interface {
    Insert(rows []RawRow) error
}

// 编排层：只管调度，不干具体活，它变化的原因只剩一个——"流程编排方式"
type IngestService struct {
    parser  Parser
    indexer Indexer
    storage Storage
}

func (s *IngestService) Ingest(data []byte) error {
    rows, err := s.parser.Parse(data)
    if err != nil {
        return err
    }
    for _, row := range rows {
        id, err := s.indexer.GetOrCreateID(row.Labels)
        if err != nil {
            return err
        }
        row.MetricID = id
    }
    return s.storage.Insert(rows)
}
```

现在，加一个协议只动「解析」，换一个存储引擎只动「存储」，彼此隔离。

<details>
<summary>💭 想一想：为什么定义职责用「变化的原因」，而不是「功能的个数」？</summary>

**答案**：因为「功能个数」是主观的、可以被无限细分（`Parse` 里还能再拆出 `ParsePrometheus`、`ParseInflux`…），按功能拆没有停止条件。而「变化的原因」是客观的、有限制的——它由业务现实决定。**变化的轴有几条，职责就该切几份**，这个标准才可执行。

</details>

---

## 怎么判断「该不该拆」

给你一个可操作的判据，替代「感觉它太长了」：

> 问自己一句：**这两个职责，会不会因为不同的原因、在不同的时间、由不同的人来改？**

- 会 → 拆开（它们是两根变化轴）。
- 不会 → 可以放在一起（它们其实是一根轴上的两段）。

例如：`Prometheus 解析` 和 `Influx 解析`，会一起随「协议」变化吗？通常**不会一起**——所以它们也不是一个职责，只是同一个 `Parser` 接口下的两个实现。这也顺便引出了下一篇的主题。

---

## 红线：别把 SRP 拆成「类爆炸」

SRP 是六原则里**最容易被滥用**的一条，务必记住边界：

1. **SRP ≠ 一个类只能有一个方法**。`IngestService` 有三个方法没问题，它的职责是「编排」，这是单一职责。
2. **拆分的粒度由「变化轴」决定，不是越细越好**。把每个函数都拆成一个类，得到的是「接口地狱」而不是「高内聚」。
3. **没有变化的地方，不要提前拆**。一个十年不变的解析器，硬拆成五个类是过度设计。

一句话：**SRP 是为了让变化更可控，不是为了满足强迫症。**

---

## 小结

- 职责 = 变化的原因，判断标准是「会不会独立变化」；
- 接入层「归一化 / 索引 / 存储」、控制平面「Config / Task / Status」都是 SRP 的真实落地；
- 拆完之后，你立刻会发现一个尴尬：**加新协议，还得去改那个 `switch`**。

这个尴尬，就是下一篇要解决的。

👉 下一篇：[开放封闭原则 OCP](/design-principles/01-principles/02-ocp.md)

---

<details>
<summary>📌 本文事实来源</summary>

- 归一化（InsertCtx）/ 索引（indexdb）/ 存储三环节：`【实测】` [指标冒险之旅](/observability/victoriametrics/metric-journey.md)
- 控制平面 Config/Task/Status 三 API：`【实测】` [Java Agent 控制平面](/observability/implementation/otel-java-agent-control-plane.md)
- 本节 Go 代码为「真实组件职责的忠实简化」，接口形态为示意 `【推断】`

</details>
