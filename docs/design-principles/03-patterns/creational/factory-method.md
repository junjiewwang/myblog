# 工厂方法模式：把 `new` 藏起来

> 一句话：**用一个「工厂方法」来创建对象，让调用方不用 `new` 具体类，只依赖抽象接口。**
> 创建逻辑和创建对象的使用逻辑解耦。

---

## 它解决什么尴尬

调用方如果直接 `new` 一个具体类型，就**绑死**了那个具体实现——将来想换成另一个实现，得改调用方。

工厂方法把「创建哪个具体对象」这个决定，收敛到一个工厂方法里。调用方只拿到抽象接口，不关心、也不知道具体创建的是谁。

---

## APM 落点：协议解析器的创建

接入层要根据「协议类型」创建对应的 parser（`【实测】` [指标冒险之旅](/observability/victoriametrics/metric-journey.md) 的 14 协议归一化）。调用方只想要一个 `Parser`，具体创建 `PrometheusParser` 还是 `InfluxParser`，交给工厂。

---

## Go 代码

```go
// 产品：解析器接口
type Parser interface {
    Parse(data []byte) ([]Row, error)
}

// 产品实现
type PrometheusParser struct{}
type InfluxParser struct{}

// 工厂方法：根据协议创建对应的 parser
func NewParser(protocol string) (Parser, error) {
    switch protocol {
    case "prometheus":
        return &PrometheusParser{}, nil
    case "influx":
        return &InfluxParser{}, nil
    default:
        return nil, ErrUnsupportedProtocol
    }
}

// 调用方：只依赖 Parser 接口，不关心具体是哪个 parser
func ingest(protocol string, data []byte) error {
    parser, err := NewParser(protocol) // 工厂方法创建
    if err != nil {
        return err
    }
    rows, err := parser.Parse(data) // 只用抽象接口
    return store(rows)
}
```

`ingest` 不 `new` 任何具体 parser，也不 import 它们的具体类型——**创建的决定权在工厂，使用方零耦合具体类。**

<details>
<summary>💭 想一想：工厂方法的核心价值，是「少写几行 new」吗？</summary>

**答案**：不是。核心价值是「**创建与使用解耦**」——调用方从「依赖具体类型」变成「依赖抽象接口」。这样：① 换实现不改调用方；② 创建逻辑（可能含缓存、初始化、选择逻辑）集中在一处；③ 和 DIP 配合，让高层彻底不碰低层具体类。**「少写 new」只是表象，「解耦」才是本质。**

</details>

---

## 对应原则

- **DIP**：调用方依赖 `Parser` 抽象，不依赖具体 parser；
- **OCP**：加新协议 = 工厂里加一个分支 + 新增一个 parser 实现；
- **SRP**：把「创建哪个对象」的职责，从调用方剥离到工厂。

## 何时别用（红线）

1. **创建逻辑简单到「一个 new」就够**：工厂方法反而多一层间接。等创建逻辑有「选择、复用、初始化」等复杂度时再上。
2. **别把工厂做成「上帝工厂」**：一个工厂方法塞几十个分支，说明该按职责拆分了。
3. **Go 里惯用「构造函数 + 接口」**：`NewParser` 返回接口，本身就是工厂方法的最简形态，不必非要搞「工厂接口 + 具体工厂」的 Java 式重结构。

---

<details>
<summary>📌 本文事实来源</summary>

- 14 协议归一化、按协议创建 parser：`【实测】` [指标冒险之旅](/observability/victoriametrics/metric-journey.md)
- 工厂方法模式定义：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为示意性简化 `【推断】`

</details>
