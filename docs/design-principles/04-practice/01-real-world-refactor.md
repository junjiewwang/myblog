# 重构实战：把「600 行 if-else」一步步救回来

> 一句话：**这一篇把前面所有原则和模式串起来，走一遍真实的「坏味道 → 选原则 → 选模式 → 重构 → 验收」完整闭环。**
> 不是讲新知识，是把散落的知识「用起来」。

---

## 起点：一段真实存在的烂代码

回到序章那栋「违章建筑」——接入层的指标写入函数。它「能跑」，但每加一个协议都要改它：

```go
func handleWrite(w http.ResponseWriter, r *http.Request) {
    body, _ := io.ReadAll(r.Body)
    contentType := r.Header.Get("Content-Type")

    switch contentType {
    case "application/x-prometheus":
        for _, line := range strings.Split(string(body), "\n") {
            name, labels, value, ts := parseProm(line)     // ① 解析
            id := indexDB.GetOrCreateID(name, labels)      // ② 索引
            storage.Insert(id, ts, value)                  // ③ 存储
        }
    case "application/influx":
        for _, line := range strings.Split(string(body), "\n") {
            name, labels, value, ts := parseInflux(line)   // 又是①解析
            id := indexDB.GetOrCreateID(name, labels)      // 又是②索引
            storage.Insert(id, ts, value)                  // 又是③存储
        }
    // 每加一种协议，这里就多一个 case，① ② ③ 复制粘贴一遍
    default:
        w.WriteHeader(400)
    }
}
```

**先别急着动手，用前面学的知识「诊断」它**：

| 坏味道 | 违反了谁 |
|--------|----------|
| 解析 / 索引 / 存储三职责焊死 | SRP、高内聚 |
| 加协议要改 `switch` | OCP、可扩展性 |
| 直接依赖具体 `indexDB`、`storage` | DIP |
| 测不了（要真的连存储） | 可测试性 |

诊断清楚了，才能对症下药。**重构的第一步永远是「识别」，不是「动手」。**

---

## 第一步：SRP——按「变化轴」拆职责

先拆最痛的三根变化轴（解析 / 索引 / 存储），它们会因**不同的原因**变化：

```go
// 变化轴 1：解析（随协议种类变）
type Parser interface {
    Parse(data []byte) ([]RawRow, error)
}

// 变化轴 2：索引（随标签模型变）
type Indexer interface {
    GetOrCreateID(labels Labels) (uint64, error)
}

// 变化轴 3：存储（随存储引擎变）
type Storage interface {
    Insert(rows []RawRow) error
}
```

这一步是 SRP + 高内聚：每个接口只为「一个变化原因」而存在。

---

## 第二步：适配器 + 工厂 + 注册表——解决 OCP

拆完职责，`switch` 还在。用「适配器（协议翻译）+ 工厂方法（创建）+ 注册表（扩展点）」彻底消灭它：

```go
// 适配器：每种协议一个，把"方言"适配成统一 RawRow
type PrometheusParser struct{}
func (p *PrometheusParser) Parse(data []byte) ([]RawRow, error) { /* 只解析 Prometheus */ }

type InfluxParser struct{}
func (p *InfluxParser) Parse(data []byte) ([]RawRow, error) { /* 只解析 Influx */ }

// 注册表 + 工厂：协议名 → 解析器，加协议"只增不改"
var parsers = map[string]func() Parser{}

func Register(name string, factory func() Parser) { parsers[name] = factory }
func GetParser(contentType string) (Parser, error) {
    f, ok := parsers[contentType]
    if !ok {
        return nil, ErrUnsupportedProtocol
    }
    return f(), nil
}

func init() {
    Register("application/x-prometheus", func() Parser { return &PrometheusParser{} })
    Register("application/influx", func() Parser { return &InfluxParser{} })
}
```

这一步是 OCP + 适配器 + 工厂方法：加协议 = 新写一个 parser + 一行 `Register`，核心零改动。

---

## 第三步：依赖注入——让核心「可测」

把依赖（indexer、storage）通过构造器注入，核心流程依赖抽象：

```go
// 核心编排：依赖抽象，注入具体实现
type IngestService struct {
    indexer Indexer
    storage Storage
}

func NewIngestService(indexer Indexer, storage Storage) *IngestService {
    return &IngestService{indexer: indexer, storage: storage}
}

func (s *IngestService) Ingest(contentType string, data []byte) error {
    parser, err := GetParser(contentType)
    if err != nil {
        return err
    }
    rows, err := parser.Parse(data)
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

这一步是 DIP + 可测试性：核心流程只认接口，测试时注入 fake 即可。

---

## 第四步：用「可测试性」验收重构成果

**重构是否成功，不是看代码「好看」，而是看它「能不能测」。** 重构前，那段 600 行代码根本没法单测（要真的连存储）；重构后：

```go
func TestIngest(t *testing.T) {
    // 注入 fake 依赖，不连真实存储
    fakeIndexer := &FakeIndexer{}
    fakeStorage := &FakeStorage{}
    svc := NewIngestService(fakeIndexer, fakeStorage)

    err := svc.Ingest("application/x-prometheus", []byte("cpu_usage 0.42 123"))
    // 断言：解析正确、索引正确、存储正确
}
```

<details>
<summary>💭 想一想：为什么说「可测试性」是重构的验收标准？</summary>

**答案**：因为可测试性是前面所有原则的「综合结果」。一段代码如果 SRP、OCP、DIP 都做到了，它**必然**可测；反之，测不了的代码，一定是某条原则没到位。所以「重构完敢不敢写测试」，就是「重构成没成功」的最诚实检验——**测试不是目的，是镜子。**

</details>

---

## 完整闭环回顾

```
① 识别坏味道  →  SRP/OCP/DIP 违反、不可测
② 选原则      →  SRP 拆职责、OCP 封闭变化、DIP 依赖抽象
③ 选模式      →  适配器（协议翻译）+ 工厂方法（创建）+ 注册表（扩展点）
④ 重构        →  职责分离 + 可扩展 + 依赖注入
⑤ 验收        →  用单测证明「可测」了
```

这就是整个系列想让你掌握的能力：**不是背 6 原则 23 模式，而是面对一段烂代码，能顺着这条闭环，一步步把它救回来。**

---

<details>
<summary>📌 本文事实来源</summary>

- 14 协议归一化、解析/索引/存储三环节：`【实测】` [指标冒险之旅](/observability/victoriametrics/metric-journey.md)
- 本节重构前后代码为「基于真实职责的示意性简化」 `【推断】`，重构路径综合了本系列的原则与模式

</details>
