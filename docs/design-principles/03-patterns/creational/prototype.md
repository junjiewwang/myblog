# 原型模式：克隆一个「模板」

> 一句话：**通过「复制一个现有对象」来创建新对象，而不是重新 `new` 再初始化。**
> 当「新建并初始化」的成本高、或想基于模板快速复制时，用原型。

---

## 它解决什么尴尬

有时创建一个对象很贵：要么构造复杂，要么初始化要读配置、连网络。但你已经有一个「现成的、配置好的」对象，只想复制一份再改一点点。

原型模式给对象提供 `Clone` 能力，从「模板」快速复制。

---

## APM 落点：配置 / Span 模板的克隆

APM 里「Span 模板」「采样配置模板」常被大量复制（`【业界通用】` 数据处理常见设计）：一个基础模板配好默认值，每来一个请求，克隆一份再填自己的字段，避免每次都从头构建。

---

## Go 代码

```go
// 原型对象：Span 模板
type SpanTemplate struct {
    service string
    tags    map[string]string
}

// Clone：克隆一份，注意深拷贝 map（否则共享底层会互相污染）
func (s *SpanTemplate) Clone() *SpanTemplate {
    tags := make(map[string]string, len(s.tags))
    for k, v := range s.tags {
        tags[k] = v // 深拷贝 map
    }
    return &SpanTemplate{service: s.service, tags: tags}
}
```

```go
// 使用：从模板克隆，各自修改互不影响
base := &SpanTemplate{service: "order", tags: map[string]string{"env": "prod"}}

span1 := base.Clone()
span1.tags["trace_id"] = "aaa" // 只改自己

span2 := base.Clone()
span2.tags["trace_id"] = "bbb" // 不影响 span1 和 base
```

<details>
<summary>💭 想一想：原型模式最致命的坑是什么？</summary>

**答案**：是**浅拷贝**。如果 `Clone` 只复制了 `tags` 这个 map 的引用（浅拷贝），那 `span1` 改 `tags`，`span2` 和 `base` 的 `tags` 也会跟着变——三个对象「共享」同一份底层数据，改一处全乱。**原型模式的 Clone 必须对可变字段做深拷贝**，否则就是埋雷。

</details>

---

## 对应原则

- **性能**：复用「已初始化对象」的构建成本；
- **封装**：克隆逻辑封装在对象内部，调用方不关心细节。

## 何时别用（红线）

1. **对象构造简单、便宜**：直接 `new` 就行，Clone 是多余。
2. **对象有复杂引用关系**：深拷贝实现复杂、易错，要评估是否值得。
3. **Go 里原型模式用得少**：Go 没有内建的 `Clone`，通常手写 `Clone()` 方法或直接拷贝 struct。**只在「模板复制」场景真正高频时才值得做**，否则「结构体字面量 + 复制」更直白。

---

<details>
<summary>📌 本文事实来源</summary>

- Span/配置模板复制：`【业界通用】` OTel 数据处理常见模式
- 原型模式定义、深浅拷贝：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为示意性简化 `【推断】`

</details>
