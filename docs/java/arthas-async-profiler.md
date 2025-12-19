# Arthas + Async-Profiler 性能分析实践

> 使用 Arthas 和 async-profiler 进行 Java 应用性能分析的完整指南

## 工具介绍

### Arthas 简介

> Arthas 是阿里巴巴开源的 Java 诊断工具，可以在不重启应用的情况下进行问题诊断

**核心功能**：
- 实时查看类加载信息
- 方法执行监控与追踪
- 热更新代码
- 内存分析
- 线程分析
- **集成 async-profiler 进行性能分析**

### Async-Profiler 简介

> async-profiler 是一款低开销的 Java 采样分析器，支持 CPU、内存分配、锁等多种分析模式

**特点**：
- 低开销（通常 < 2%）
- 无 SafePoint 偏差问题
- 支持火焰图生成
- 支持多种事件类型采样

---

## 环境准备

### 安装 Arthas

```bash
# 方式一：使用官方脚本安装
curl -O https://arthas.aliyun.com/arthas-boot.jar

# 方式二：使用 Maven 依赖（用于集成到项目）
# <dependency>
#     <groupId>com.taobao.arthas</groupId>
#     <artifactId>arthas-boot</artifactId>
#     <version>3.7.2</version>
# </dependency>
```

### 启动 Arthas

```bash
# 启动 Arthas 并选择要附加的 Java 进程
java -jar arthas-boot.jar

# 或直接指定进程 ID
java -jar arthas-boot.jar <pid>
```

---

## Profiler 命令详解

### 基本用法

```bash
# 查看 profiler 支持的事件类型
profiler list

# 启动 CPU 分析（默认事件）
profiler start

# 查看分析状态
profiler status

# 停止分析并生成报告
profiler stop
```

### 常用参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `--event` | 指定采样事件类型 | `--event cpu` |
| `--duration` | 采样持续时间（秒） | `--duration 60` |
| `--interval` | 采样间隔（纳秒） | `--interval 10000000` |
| `--file` | 输出文件路径 | `--file /tmp/profile.html` |
| `--format` | 输出格式 | `--format html` |
| `--threads` | 按线程分组 | `--threads` |
| `--include` | 包含指定类/方法 | `--include 'com.example.*'` |
| `--exclude` | 排除指定类/方法 | `--exclude '*Unsafe*'` |

### 支持的事件类型

| 事件 | 说明 | 使用场景 |
|------|------|---------|
| `cpu` | CPU 时间采样 | 分析 CPU 热点 |
| `alloc` | 内存分配采样 | 分析内存分配热点 |
| `lock` | 锁竞争采样 | 分析锁争用问题 |
| `wall` | 挂钟时间采样 | 分析 I/O 等待等 |
| `itimer` | 基于 itimer 的采样 | 替代 cpu 事件 |

---

## 实战场景

### 场景一：CPU 热点分析

```bash
# 启动 CPU 分析，持续 60 秒，生成火焰图
profiler start --event cpu --duration 60 --file /tmp/cpu-flame.html

# 或者手动控制开始和结束
profiler start --event cpu
# ... 执行业务操作 ...
profiler stop --file /tmp/cpu-flame.html --format html
```

**火焰图解读**：
- **X 轴**：采样堆栈的集合，宽度表示采样占比
- **Y 轴**：调用栈深度，从下到上是调用关系
- **颜色**：随机分配，无特殊含义
- **宽的方块**：表示该方法占用 CPU 时间长，需要关注

### 场景二：内存分配分析

```bash
# 分析内存分配热点
profiler start --event alloc --duration 60 --file /tmp/alloc-flame.html
```

**适用场景**：
- 频繁 GC 问题排查
- 内存泄漏定位
- 大对象分配追踪

### 场景三：锁竞争分析

```bash
# 分析锁竞争
profiler start --event lock --duration 60 --file /tmp/lock-flame.html
```

**适用场景**：
- 线程阻塞问题
- 死锁排查
- 高并发性能优化

### 场景四：Wall-Clock 分析

```bash
# Wall-clock 分析（包含等待时间）
profiler start --event wall --duration 60 --file /tmp/wall-flame.html
```

**与 CPU 分析的区别**：
- CPU 分析只统计 CPU 执行时间
- Wall-clock 包含所有时间（包括 I/O 等待、锁等待等）

---

## 高级用法

### 按线程分组

```bash
# 生成按线程分组的火焰图
profiler start --event cpu --threads --file /tmp/threads-flame.html
```

### 过滤指定包

