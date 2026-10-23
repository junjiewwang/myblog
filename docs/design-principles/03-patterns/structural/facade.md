# 门面模式：给复杂子系统一个「前台」

> 一句话：**为复杂的子系统提供一个统一的、简化的入口，屏蔽内部的复杂细节。**
> 像酒店前台：你只需要找「前台」，不用关心「房间是谁打扫的、餐厅怎么运转」。

---

## 它解决什么尴尬

一个子系统内部有多个类、多套复杂交互。调用方如果直接和它们打交道，就得理解一堆内部细节，而且子系统一改，调用方全崩。

门面模式提供一个「前台」：调用方只和门面交互，门面内部负责调度那些复杂组件。

---

## APM 落点：查询层的统一入口

APM 的查询能力分散在多个服务里——查指标、查链路、查日志，每个都有自己的内部逻辑（`【业界通用】` 可观测平台常见设计）。对外暴露一个 `QueryFacade`，调用方只说「我要查什么」，门面内部去分派给对应的查询服务。

---

## Go 代码

```go
// 内部子系统：三个查询服务，各自复杂
type MetricQueryService struct{}
type TraceQueryService struct{}
type LogQueryService struct{}

func (m *MetricQueryService) QueryByPromQL(ql string) []Sample { /* 复杂逻辑 */ }
func (t *TraceQueryService) QueryByTraceID(id string) []Span   { /* 复杂逻辑 */ }
func (l *LogQueryService) QueryByKeyword(kw string) []Log      { /* 复杂逻辑 */ }

// 门面：统一、简化的对外入口
type QueryFacade struct {
    metric *MetricQueryService
    trace  *TraceQueryService
    log    *LogQueryService
}

// 调用方只需一个方法，不关心内部是哪个服务
func (f *QueryFacade) Query(req QueryRequest) (QueryResult, error) {
    switch req.Kind {
    case "metric":
        return QueryResult{Samples: f.metric.QueryByPromQL(req.Expr)}, nil
    case "trace":
        return QueryResult{Spans: f.trace.QueryByTraceID(req.ID)}, nil
    case "log":
        return QueryResult{Logs: f.log.QueryByKeyword(req.Keyword)}, nil
    default:
        return QueryResult{}, ErrUnsupportedKind
    }
}
```

调用方从「理解三个服务」简化为「只认一个门面」。将来内部把 `MetricQueryService` 换成 ClickHouse 实现，只要门面接口不变，调用方无感。

<details>
<summary>💭 想一想：门面模式和适配器模式，都「包了一层」，怎么区分？</summary>

**答案**：看**包装的目的**：
- **门面**：目的是「**简化**」——把复杂的多接口，收敛成一个简单接口（多个东西 → 一个入口）；
- **适配器**：目的是「**兼容**」——把不匹配的接口，转换成匹配的接口（一个东西 → 一个目标格式）。

一句话：**门面是「化繁为简」，适配器是「方言翻译」。** 14 协议归一化是适配器（翻译方言），查询统一入口是门面（简化调用）。

</details>

---

## 对应原则

- **LoD**：调用方只和门面这个「直接朋友」打交道，不摸内部子系统；
- **SRP**：把「对外提供简化接口」的职责从子系统里剥离；
- **封装**：隐藏子系统内部复杂性。

## 何时别用（红线）

1. **子系统本来就不复杂**：门面会变成「无意义的转发层」，直接调用更清晰。
2. **门面变成「上帝类」**：所有请求都从门面过，门面会越来越大，要警惕（同中介者模式的坑）。
3. **调用方需要用到子系统的「高级能力」**：门面只暴露通用能力，如果需要精细控制，别硬塞进门面，给调用方留直达通道。

---

<details>
<summary>📌 本文事实来源</summary>

- 指标/链路/日志统一查询入口：`【业界通用】` 可观测平台常见架构设计
- 门面模式定义：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为示意性简化 `【推断】`

</details>
