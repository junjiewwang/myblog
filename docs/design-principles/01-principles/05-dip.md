# 依赖倒置原则（DIP）：高层不该跪舔低层，都该依赖抽象

> 一句话：**高层模块不该依赖低层模块，两者都应依赖抽象；抽象不该依赖细节，细节应依赖抽象。**

---

## 从 ISP 的「接口」说起

上一篇我们用 ISP 把接口拆小了。但拆完之后，一个更根本的问题浮出水面：

> 这些接口，到底该由**谁**来定义？依赖的方向，该朝**哪边**流？

传统写法里，依赖方向是「自顶向下」的：`查询服务` → `VictoriaMetrics 客户端`。高层模块（业务逻辑）直接依赖低层模块（具体存储）。**DIP 就是要把这个方向倒过来。**

---

## 原则是什么

DIP（Dependency Inversion Principle）：

> High-level modules should not depend on low-level modules. Both should depend on abstractions.
> Abstractions should not depend on details. Details should depend on abstractions.

拆成两句：

1. **高层不依赖低层，两者都依赖抽象**；
2. **抽象不依赖细节，细节依赖抽象**。

注意，是 **Inversion（倒置）**，不是 **Injection（注入）**——它说的不是「怎么把对象传进去」，而是「**依赖的箭头该指向谁**」。

---

## 真实案例：查询层不该认识 VictoriaMetrics

APM 的查询层要「查指标」，它的业务逻辑是「查最近 1 小时 CPU 趋势」，跟「数据到底存在 VM 还是 ClickHouse」**没有半毛钱关系**（`【业界通用】` 查询/存储分层设计）。

**反例**：高层直接依赖低层具体实现：

```go
// 查询服务直接 import 了具体存储，高层"跪舔"低层
type QueryService struct {
    vm *victoriametrics.Client // 依赖具体实现
}

func (q *QueryService) CPUUsageLastHour(host string) ([]Sample, error) {
    return q.vm.QueryRange(...) // 一换存储引擎，这里全要改
}
```

问题：哪天把 VM 换成 ClickHouse，`QueryService` 的每一处 `q.vm.xxx` 都要改。**高层的业务逻辑，被低层的技术选型绑架了。**

**正例**：高层依赖抽象，低层实现抽象：

```go
// 抽象由"使用方"（查询层）定义：我要的是"能查时序"的能力
type QueryEngine interface {
    QueryRange(q Query) ([]Sample, error)
}

// 高层只依赖抽象
type QueryService struct {
    engine QueryEngine // 依赖抽象，不依赖任何具体存储
}

func (q *QueryService) CPUUsageLastHour(host string) ([]Sample, error) {
    return q.engine.QueryRange(Query{
        Metric: "cpu_usage",
        Label:  "host=" + host,
        Range:  time.Hour,
    })
}

// 低层的具体实现，反过来"向上"依赖抽象
type VictoriaMetricsEngine struct{}
func (v *VictoriaMetricsEngine) QueryRange(q Query) ([]Sample, error) { /* 具体实现 */ }
```

现在，换存储引擎 = 新写一个 `ClickHouseEngine` 实现 `QueryEngine`，`QueryService` 一行不动。

<details>
<summary>💭 想一想：「倒置」到底倒的是什么？</summary>

**答案**：倒的是**依赖的箭头方向**。传统架构里依赖是「高层 → 低层」（自顶向下）；DIP 把它倒成「高层 → 抽象 ← 低层」。关键变化是：**抽象的定义权，从「实现者」手里，交到了「使用者」手里**。`QueryEngine` 是查询层（使用者）定义的，因为它才知道自己「需要什么」，而不是存储层（实现者）规定自己「能提供什么」。

</details>

---

## DIP vs 依赖注入（DI）：别混为一谈

这是最容易混淆的一对：

| | 是什么 | 关系 |
|--|--------|------|
| **DIP** | 一个**原则**：依赖要朝向抽象 | 目标 |
| **DI**（依赖注入） | 一个**手段**：把依赖从外部传进来（构造器/方法注入） | 实现 DIP 的常见方式 |

`QueryService{engine: engine}` 这种「构造器注入」是 **DI**；而「`engine` 的类型是 `QueryEngine` 接口而非具体类」这个选择是 **DIP**。**你可以不用 DI 也能遵循 DIP，但 DI 是让 DIP 落地最顺手的方式。**

---

## 红线：不是每个依赖都要抽象

DIP 是六原则里最容易被「玄学化」的一条，务必清醒：

1. **只有「会变的、低层的、技术性的」依赖才需要倒置**。`QueryService` 依赖 `time.Hour` 这种标准库值类型，不需要抽象——它不是「低层模块」，也不会换。
2. **抽象应该由「使用方」定义**。如果抽象由实现方定义，那它本质上还是「细节」，DIP 形同虚设。
3. **不要为了 DIP 给每个结构体都配一个接口**。Go 里「接口在使用方定义、小接口」的哲学，天然帮你控制 DIP 的滥用范围。

---

## 小结

- DIP = 依赖箭头朝向抽象，抽象由使用方定义；
- 查询层依赖 `QueryEngine` 抽象、而非具体 VM，是 DIP 的典型落地；
- 但即使依赖了抽象，还要问一句：**抽象有没有把低层内部的细节「漏」给高层？** 高层是不是还在「穿越」抽象去摸内部的零件？

这个「别摸内部零件」的问题，就是下一篇的主角。

👉 下一篇：[迪米特法则 LoD](/design-principles/01-principles/06-lod.md)

---

<details>
<summary>📌 本文事实来源</summary>

- 查询/存储分层、存储引擎替换的变化轴：`【业界通用】` OTel/时序数据库常见设计
- 控制平面 ControlPlaneClient 的 HTTP/Protobuf 与 gRPC 双实现（接口抽象实例）：`【实测】` [Java Agent 控制平面](/observability/implementation/otel-java-agent-control-plane.md)
- 本节 Go 代码为示意性简化 `【推断】`

</details>