```bash
# 只分析特定包
profiler start --event cpu --include 'com.myapp.*' --file /tmp/filtered.html

# 排除框架代码
profiler start --event cpu --exclude 'org.springframework.*' --exclude 'com.sun.*'
```

### 生成不同格式

```bash
# HTML 火焰图（推荐，交互式）
profiler stop --format html --file /tmp/flame.html

# Collapsed 格式（用于后续处理生成火焰图）
profiler start -e cpu -d 60 --threads -f /tmp/cpu.collapsed --format collapsed

# SVG 火焰图
profiler stop --format svg --file /tmp/flame.svg

# JFR 格式（可用 JMC 打开）
profiler stop --format jfr --file /tmp/profile.jfr

# 文本格式（flat 输出）
profiler stop --format flat --file /tmp/profile.txt
```

### Collapsed 格式详解

> Collapsed 是 Brendan Gregg 火焰图工具的标准输入格式

```bash
# 完整命令示例
profiler start -e cpu -d 60 --threads -f /tmp/cpu.collapsed --format collapsed
```

**参数说明**：
| 参数 | 说明 |
|------|------|
| `-e cpu` | 采样 CPU 事件 |
| `-d 60` | 持续 60 秒 |
| `--threads` | 按线程分组，火焰图中显示线程名 |
| `-f /tmp/cpu.collapsed` | 输出文件路径 |
| `--format collapsed` | 输出 collapsed 格式 |

**Collapsed 格式示例**：
```
Thread-1;com.example.Main.main;com.example.Service.process 150
Thread-1;com.example.Main.main;com.example.Dao.query 80
Thread-2;java.lang.Thread.run;com.example.Worker.execute 200
```

**格式说明**：
- 每行一个调用栈，分号分隔各层调用
- 行末数字为采样次数
- 可用 [FlameGraph](https://github.com/brendangregg/FlameGraph) 工具转换为 SVG

**后续处理**：
```bash
# 使用 FlameGraph 工具生成 SVG
git clone https://github.com/brendangregg/FlameGraph.git
./FlameGraph/flamegraph.pl /tmp/cpu.collapsed > /tmp/cpu-flame.svg
```

### 持续采样

```bash
# 后台持续采样，定期输出
profiler start --event cpu --loop 60 --file /tmp/profile-%t.html
```

---

## 常见问题排查

### 问题一：profiler 启动失败

**错误信息**：`Can not attach to current VM`

**解决方案**：
```bash
# 检查 JVM 参数，确保允许 attach
-XX:+UnlockDiagnosticVMOptions -XX:+DebugNonSafepoints

# 或者设置环境变量
export JAVA_TOOL_OPTIONS="-XX:+UnlockDiagnosticVMOptions -XX:+DebugNonSafepoints"
```

### 问题二：权限不足

**错误信息**：`perf_event_open failed`

**解决方案**：
```bash
# 临时解决
sudo sysctl -w kernel.perf_event_paranoid=1
sudo sysctl -w kernel.kptr_restrict=0

# 永久解决（添加到 /etc/sysctl.conf）
kernel.perf_event_paranoid=1
kernel.kptr_restrict=0
```

### 问题三：容器环境

```bash
# Docker 容器中需要添加权限
docker run --cap-add SYS_ADMIN --cap-add SYS_PTRACE ...

# 或者使用 --privileged
docker run --privileged ...
```

---

## 最佳实践

### 采样建议

1. **采样时间**：建议 30-120 秒，时间太短数据不准确
2. **采样间隔**：默认 10ms，高精度场景可调整为 1ms
3. **生产环境**：优先使用 `itimer` 事件，开销更低
4. **多次采样**：建议多次采样取平均，避免偶发因素干扰

### 分析流程

```
1. 确定问题类型（CPU/内存/锁）
       ↓
2. 选择对应事件类型
       ↓
3. 执行采样（建议 60s+）
       ↓
4. 生成火焰图
       ↓
5. 分析热点方法
       ↓
6. 定位代码优化
       ↓
7. 验证优化效果
```

### 火焰图分析技巧

- **关注"平顶"**：火焰图顶部宽的方块是优化重点
- **对比分析**：优化前后生成火焰图对比
- **结合代码**：点击火焰图方块可查看完整调用栈

---

## 参考资料

- [Arthas 官方文档](https://arthas.aliyun.com/doc/)
- [async-profiler GitHub](https://github.com/async-profiler/async-profiler)
- [火焰图解读指南](https://www.brendangregg.com/flamegraphs.html)

---

## 实践记录

<!-- 在这里记录实际使用中的案例和心得 -->
