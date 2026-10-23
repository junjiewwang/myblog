# 🧱 设计原则与模式

> 从抽象的「设计原则」到具体的「设计模式」，再到「业务实践」——回答一个 AI 时代被反复追问的问题：
> **为什么 AI 都能写代码了，我反而更该懂设计原则？**

---

## 这个系列怎么读

不是"背一遍 SOLID 和 23 种模式"，而是沿一条**真实工程主线**逐层深入：

```
道 ── 六大设计原则（为什么这么设计）
  │
术 ── 工程实践原则（怎么衡量"好"）
  │
器 ── 23 种设计模式（具体怎么落地）
  │
用 ── 业务实践（真实场景怎么权衡）
  │
省 ── Agent 时代（怎么让 AI 写出符合原则的代码）
```

## 贯穿案例：一个 APM「数据工厂」

整个系列用**同一个案例**串起来：一条监控数据从探针进厂，一路分拣、加工、入库、出库。四层架构：

| 层 | 职责 | 关键组件（均来自本博客真实工程） |
|----|------|--------------------------------|
| **接入层** | 数据进厂：多协议归一化、Agent 管控、采样 | 14 种协议归一化、控制平面三 API、头部/尾部采样 |
| **计算层** | 加工：拓扑配对、聚合、采样决策 | peer.service 配对、Edge 聚合 |
| **存储层** | 入库：索引、编码、压缩、高基数治理 | indexdb/TSID/rawRow、布隆过滤器 |
| **查询层** | 出库：指标检索、PromQL 查询 | 指标检索机制 |

### 求真务实声明

本系列所有案例都**锚定本博客已写的真实工程**，每个案例可回链到来源文章：

- 接入层 → [一个指标的冒险之旅](/observability/victoriametrics/metric-journey.md)、[Java Agent 控制平面](/observability/implementation/otel-java-agent-control-plane.md)、[延迟采样方案](/observability/design/otel-tail-based-sampling.md)
- 计算层 → [服务拓扑实现方案](/observability/design/service-topology-design.md)
- 存储层 → [指标冒险之旅](/observability/victoriametrics/metric-journey.md)、[布隆过滤器](/observability/victoriametrics/bloom-filter-gatekeeper.md)
- 探针状态 → [Arthas 生命周期管理](/observability/arthas/otel-arthas-lifecycle-management.md)

每篇末尾标注事实来源，分三类：

| 标记 | 含义 |
|------|------|
| `【实测】` | 博客已写的真实工程，可回链验证 |
| `【业界通用】` | OTel / VictoriaMetrics 官方设计，公开可查 |
| `【推断】` | 基于经验的推演，需读者自行验证 |

---

## 目录索引

### 📖 序章

- [为什么 AI 时代更需要设计原则](/design-principles/00-prologue/why-design-principles.md)

### 📐 六大设计原则（道）

1. [单一职责原则 SRP](/design-principles/01-principles/01-srp.md)
2. [开放封闭原则 OCP](/design-principles/01-principles/02-ocp.md)
3. [里氏替换原则 LSP](/design-principles/01-principles/03-lsp.md)
4. [接口隔离原则 ISP](/design-principles/01-principles/04-isp.md)
5. [依赖倒置原则 DIP](/design-principles/01-principles/05-dip.md)
6. [迪米特法则 LoD](/design-principles/01-principles/06-lod.md)

### 🛠️ 工程实践原则（术）

*（待补充：高内聚低耦合 / 可扩展性 / 健壮性 / 可单元测试）*

### ⚙️ 设计模式（器）

*（待补充：创建型 5 / 结构型 7 / 行为型 11）*

### 🏭 业务实践（用）

*（待补充：重构实战 / 反模式与过度设计）*

### 🤖 Agent 时代（省）

*（待补充：用设计原则给 AI 写 Prompt）*

---

## 写作风格约定

- 每篇用**反例（坏代码）→ 正例（重构后）**对照，代码为「真实组件的忠实简化」（Go）；
- 设 **💭 想一想** 折叠思考块；
- 固定 **红线** 小节，讲清原则/模式的边界，避免教条化；
- 每篇末尾留**下一篇钩子**，六原则之间形成一条因果链。

---

> 系列持续更新中 · 专注深度，拒绝水文
