# 享元模式：让「相同的东西」只存一份

> 一句话：**通过共享「不可变的公共对象」，大幅减少内存占用。**
> 享元 = 共享 + 单元，本质是「用共享换内存」。

---

## 它解决什么尴尬

当系统里有海量「内容相同」的对象时，每个都独立存一份是巨大浪费。比如同一个标签 `host="web-1"` 在百万条指标里反复出现，如果每条指标都存一份完整的字符串，内存会爆炸。

享元模式把「公共的、不可变的部分」抽出来共享，每个对象只保存「指向共享部分的引用」。

---

## 真实案例：VictoriaMetrics 的标签字符串共享

这是你博客里真实写过的（`【实测】` [指标冒险之旅](/observability/victoriametrics/metric-journey.md)）：

> 「真身放档案室，内存只放名片」——高基数治理里，标签字符串的**真身只存一份**，内存里放的是**名片**（引用/ID）。

这本质就是享元思想：**相同的标签字符串只存一份真身，海量指标共享这一份**。你博客里提到的 `uint64set` 稀疏/稠密自适应位图，也是同一思路——用更紧凑的共享结构替代重复存储。

---

## Go 代码

```go
// 享元工厂：字符串驻留池，相同字符串只存一份
type StringPool struct {
    mu    sync.Mutex
    cache map[string]string
}

func NewStringPool() *StringPool {
    return &StringPool{cache: make(map[string]string)}
}

// Intern：返回共享的字符串实例
func (p *StringPool) Intern(s string) string {
    p.mu.Lock()
    defer p.mu.Unlock()
    if v, ok := p.cache[s]; ok {
        return v // 命中：返回已存在的共享实例
    }
    p.cache[s] = s // 未命中：存入池中，之后共享
    return s
}
```

```go
// 使用：海量标签都通过驻留池，相同的 host 值只占一份内存
pool := NewStringPool()
labelA := pool.Intern("host=web-1") // 第一次，存入
labelB := pool.Intern("host=web-1") // 命中，共享同一份
// labelA 和 labelB 指向同一份字符串，内存只占一份
```

<details>
<summary>💭 想一想：享元模式的关键前提是什么？</summary>

**答案**：是「**不可变**」。被共享的对象必须是**不可变的**——因为一旦共享，任何一方修改它，所有共享者都会受影响。所以享元模式只适用于「只读的公共数据」（如标签字符串、配置常量）。**可变对象绝不能享元**，否则就是埋一颗「一处改动、处处炸」的雷。

</details>

---

## 对应原则

- **性能/内存优化**：享元是纯「资源优化」模式，不为解耦，为省内存；
- **封装**：把「共享逻辑」藏在工厂里，使用方无感知。

## 何时别用（红线）

1. **对象不多、内存不敏感**：享元引入的「池 + 查找」是有开销的，数据少时反而更慢。
2. **对象可变**：绝对不能享元（见上面思考题）。
3. **查找开销 > 节省的内存**：驻留池的哈希查找有成本，高频小对象要实测权衡。
4. **Go 里字符串天然可比较、可驻留**：Go 的字符串本身是不可变的，`sync.Map` 或 `map` 驻留是常见做法；但别为了享元而享元，先确认「重复」真的存在。

---

<details>
<summary>📌 本文事实来源</summary>

- 标签字符串「真身只存一份、内存放名片」、uint64set 稀疏/稠密位图：`【实测】` [指标冒险之旅](/observability/victoriametrics/metric-journey.md)
- 享元模式定义：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为示意性简化 `【推断】`

</details>
