# 个人简历

## 基本信息

| | |
|---|---|
| **方向** | 后台开发（Java / Go） |
| **经验** | 5 年+（2020 年毕业） |
| **学历** | 本科 · 计算机科学与技术 · 西安工业大学 |
| **证书** | CET-6 · 软考中级（软件设计师） |
| **联系** | [📧 Email](mailto:1090086767@qq.com) · [💻 GitHub](https://github.com/junjiewwang) |

---

## 技能

| 类别 | 技能 | 生产经验 |
|------|------|---------|
| 语言 | Java | 5 年 |
| 语言 | Go | 4 年 |
| 框架 | Spring Boot、gRPC、Protobuf、Gin | 4 年 |
| 可观测性 | OpenTelemetry、Arthas、ByteBuddy | 3 年 |
| 中间件 | MySQL、Redis、Kafka、ElasticSearch | 4 年 |
| 基础设施 | Docker、Kubernetes、Linux | 5 年 |

---

## 工作经历

### 某互联网大厂 · 后端工程师 · 2022.03 - 至今

**团队方向**：可观测性平台（APM / 基础监控）

- 负责 OpenTelemetry Java Agent 二次开发，支持对内部框架的链路追踪
- 设计并实现 Agent 远程控制平面，支持配置热更新、远程诊断、采样策略下发
- 开发 Arthas 分布式 Tunnel 扩展，支持通过控制面远程触发诊断
- 参与 APM / 基础监控产品私有化落地与交付
- 参与核心链路性能调优，排查 JVM 内存泄漏与 FullGC 问题

### 某央企研发中心 · Java 开发工程师 · 2020.01 - 2022.02

**团队方向**：数字中台

- 负责资源调度微服务的需求分析、设计与开发（容器调度、故障迁移、健康检测）
- 基于 Spring Boot + Etcd + Docker 实现计算代理集群管理

---

## 项目亮点

| 项目 | 我的核心贡献 | 详情 |
|------|-------------|------|
| Java Agent 远程控制平面 | 基于 Protobuf + 长轮询实现配置下发与远程诊断，SPI 插件化支持扩展 | [→ 详情](projects/agent-control-plane.md) |
| Arthas Tunnel Extension | 将 Arthas 诊断能力集成到 OTel 生态，通过控制面远程下发诊断任务 | [→ 详情](projects/arthas-tunnel-extension.md) |
| HPROF 解析器优化 | 重写大内存堆快照索引构建路径，提升解析速度并降低内存占用 | [→ 详情](projects/hprof-parser-optimization.md) |
| MySQL 索引优化 | 排查联合索引最左前缀不匹配问题，新增覆盖索引减少无效 IO | [→ 详情](/database/mysql-index-optimization-case.md) |

---

## 核心能力

```
可观测性（OpenTelemetry） · 字节码增强(ByteBuddy) · 并发编程
SPI 插件化 · 长连接通信 · JVM 调优 · MySQL 优化 · 容器化部署
```

---

## 其他

- **开源参与**：Arthas、OpenTelemetry Java 项目 PR/Issue
- **兴趣**：🎸 吉他 · 🎮 王者荣耀 · 金铲铲之战
