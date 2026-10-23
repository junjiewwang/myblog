# 开放封闭原则（OCP）：加功能，能不能「只增不改」

> 一句话：**对扩展开放，对修改封闭——把「变化点」隔离到扩展点，让核心流程稳定不变。**
> 新功能应该通过「新增代码」实现，而不是「修改已有代码」。

---

## 上一篇留下的尴尬

上一篇我们按 SRP 把接入层拆成了 `Parser / Indexer / Storage`。但你马上会撞上一个新尴尬——**加一种协议，还是得改老代码**：

```go
func (s *IngestService) Ingest(contentType string, data []byte) error {
    var parser Parser
    switch contentType {          // ← 每加一种协议，就要改这个 switch
    case "application/x-prometheus":
        parser = &PrometheusParser{}
    case "application/influx":
        parser = &InfluxParser{}
    default:
        return ErrUnsupportedProtocol
    }
    // ...后续流程不变
}
```

每加一个协议，你都要：① 打开 `IngestService.go`；② 在这个 `switch` 里加一个 `case`。**你改的不是「新功能」，而是「已经验证过、正在线上跑的流程」。** 这就是 OCP 要解决的痛点。

---

## 原则是什么

OCP（Open-Closed Principle）：

> software entities should be open for extension, but closed for modification.
> —— 软件实体应该对扩展开放，对修改封闭。

翻译成工程语言：

> **加功能时，我应该「新增」一个文件/一个实现，而不是「修改」那些已经稳定的核心逻辑。**

它的实现手段几乎只有一个：**抽象**。把「会变的部分」定义成接口，把「不变的部分」写成依赖接口的稳定流程；变化时，提供接口的**新实现**，核心流程**一行不动**。

---

## 真实案例：14 种协议怎么「只加不改」

这正是你博客里写过的事实（`【实测】` [指标冒险之旅](/observability/victoriametrics/metric-journey.md)）：

> 不管你说什么方言，进来后我只认一种。加协议 = 加一个 parser。

VictoriaMetrics 支持 14 种协议（Prometheus、Influx、OTel、Graphite…），但它接入核心**不是**一个巨型 `switch`，而是「协议 → 解析器」的注册表。加一个新协议，是**新增一个 parser 并注册**，而不是修改既有的接入流程。

---

## 正反对比（Go）

**反例**：`switch` 分发（上文），每加协议改核心。

**正例**：注册表 + 接口，加协议零修改核心：

```go
// 核心流程（对修改封闭）：只认 Parser 接口，不认任何具体协议
type IngestService struct {
    indexer Indexer
    storage Storage
}

func (s *IngestService) Ingest(parser Parser, data []byte) error {
    rows, err := parser.Parse(data)   // 依赖抽象，不依赖具体协议
    if err != nil {
        return err
    }
    for _, row := range rows {
        id, _ := s.indexer.GetOrCreateID(row.Labels)
        row.MetricID = id
    }
    return s.storage.Insert(rows)
}
```

```go
// 扩展点（对扩展开放）：协议通过 init() 自注册，核心流程无需感知
var parsers = map[string]func() Parser{}

func Register(name string, factory func() Parser) {
    parsers[name] = factory
}

func GetParser(contentType string) (Parser, error) {
    f, ok := parsers[contentType]
    if !ok {
        return nil, ErrUnsupportedProtocol
    }
    return f(), nil
}
```

现在加一个 Influx 协议，你**只新增一个文件**，不碰 `IngestService`：

```go
// influx.go —— 新增，不改任何老文件
type InfluxParser struct{}

func (p *InfluxParser) Parse(data []byte) ([]RawRow, error) {
    // 解析 Influx 行协议
}

func init() {
    Register("application/influx", func() Parser { return &InfluxParser{} })
}
```

「扩展」发生在 `influx.go` 这个新文件里；「封闭」体现在 `IngestService` 和 `GetParser` 这两个稳定核心上。

<details>
<summary>💭 想一想：OCP 说「对修改封闭」，是不是意味着永远不改代码？</summary>

**答案**：不是。OCP 反对的是「**为了新增功能去改核心流程**」，不反对「修复 bug」「重构」这些正常修改。而且「封闭」是有方向性的：你无法让所有维度都封闭，只能**选择最重要的变化轴去封闭**。接入层选择封闭「协议种类」这条轴，是因为它是最高频的变化点。

</details>

---

## 怎么落地 OCP：先问「哪根轴会变」

OCP 不是无脑抽象，落地分两步：

1. **识别变化轴**：这个模块未来最可能在哪条轴上变？（接入层 → 协议种类；存储层 → 存储引擎；查询层 → 查询语法）
2. **为那条轴做抽象**：把变化点抽成接口，把稳定流程写成依赖接口的代码。

一条轴的抽象，通常对应一个「扩展点」——在 Go 里最常见的就是**接口 + 注册表（依赖注入容器）**。

---

## 红线：别为「永远不变的东西」买单

OCP 最大的陷阱是**过度抽象**，它和下一篇的 LSP 一起，最容易写出「为了可扩展而可扩展」的代码：

1. **不要一上来就抽象**。先写具体实现，等到**第二处变化出现**时，再抽接口。第一处变化就抽象，往往抽象错方向（这是「过早抽象」）。
2. **不是所有维度都要封闭**。你无法预测所有变化，选最高频的一两条轴封闭即可。
3. **抽象是有代价的**：接口多了，代码跳转成本、理解成本都会上升。为「十年才变一次」的东西上抽象，是负收益。

一句话：**OCP 是为「确定会变」留的门，不是为「可能变」砌的墙。**

---

## 小结

- OCP = 加功能用「新增」而非「修改核心」；
- 手段是抽象 + 注册表，接入层「加协议只加 parser」是它的最佳真实案例；
- 但抽象引入了新问题：**那些实现 `Parser` 接口的「子类」，必须真的能被无差别替换**——否则接口就是纸糊的。

这个「替换」的契约，就是下一篇的主角。

👉 下一篇：[里氏替换原则 LSP](/design-principles/01-principles/03-lsp.md)

---

<details>
<summary>📌 本文事实来源</summary>

- 「14 种协议、加协议只加 parser」：`【实测】` [指标冒险之旅](/observability/victoriametrics/metric-journey.md)
- 注册表 + 接口的扩展点形态：`【业界通用】` Go 常见插件式设计（如 database/sql 的 driver 注册）
- 本节 Go 代码为示意性简化 `【推断】`

</details>
