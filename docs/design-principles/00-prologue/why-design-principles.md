# AI 都会写代码了，为什么你反而要懂设计原则

> 一句话：**设计原则不是写给编译器看的，是写给「未来的你」和「你的 AI」看的。**

---

## 一个让你后怕的下午

你让 AI 帮你写一个「指标接入」的小模块：把 Prometheus 的指标数据解析一下，存起来。

AI 三秒钟吐出一段代码，能跑，测试也过。你高高兴兴合入了。

三个月后，产品说：「再加一个 InfluxDB 协议的支持。」你打开那段代码，愣住了——逻辑全堆在一个 200 行的 `func handle(w http.ResponseWriter, r *http.Request)` 里：协议判断、解析、写索引、写存储、错误处理，全都缠在一起。

你想改，但每动一行，都可能牵动另外五个 if-else。

**代码不是「能跑」就够了，它还要「能被未来的你改得动」。** 而 AI 只对「现在能跑」负责，不会对「三年后的你会不会骂它」负责。

<details>
<summary>💭 想一想：为什么 AI 能生成能跑的代码，却生成不了「能改的代码」？</summary>

**答案**：AI 的训练目标是「给定输入产出正确输出」，它天然只优化「当下正确」，不优化「未来可变」。而「可变」恰恰是设计原则的全部意义——**原则是写给变化的**。AI 缺的不是写代码的能力，而是「预见变化」的动机。这个动机，只能由懂原则的人喂给它。

</details>

---

## 设计原则，到底在解决什么

先破一个误会：**设计原则不是道德教条，不是「这样写才优雅」的审美洁癖。**

它是工程界用几十年的血泪换来的一组结论，回答的只有一个问题：

> **当需求变化时，代码改动的代价能不能被控制住？**

一个系统的成本，绝大多数不在「第一次写出来」，而在「之后每一次改动」。设计原则和设计模式，本质是**把变化的代价，提前锁进一个可控的范围**。

用一句话串起这一整个系列：

| 层 | 解决什么 | 一句话 |
|----|----------|--------|
| 六大原则 | 变化的**方向** | 让变化只发生在该发生的地方 |
| 工程实践 | 变化的**尺度** | 怎么衡量"改起来不痛" |
| 设计模式 | 变化的**招式** | 面对具体变化，用哪套成熟打法 |
| 业务实践 | 变化的**权衡** | 什么时候该为原则停下来 |
| Agent 时代 | 变化的**指挥** | 怎么让 AI 按这套规矩写 |

---

## 贯穿本系列的主角：一个 APM「数据工厂」

接下来的所有文章，我们都用**同一个案例**：一条监控数据，从探针进厂，一路走到落地。这座「数据工厂」有四层车间：

```mermaid
flowchart LR
    A["🚪 接入层<br/>多协议归一化<br/>Agent 管控 · 采样"] --> B["🔧 计算层<br/>拓扑配对 · 聚合"]
    B --> C["🏬 存储层<br/>索引 · 编码 · 压缩"]
    C --> D["📦 查询层<br/>指标检索 · PromQL"]
```

这四层不是我编的，每一层都来自这个博客里真实写过的工程：

- **接入层**：14 种协议（Prometheus/Influx/OTel/Graphite…）归一化成统一的 `rawRow`；Agent 控制平面的 Config/Task/Status 三 API；头部/尾部采样——见 [指标冒险之旅](/observability/victoriametrics/metric-journey.md)、[控制平面](/observability/implementation/otel-java-agent-control-plane.md)、[延迟采样](/observability/design/otel-tail-based-sampling.md)。
- **计算层**：`servicegraphconnector` 的 peer.service 配对与聚合——见 [服务拓扑](/observability/design/service-topology-design.md)。
- **存储层**：VictoriaMetrics 的 `indexdb`/`TSID`、布隆过滤器——见 [指标冒险之旅](/observability/victoriametrics/metric-journey.md)、[布隆过滤器](/observability/victoriametrics/bloom-filter-gatekeeper.md)。
- **探针状态**：Arthas 生命周期状态机——见 [Arthas 生命周期](/observability/arthas/otel-arthas-lifecycle-management.md)。

选择它当案例，只有一个原因：**真实**。它让每一个原则、每一个模式，都能落在一个你能回链验证的真实代码上，而不是一个「假设你有一个购物车」的玩具。

---

## 先看一眼：这座工厂的「违章建筑」长什么样

在讲任何原则之前，先给你看第一版接入层的真实画风（Go，已做简化，但味道是真的）：

```go
// 一段"能跑"的指标接入：协议判断、解析、索引、存储全缠在一起
func handleWrite(w http.ResponseWriter, r *http.Request) {
    body, _ := io.ReadAll(r.Body)
    contentType := r.Header.Get("Content-Type")

    switch contentType {
    case "application/x-prometheus":
        // 解析 Prometheus 文本格式
        lines := strings.Split(string(body), "\n")
        for _, line := range lines {
            name, labels, value, ts := parsePromLine(line)
            id := indexDB.GetOrCreateID(name, labels) // 写索引
            storage.Insert(id, ts, value)             // 写存储
        }
    case "application/influx":
        // 解析 Influx 行协议...（又是一段类似逻辑）
        for _, line := range strings.Split(string(body), "\n") {
            name, labels, value, ts := parseInfluxLine(line)
            id := indexDB.GetOrCreateID(name, labels)
            storage.Insert(id, ts, value)
        }
    // 每加一种协议，这里就多一个 case……
    default:
        w.WriteHeader(400)
    }
}
```

这段代码**能跑**。但它有三个致命的「变化炸弹」：

1. **加一种协议**，就要在这个函数里再加一个 `case`（改「老代码」）；
2. **解析逻辑、索引逻辑、存储逻辑**三种职责焊死在一起，任何一处变化都要动这个函数；
3. 没有任何可测的边界——你想单独测「Prometheus 解析」都无从下手。

接下来的六篇文章，就是逐个拆掉这三颗炸弹。而拆第一颗，我们要先回答一个问题：

> **一个函数，到底该干几件事？**

👉 下一篇：[单一职责原则 SRP](/design-principles/01-principles/01-srp.md)

---

<details>
<summary>📌 本文事实来源</summary>

- 14 种协议归一化、rawRow、indexdb/TSID：`【实测】` [指标冒险之旅](/observability/victoriametrics/metric-journey.md)
- 控制平面三 API：`【实测】` [Java Agent 控制平面](/observability/implementation/otel-java-agent-control-plane.md)
- 本节"违章建筑"代码：为说明问题的示意性简化，非博客工程源码 `【推断】`

</details>
