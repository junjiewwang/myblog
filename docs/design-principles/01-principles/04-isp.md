# 接口隔离原则（ISP）：别逼客户端依赖它用不上的接口

> 一句话：**接口要小到「每个使用者都能用上它的全部方法」。**
> 客户端不应该被迫依赖它用不上的方法。

---

## 从 LSP 的「根子」说起

上一篇结尾我们挖到了 LSP 违反的根子：**接口太胖**。`QueryEngine` 塞了 `QueryRange` 和 `QueryPoint` 两个方法，结果「只支持即时查询」的 `LiteEngine` 被迫去实现一个它兑现不了的 `QueryRange`。

这不是 `LiteEngine` 的错，是**接口设计者的错**——你给了一个过胖的接口，逼着实现者撒谎。

**ISP 就是来解决「接口太胖」的。**

---

## 原则是什么

ISP（Interface Segregation Principle）：

> Clients should not be forced to depend upon interfaces that they do not use.
> —— 客户端不应该被迫依赖它们用不上的接口。

翻译成人话：

> **接口应该按「使用者的需要」来切，切到「每个使用者恰好用得上全部方法」为止。**

注意它的视角：SRP 是从**实现者**（「我的类该干什么」）看问题，ISP 是从**使用者**（「我到底需要哪几个方法」）看问题。同一个接口，对使用者太胖，就该拆。

---

## 真实案例：控制平面的三个 API

你的控制平面文章里，Config / Task / Status 拆成了三个独立 API（`【实测】` [Java Agent 控制平面](/observability/implementation/otel-java-agent-control-plane.md)）。这不仅是 SRP（三个职责），更是 **ISP** 的体现——因为它们的**使用者**完全不同：

| 接口 | 使用者 | 需要的方法 |
|------|--------|-----------|
| Config API | 配置轮询器 | `GetConfig()` |
| Task API | 任务执行器 | `SubmitTask()` |
| Status API | 状态上报器 | `ReportStatus()` |

一个「配置轮询器」根本不需要 `SubmitTask` 和 `ReportStatus`。如果把它们塞进一个 `AgentAPI` 大接口，那么每个使用方都要被迫「看见」一堆自己用不上的方法——改动任何一个方法，都会波及所有使用方。

---

## 正反对比（Go）

**反例**：一个胖接口，所有客户端被迫依赖全部方法：

```go
// 胖接口：配置、任务、状态、日志全塞在一起
type AgentAPI interface {
    GetConfig() (Config, error)
    SubmitTask(t Task) error
    ReportStatus(s Status) error
    GetLogs(offset int64) ([]Log, error) // 大部分客户端根本用不上
}
```

任何一处签名变化（比如给 `SubmitTask` 加个参数），都会强迫「配置轮询器」「状态上报器」这些无关方跟着重新编译、重新适配。

**正例**：按使用者拆成多个瘦接口：

```go
// 三个瘦接口，各管各的使用者
type ConfigClient interface {
    GetConfig() (Config, error)
}

type TaskClient interface {
    SubmitTask(t Task) error
}

type StatusClient interface {
    ReportStatus(s Status) error
}
```

现在，配置轮询器只依赖 `ConfigClient`，`SubmitTask` 怎么改都与它无关。**每个客户端只依赖它真正需要的那一小块。**

<details>
<summary>💭 想一想：ISP 和 SRP 到底有什么区别？</summary>

**答案**：它们是一枚硬币的两面，但**出发点相反**：
- **SRP** 站在**实现者**角度：一个类不该有多个变化原因 → 拆「类」。
- **ISP** 站在**使用者**角度：一个接口不该让客户端被迫依赖用不上的方法 → 拆「接口」。

一个典型的例子：一个类的实现恰好是单一职责（SRP 没问题），但它对外暴露的接口对**某个特定调用方**来说太胖了，这时就该用 ISP 去拆分接口。**SRP 治「类」，ISP 治「接口」。**

</details>

---

## 怎么判断「接口太胖」

一个可操作的标准：

> 看每个**使用方**——它是不是被迫「继承」了一堆自己从没调用过的方法？

如果是，接口就太胖了，按使用方的不同需要拆开。判断的关键词是「**被迫**」：一个方法没人用、或者只有某一个特定使用方在用，它就不该待在公共接口里。

---

## 红线：别拆成「接口碎片」

ISP 和 SRP 一样，容易被过度执行：

1. **接口不是越细越好**。如果拆出来的「瘦接口」只有一个方法、且只有一个实现、且这个实现永远只有一个使用方——那就别拆，拆了只增加间接层，没有收益。
2. **拆分要以「真实的使用者」为依据**，不是凭想象。先有第二个、第三个不同需要的使用方，再拆接口。
3. **Go 的接口哲学天然偏 ISP**：`Reader`、`Writer`、`io.ReadWriter` 就是「小接口 + 组合」的典范——宁可让一个类型实现多个小接口，也不要造一个大接口。

---

## 小结

- ISP = 接口按「使用者」切，切到每个使用者用得上全部方法；
- 控制平面 Config/Task/Status 三 API 是 ISP 的真实落地；
- 接口拆小之后，下一个问题浮出水面：**这些接口，到底该由谁来定义、谁来依赖？依赖的方向应该朝哪？**

👉 下一篇：[依赖倒置原则 DIP](/design-principles/01-principles/05-dip.md)

---

<details>
<summary>📌 本文事实来源</summary>

- 控制平面 Config/Task/Status 三 API 及其职责：`【实测】` [Java Agent 控制平面](/observability/implementation/otel-java-agent-control-plane.md)
- `io.Reader/Writer` 小接口组合哲学：`【业界通用】` Go 标准库设计
- 本节 Go 代码为示意性简化 `【推断】`

</details>
