# 抽象工厂模式：成套创建「一族」相关对象

> 一句话：**提供一个创建「一族相关对象」的接口，让一族对象一起被替换。**
> 工厂方法创建一个产品，抽象工厂创建「一套产品」。

---

## 它解决什么尴尬

有时对象是「成族」出现的——比如一个协议，不仅要有「解析器」，还要配套「配置加载器」「编码器」。如果各自单独创建，可能「普罗米修斯的解析器」配上了「Influx 的配置加载器」，出现**不匹配的组合**。

抽象工厂把「一族产品的创建」打包成一个接口，保证**成套创建、成套替换**。

---

## APM 落点：按「协议族」成套创建

接入层支持 14 种协议，每种协议不是只有一个解析器，而是「一套东西」：解析器 + 配置 + 编解码（`【业界通用】` 协议接入常见设计）。抽象工厂保证「一整套都是同一协议的」。

---

## Go 代码

```go
// 一族产品：协议相关的多个组件
type Parser interface {
    Parse(data []byte) ([]Row, error)
}

type ConfigLoader interface {
    Load(raw []byte) (Config, error)
}

// 抽象工厂：创建一个"协议族"的全部产品
type ProtocolFactory interface {
    CreateParser() Parser
    CreateConfigLoader() ConfigLoader
}

// 具体工厂：Prometheus 族
type PrometheusFactory struct{}

func (f *PrometheusFactory) CreateParser() Parser { return &PrometheusParser{} }
func (f *PrometheusFactory) CreateConfigLoader() ConfigLoader {
    return &PrometheusConfigLoader{}
}

// 具体工厂：Influx 族
type InfluxFactory struct{}

func (f *InfluxFactory) CreateParser() Parser { return &InfluxParser{} }
func (f *InfluxFactory) CreateConfigLoader() ConfigLoader {
    return &InfluxConfigLoader{}
}
```

```go
// 使用方：拿到一个"工厂"，成套创建，保证不混搭
func setupProtocol(factory ProtocolFactory) {
    parser := factory.CreateParser()
    loader := factory.CreateConfigLoader()
    // parser 和 loader 一定来自同一协议族
}
```

<details>
<summary>💭 想一想：工厂方法 vs 抽象工厂，一句话怎么分？</summary>

**答案**：看**产品数量**——工厂方法创建「**一个**产品」（`NewParser` 返回一个 `Parser`）；抽象工厂创建「**一族**产品」（`ProtocolFactory` 同时创建 `Parser` 和 `ConfigLoader`）。所以抽象工厂内部往往是「多个工厂方法的组合」。**当你的对象是成套出现、必须成套替换时，才需要抽象工厂。**

</details>

---

## 对应原则

- **OCP**：加新协议族 = 新增一个具体工厂，不改使用方；
- **LSP**：同一族的各产品必须兑现各自接口契约；
- **一致性**：保证「一族对象」成套、不混搭。

## 何时别用（红线）

1. **没有「一族产品」、只有单个产品**：用工厂方法就够了，抽象工厂是过度设计。
2. **产品族会频繁「加减成员」**：抽象工厂的接口每加一个产品，所有具体工厂都要改（这是它的最大痛点）。
3. **Go 里抽象工厂用得少**：因为 Go 的组合哲学下，「返回一个含多组件的 struct」往往比「抽象工厂接口」更直白，先考虑简单方案。

---

<details>
<summary>📌 本文事实来源</summary>

- 协议接入的「解析器 + 配置 + 编解码」成套组件：`【业界通用】` 协议接入常见设计
- 抽象工厂模式定义：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为示意性简化 `【推断】`

</details>
