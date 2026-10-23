# 装饰器模式：无侵入地给对象「加 buff」

> 一句话：**动态地给一个对象增加额外行为，而不改变它的接口、不影响其他对象。**
> 像「套娃」：核心对象外面套一层又一层的增强。

---

## 它解决什么尴尬

你想给一个对象「附加能力」——比如给数据导出器加上「重试」「限流」「日志」。如果直接改导出器的代码，那这些能力就和核心逻辑焊死了，而且不同组合（只要重试、只要日志、都要）会写出一堆子类。

装饰器让「能力」变成一层层**可组合的外壳**：核心对象保持纯粹，能力按需套上去。

---

## APM 落点：Exporter 的能力叠加

APM 的数据导出（Exporter）常常需要叠加多种能力：**重试、限流、日志、加密、超时**（`【业界通用】` OTel exporter 常见增强）。用装饰器，核心 `OTLPExporter` 只负责「发送」，其他能力各是一个装饰器，按需组合。

---

## Go 代码

```go
// 目标接口：核心能力
type Exporter interface {
    Export(metrics []Metric) error
}

// 被装饰的核心对象：只做"发送"
type OTLPExporter struct{}

func (o *OTLPExporter) Export(metrics []Metric) error {
    return sendViaGRPC(metrics) // 核心逻辑
}

// 装饰器 1：重试
type RetryExporter struct {
    inner    Exporter
    maxRetry int
}

func (r *RetryExporter) Export(metrics []Metric) error {
    var err error
    for i := 0; i <= r.maxRetry; i++ {
        if err = r.inner.Export(metrics); err == nil {
            return nil
        }
    }
    return err
}

// 装饰器 2：日志
type LoggingExporter struct {
    inner Exporter
}

func (l *LoggingExporter) Export(metrics []Metric) error {
    log.Printf("exporting %d metrics", len(metrics))
    err := l.inner.Export(metrics)
    log.Printf("export done, err=%v", err)
    return err
}
```

```go
// 按需组合：像套娃一样叠加能力
core := &OTLPExporter{}
withRetry := &RetryExporter{inner: core, maxRetry: 3}
withLog := &LoggingExporter{inner: withRetry} // 日志包着重试包着核心
withLog.Export(metrics)
```

「重试」和「日志」**没有侵入** `OTLPExporter` 一行代码，却可以任意叠加、任意组合。

<details>
<summary>💭 想一想：装饰器和「子类继承」有什么区别？</summary>

**答案**：装饰器用「**组合**」而非「继承」，因此**能力可以在运行时动态组合**。继承方案里，「重试+日志」「只重试」「只日志」要写三个子类；装饰器方案里，只要按需嵌套三个对象。更关键的是：装饰器**不改接口**，所以装饰后的对象还能继续被别的装饰器装饰——组合是无限的，继承是有限的。这也是「组合优于继承」这条原则的典型体现。

</details>

---

## 对应原则

- **OCP**：加能力不改核心对象，新增装饰器即可；
- **组合优于继承**：能力通过组合叠加，而非继承爆炸；
- **SRP**：每种能力（重试/日志/限流）一个装饰器，职责单一。

## 何时别用（红线）

1. **能力是核心逻辑的一部分**（不是「附加」）：别硬拆成装饰器，直接写进核心。
2. **装饰器套太多层**：每层都是一次间接调用，层数多了难调试、性能下降，要有节制。
3. **装饰器之间的顺序有依赖**：比如「限流必须在重试之前」，这种顺序约束会让组合变得脆弱，要留意。

---

<details>
<summary>📌 本文事实来源</summary>

- Exporter 的重试/限流/日志等增强：`【业界通用】` OpenTelemetry exporter 常见设计（如 retry、queue）
- 装饰器模式定义、组合优于继承：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为示意性简化 `【推断】`

</details>
