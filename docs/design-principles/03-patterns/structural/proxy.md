# 代理模式：给对象加一个「门卫」

> 一句话：**提供一个对象的替身，在访问这个对象时，由替身控制访问。**
> 代理和被代理对象实现同一接口，调用方无感知地「穿过」代理。

---

## 它解决什么尴尬

你想在访问某个对象时「夹带私货」：权限校验、懒加载、读写分离、缓存、审计……但**又不想改这个对象本身**。

代理模式提供「替身」：代理和被代理对象实现同一个接口，调用方拿到的其实是代理，代理在「转发给真实对象」前后做额外的事。

---

## APM 落点：存储的读写分离

APM 存储层常见「读写分离」：读走副本、写走主库（`【业界通用】` 时序库高可用设计）。调用方只想「读写数据」，不关心「该走主库还是副本」——这个路由逻辑交给代理。

---

## Go 代码

```go
// 目标接口：读写存储
type Storage interface {
    Read(key string) (Value, error)
    Write(key string, v Value) error
}

// 真实对象：主库、副本
type PrimaryStorage struct{}
type ReplicaStorage struct{}

func (p *PrimaryStorage) Write(key string, v Value) error { /* 写主库 */ }
func (r *ReplicaStorage) Read(key string) (Value, error)  { /* 读副本 */ }

// 代理：实现同一接口，内部做读写分离路由
type ReadWriteProxy struct {
    primary Storage
    replica Storage
}

func (p *ReadWriteProxy) Read(key string) (Value, error) {
    return p.replica.Read(key) // 读 → 走副本
}

func (p *ReadWriteProxy) Write(key string, v Value) error {
    return p.primary.Write(key, v) // 写 → 走主库
}
```

```go
// 调用方：拿到的其实是代理，但无感知
var s Storage = &ReadWriteProxy{primary: p, replica: r}
s.Write("cpu_usage", v) // 代理内部路由到主库
s.Read("cpu_usage")      // 代理内部路由到副本
```

<details>
<summary>💭 想一想：代理模式和装饰器模式，真的很难分吗？</summary>

**答案**：结构上几乎一样（都是「包装 + 同接口」），但**意图不同**：
- **代理**：控制「**访问**」——决定「能不能访问、访问谁」（权限、懒加载、读写分离），核心是**管控**；
- **装饰器**：增强「**能力**」——给对象加新行为（重试、日志），核心是**叠加**。

判断技巧：代理通常「不改变对象的能力，只改变访问方式」；装饰器「不改变访问方式，只叠加能力」。读写分离是「决定访问谁」→ 代理；重试日志是「叠加能力」→ 装饰器。

</details>

---

## 对应原则

- **SRP**：把「访问控制/路由」的职责从真实对象中剥离；
- **封装**：调用方不感知代理的存在，访问策略对调用方透明；
- **OCP**：加访问策略不改真实对象。

## 何时别用（红线）

1. **没有「访问控制」需求**：如果就是直接调用，代理只是多余的一层间接。
2. **代理链太长**：代理套代理，调试和性能都会变差，要节制。
3. **别把业务逻辑塞进代理**：代理只做「访问管控」，混入业务逻辑会让职责不清。

---

<details>
<summary>📌 本文事实来源</summary>

- 存储读写分离：`【业界通用】` 时序数据库高可用架构（如 VictoriaMetrics/ClickHouse 集群）
- 代理模式定义：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为示意性简化 `【推断】`

</details>
