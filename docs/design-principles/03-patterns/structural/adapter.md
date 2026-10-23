# 适配器模式：让「说不同方言」的东西能协作

> 一句话：**把一个接口转换成另一个接口，让原本不兼容的两个东西能一起工作。**
> 就像电源转换插头：墙上的插座和你的电器接口不匹配，加个转接头就能用。

---

## 它解决什么尴尬

你有两个「已经存在」的东西，它们的接口不匹配，但你又**不想改它们**（可能改不了、或者改了代价太大）。适配器在中间做「翻译」，让两者对接。

关键：适配器解决的是**「接口不兼容」**，而不是「功能缺失」。

---

## 真实案例：14 种协议接入（本系列最贴切的落点）

你的 [指标冒险之旅](/observability/victoriametrics/metric-journey.md) 里写过一个绝佳的场景（`【实测】`）：

> 门口来过说 Influx 方言的、说 OTel 方言的、说 Graphite 方言的……14 种不同的语言。但门内传来同一个声音：**「不管你说什么方言，进来后我只认一种。」**

这正是适配器模式：**每种协议是一个「方言」，`InsertCtx` 把它们全部适配成统一的 `rawRow`**。存储层只认 `rawRow`，从不关心原始数据是 Prometheus 还是 Influx。

---

## Go 代码

```go
// 目标接口：存储层只认这个统一格式
type MetricRow struct {
    Name   string
    Labels map[string]string
    Value  float64
    TS     int64
}

// 适配器接口：把"方言"适配成统一格式
type ProtocolAdapter interface {
    Adapt(raw []byte) ([]MetricRow, error)
}

// 适配器 1：Prometheus 方言 → 统一格式
type PrometheusAdapter struct{}

func (p *PrometheusAdapter) Adapt(raw []byte) ([]MetricRow, error) {
    // 解析 Prometheus 文本格式，转成 MetricRow
    return parseProm(raw)
}

// 适配器 2：Influx 方言 → 统一格式
type InfluxAdapter struct{}

func (i *InfluxAdapter) Adapt(raw []byte) ([]MetricRow, error) {
    // 解析 Influx 行协议，转成 MetricRow
    return parseInflux(raw)
}
```

```go
// 存储层：完全不感知协议差异，只处理统一格式
func (s *Storage) Insert(rows []MetricRow) error { /* 只处理 MetricRow */ }
```

加第 15 种协议 = 新写一个 `ProtocolAdapter` 实现，存储层、既有协议零改动。

<details>
<summary>💭 想一想：适配器模式和策略模式，为什么容易混？</summary>

**答案**：两者都是「接口 + 多实现」，但**意图不同**：
- **适配器**：多个实现是「**不同来源 → 同一目标**」的翻译器（Prometheus/Influx → `MetricRow`），接口是被适配出来的「统一目标」；
- **策略**：多个实现是「**同一目标 → 不同算法**」的可选项（多种采样算法），接口是「算法契约」。

一句话区分：**适配器解决「进来的格式不一样」，策略解决「处理的办法不一样」。** 在 14 协议接入里，`ProtocolAdapter` 是适配器；但如果你再抽象一层「解析策略」，那又叠加了策略模式——实际工程里两者经常同时出现。

</details>

---

## 对应原则

- **OCP**：加协议不改存储层，只新增适配器；
- **SRP**：把「协议翻译」这个职责从存储层剥离；
- **DIP**：存储层依赖 `MetricRow` 统一格式，而非各种协议细节。

## 何时别用（红线）

1. **接口本来就兼容**：别硬套适配器，那只是多一层无意义的包装。
2. **能改「被适配方」时，优先改它**。适配器是「改不了对方」时的妥协手段，不是首选。
3. **适配器别夹带业务逻辑**。它只做「翻译」，如果翻译里混进了业务判断，说明职责没分清。

---

<details>
<summary>📌 本文事实来源</summary>

- 14 种协议归一化到统一 rawRow、InsertCtx：`【实测】` [指标冒险之旅](/observability/victoriametrics/metric-journey.md)
- 适配器模式定义：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为示意性简化 `【推断】`

</details>
