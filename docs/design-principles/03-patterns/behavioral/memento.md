# 备忘录模式：给对象拍一张「快照」，需要时回滚

> 一句话：**在不破坏封装的前提下，捕获对象某一时刻的内部状态，之后可以恢复到该状态。**
> 相当于给对象「存档/读档」。

---

## 它解决什么尴尬

有时需要「保存当前状态，之后能退回」。比如配置下发后出错了，想回滚到上一个版本。如果直接把对象的内部字段暴露出去保存，就破坏了封装；如果让对象自己「记忆」，又可能泄漏内部细节。

备忘录模式由三部分组成，把「保存」和「恢复」的职责清晰拆开：

| 角色 | 职责 |
|------|------|
| **Originator（发起者）** | 产生快照、恢复快照 |
| **Memento（备忘录）** | 保存状态的「快照对象」 |
| **Caretaker（保管者）** | 持有快照，负责何时存、何时回滚 |

---

## APM 落点：配置快照回滚

APM 控制面下发动态配置时，常有「新配置异常，回滚上一版」的需求（`【业界通用】` 配置管理系统常见设计）。把配置对象做成 Originator，每次下发前 `Save()` 一份快照，失败时 `Restore()` 回滚——就是备忘录模式。

---

## Go 代码

```go
// Memento：某一时刻的配置快照（不可变）
type ConfigSnapshot struct {
    version int
    config  Config
}

// Originator：配置管理器，负责产生/恢复快照
type ConfigManager struct {
    config Config
}

func (m *ConfigManager) Save() *ConfigSnapshot {
    return &ConfigSnapshot{version: m.config.Version, config: m.config.Clone()}
}

func (m *ConfigManager) Restore(s *ConfigSnapshot) {
    m.config = s.config
}

// Caretaker：持有历史快照，负责回滚策略
type ConfigCaretaker struct {
    snapshots []*ConfigSnapshot
}

func (c *ConfigCaretaker) Push(s *ConfigSnapshot) { c.snapshots = append(c.snapshots, s) }
func (c *ConfigCaretaker) Pop() *ConfigSnapshot {
    if len(c.snapshots) == 0 {
        return nil
    }
    last := c.snapshots[len(c.snapshots)-1]
    c.snapshots = c.snapshots[:len(c.snapshots)-1]
    return last
}
```

关键：**快照对象 `ConfigSnapshot` 对外只读，内部字段不暴露**——`ConfigManager` 自己掌握「怎么存、怎么恢复」，外部只能「请求保存」和「请求回滚」。

<details>
<summary>💭 想一想：备忘录模式最容易被忽视的代价是什么？</summary>

**答案**：是**内存**。每个快照都是一份完整的状态拷贝，快照多了、状态大了，内存开销会很大。所以备忘录模式要考虑「快照的粒度」和「保留几份」——不是所有字段都要存（可以只存增量/差异），也不是所有历史都要留（可以只留最近 N 份）。

</details>

---

## 对应原则

- **SRP**：产生/恢复（Originator）、保存状态（Memento）、何时回滚（Caretaker）三职责分离；
- **封装**：状态细节不暴露给外部，只有发起者自己知道怎么存/恢复。

## 何时别用（红线）

1. **对象状态很小、直接拷贝即可**：用一个 `Clone()` 或 struct 拷贝就够，不必上三件套。
2. **状态很大、快照频繁**：备忘录的拷贝开销可能拖垮性能，优先考虑「命令模式 + 反向操作」或「增量快照」。
3. **没有「回滚」需求**：不回滚就别存快照。

---

<details>
<summary>📌 本文事实来源</summary>

- 配置下发/回滚场景：`【业界通用】` 配置中心常见设计（如动态配置版本管理）
- 备忘录模式定义：`【业界通用】` GoF《设计模式》
- 本节 Go 代码为示意性简化 `【推断】`

</details>
