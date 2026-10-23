# 迭代器模式：统一遍历方式，别暴露底层结构

> 一句话：**提供一种统一的方式顺序访问集合元素，而不暴露集合的内部结构。**
> 遍历逻辑和集合本身解耦。

---

## 它解决什么尴尬

一个集合可能用数组、链表、树、流等不同结构存储。如果让调用方「亲自」去遍历，就得知道每种结构的内部细节（`for i := 0; i < len(arr); i++` 还是 `node = node.next`）。

迭代器模式把「怎么遍历」封装起来，调用方只说「下一个」「还有没有」，不关心底层是数组还是流。

---

## APM 落点：遍历时间序列 / Span 批次

APM 里大量场景需要「遍历」：遍历一个时间序列的所有采样点、遍历一个 Trace 里的所有 Span、遍历一批上报数据（`【业界通用】` 时序/链路处理常见设计）。用迭代器，处理方不需要知道这些数据底层是切片、文件还是流式 chunk。

---

## Go 代码

```go
// 迭代器接口：统一"下一个 + 取值"
type Iterator[T any] interface {
    Next() bool  // 是否还有下一个
    Value() T    // 当前元素
}

// 具体实现：基于切片的时间序列迭代器
type SampleSeries struct {
    samples []Sample
    pos     int
}

func (s *SampleSeries) Next() bool {
    s.pos++
    return s.pos < len(s.samples)
}

func (s *SampleSeries) Value() Sample {
    return s.samples[s.pos]
}

// 使用方：只依赖 Iterator，不关心底层是切片还是别的
func sumSamples(it Iterator[Sample]) float64 {
    var sum float64
    for it.Next() {
        sum += it.Value().Value
    }
    return sum
}
```

<details>
<summary>💭 想一想：Go 里其实很少写「迭代器对象」，为什么？</summary>

**答案**：因为 Go 有更符合语言习惯的做法——**`channel` 和 `range`**。比如 `for sample := range series.channel()` 就是流式迭代。Go 官方直到 1.23 才引入 `iter` 包（`for range` 迭代器），在此之前社区多用 channel 或回调。所以：**在 Go 里，迭代器模式的价值更多是「思想」——让遍历和集合解耦；而落地时，优先用 `range`/`channel`，而不是手写 `Next/Value` 对象。**

</details>

---

## 对应原则

- **SRP**：遍历逻辑（迭代器）与存储逻辑（集合）分离；
- **封装**：不暴露集合内部结构，改变存储结构不影响遍历方。

## 何时别用（红线）

1. **Go 里优先用 `range` / `channel`**，除非需要「统一的跨集合遍历接口」，否则手写迭代器对象是反模式。
2. **只有一个集合类型、遍历方式固定**：直接 `for range` 即可，别抽象。
3. **需要「边遍历边修改」的场景**：迭代器的失效语义（fail-fast）要处理清楚，否则容易踩并发/修改的坑。

---

<details>
<summary>📌 本文事实来源</summary>

- 遍历时间序列/span 批次：`【业界通用】` OTel/时序库常见数据处理
- 迭代器模式定义：`【业界通用】` GoF《设计模式》
- Go `range`/`channel` 惯用法：`【业界通用】` Go 语言设计
- 本节 Go 代码为示意性简化 `【推断】`

</details>
