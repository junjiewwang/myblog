# Arthas AnsiLog 可配置 PrintStream 字段 PR 方案

## 一、问题背景

### 1.1 现状分析

基于 `AnsiLog` 源码，当前实现存在以下问题：

```java
// 当前 AnsiLog 实现
public abstract class AnsiLog {
    public static java.util.logging.Level LEVEL = java.util.logging.Level.CONFIG;
    
    public static void info(String msg) {
        if (canLog(Level.CONFIG)) {
            System.out.println(INFO_PREFIX + msg);  // ← 硬编码 System.out
        }
    }
    
    public static void error(Throwable t) {
        if (canLog(Level.SEVERE)) {
            t.printStackTrace(System.out);  // ← 硬编码 System.out
        }
    }
}
```

**核心问题**：
- `System.out` 硬编码在方法体内，无法被外部配置或重定向
- 嵌入式集成场景（如 OTel、Spring Boot）中，AnsiLog 输出会污染服务日志
- 只能通过调高 `LEVEL` 来减少输出，但无法完全控制输出目标

### 1.2 影响场景

| 场景 | 问题表现 |
|------|----------|
| **OTel 嵌入式集成** | Arthas 启动/运行日志混入服务 stdout，干扰日志采集系统 |
| **Spring Boot DevTools** | Arthas 输出干扰热重载日志 |
| **IDE 内嵌 Agent** | Arthas 输出与应用日志混杂，难以区分 |
| **容器化部署** | stdout 被当作应用日志收集，Arthas 诊断信息混入 |
| **CLI 工具集成** | 需要将 Arthas 输出定向到特定文件 |

---

## 二、PR 方案设计

### 2.1 核心改动

在 `AnsiLog` 中增加**可配置的 PrintStream 字段**，替代硬编码的 `System.out`：

```java
public abstract class AnsiLog {

    // ===== 新增：可配置的输出流 =====
    
    /**
     * 日志输出流，默认为 System.out
     * 
     * <p>允许外部配置，用于：
     * <ul>
     *   <li>嵌入式场景重定向到文件</li>
     *   <li>与宿主应用日志隔离</li>
     *   <li>单元测试捕获输出</li>
     * </ul>
     */
    private static volatile PrintStream out = System.out;
    
    /**
     * 设置日志输出流
     *
     * @param printStream 输出流，null 时使用 System.out
     * @return 旧的输出流
     */
    public static PrintStream out(PrintStream printStream) {
        PrintStream old = out;
        out = (printStream != null) ? printStream : System.out;
        return old;
    }
    
    /**
     * 获取当前日志输出流
     *
     * @return 当前输出流
     */
    public static PrintStream out() {
        return out;
    }
    
    // ===== 现有字段保持不变 =====
    static boolean enableColor;
    public static java.util.logging.Level LEVEL = java.util.logging.Level.CONFIG;
    
    // ...
}
```

### 2.2 方法体改动

将所有 `System.out` 替换为 `out` 字段引用：

```java
// ===== 改动前 =====
public static void info(String msg) {
    if (canLog(Level.CONFIG)) {
        if (enableColor) {
            System.out.println(INFO_COLOR_PREFIX + msg);
        } else {
            System.out.println(INFO_PREFIX + msg);
        }
    }
}

public static void error(Throwable t) {
    if (canLog(Level.SEVERE)) {
        t.printStackTrace(System.out);
    }
}

// ===== 改动后 =====
public static void info(String msg) {
    if (canLog(Level.CONFIG)) {
        if (enableColor) {
            out.println(INFO_COLOR_PREFIX + msg);  // ← 使用 out 字段
        } else {
            out.println(INFO_PREFIX + msg);
        }
    }
}

public static void error(Throwable t) {
    if (canLog(Level.SEVERE)) {
        t.printStackTrace(out);  // ← 使用 out 字段
    }
}
```

### 2.3 完整改动清单

需要修改的方法（共 15 处）：

| 方法 | 改动点 |
|------|--------|
| `trace(String)` | `System.out.println` → `out.println` |
| `trace(Throwable)` | `t.printStackTrace(System.out)` → `t.printStackTrace(out)` |
| `debug(String)` | `System.out.println` → `out.println` |
| `debug(Throwable)` | `t.printStackTrace(System.out)` → `t.printStackTrace(out)` |
| `info(String)` | `System.out.println` → `out.println` |
| `info(Throwable)` | `t.printStackTrace(System.out)` → `t.printStackTrace(out)` |
| `warn(String)` | `System.out.println` → `out.println` |
| `warn(Throwable)` | `t.printStackTrace(System.out)` → `t.printStackTrace(out)` |
| `error(String)` | `System.out.println` → `out.println` |
| `error(Throwable)` | `t.printStackTrace(System.out)` → `t.printStackTrace(out)` |

---

## 三、API 设计说明

### 3.1 设计原则

| 原则 | 说明 |
|------|------|
| **向后兼容** | 默认行为不变（`out = System.out`），现有用户无感知 |
| **API 风格一致** | 与现有 `level(Level)` 方法风格保持一致 |
| **线程安全** | 使用 `volatile` 确保多线程可见性 |
| **空值安全** | `out(null)` 时回退到 `System.out` |
| **可逆操作** | 返回旧值，方便临时修改后恢复 |

### 3.2 使用示例

#### 场景 1：嵌入式集成（OTel/Spring Boot）

```java
// 启动 Arthas 前，将日志重定向到文件
File arthasLog = new File(System.getProperty("user.home") + "/logs/arthas/ansilog.log");
PrintStream fileStream = new PrintStream(new FileOutputStream(arthasLog, true));
AnsiLog.out(fileStream);

// 启动 Arthas
ArthasBootstrap.getInstance(inst, configMap);

// Arthas 的 AnsiLog 输出将写入文件，不影响服务 stdout
```

#### 场景 2：单元测试捕获输出

```java
@Test
public void testAnsiLogOutput() {
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    PrintStream testStream = new PrintStream(baos);
    
    PrintStream old = AnsiLog.out(testStream);
    try {
        AnsiLog.info("test message");
        assertThat(baos.toString()).contains("[INFO] test message");
    } finally {
        AnsiLog.out(old);  // 恢复
    }
}
```

#### 场景 3：AgentBootstrap 中使用（官方推荐）

```java
// AgentBootstrap.java 静态初始化块
static {
    try {
        File log = new File(arthasLogDir, "arthas.log");
        PrintStream ps = new PrintStream(new FileOutputStream(log, true));
        
        // 同时重定向 AnsiLog
        AnsiLog.out(ps);
        
    } catch (Throwable t) {
        t.printStackTrace();
    }
}
```

---

## 四、佐证材料

### 4.1 同类框架参考

| 框架 | 日志输出配置方式 |
|------|-----------------|
| **Logback** | `OutputStreamAppender.setOutputStream(OutputStream)` |
| **SLF4J Simple** | `simpleLogger.logFile` 系统属性 |
| **JUL** | `Handler.setOutputStream(OutputStream)` |
| **Log4j2** | `OutputStreamManager` 支持自定义输出 |

这些框架都支持配置输出目标，AnsiLog 作为 Arthas 的日志组件，也应该提供类似能力。

### 4.2 现有代码中的类似模式

Arthas 自身 `AgentBootstrap` 已经有类似设计：

```java
// AgentBootstrap.java
private static PrintStream ps = System.err;  // ← 可配置的 PrintStream
static {
    // ...
    ps = new PrintStream(new FileOutputStream(log, true));  // ← 重定向到文件
}

// 后续使用 ps 而非 System.err
ps.println("Arthas server agent start...");
```

这证明 Arthas 团队认可"可配置 PrintStream"的设计模式，只是 `AnsiLog` 还没有跟进。

### 4.3 Issue/需求来源

可以在 PR 中引用或创建相关 Issue：

```markdown
## Related Issues

- Fixes #XXXX: Support configurable output stream for AnsiLog
- Related to embedded integration scenarios (OTel, Spring Boot, IDE plugins)

## Motivation

When Arthas is embedded in other applications (e.g., OpenTelemetry Java Agent, 
Spring Boot applications), AnsiLog outputs directly to System.out, which:

1. Pollutes the host application's stdout
2. Interferes with log collection systems
3. Cannot be redirected to a separate file

The official `AgentBootstrap` already uses a configurable `PrintStream` pattern,
but `AnsiLog` still hardcodes `System.out`.

## Solution

Add a configurable `out` field to `AnsiLog`, similar to the existing `LEVEL` field:

- Default: `System.out` (backward compatible)
- API: `AnsiLog.out(PrintStream)` / `AnsiLog.out()`
- Thread-safe with `volatile`
```

---

## 五、PR 改动 Diff 预览

```diff
diff --git a/common/src/main/java/com/taobao/arthas/common/AnsiLog.java b/common/src/main/java/com/taobao/arthas/common/AnsiLog.java
index xxx..yyy 100644
--- a/common/src/main/java/com/taobao/arthas/common/AnsiLog.java
+++ b/common/src/main/java/com/taobao/arthas/common/AnsiLog.java
@@ -1,5 +1,6 @@
 package com.taobao.arthas.common;
 
+import java.io.PrintStream;
 import java.util.logging.Level;
 import java.util.regex.Matcher;
 
@@ -20,6 +21,12 @@ public abstract class AnsiLog {
 
     static boolean enableColor;
 
+    /**
+     * Output stream for log messages, defaults to System.out.
+     * Can be configured via {@link #out(PrintStream)} for embedded scenarios.
+     */
+    private static volatile PrintStream out = System.out;
+
     public static java.util.logging.Level LEVEL = java.util.logging.Level.CONFIG;
 
     private static final String RESET = "\033[0m";
@@ -76,6 +83,28 @@ public abstract class AnsiLog {
         return enableColor;
     }
 
+    /**
+     * Set the output stream for log messages.
+     *
+     * @param printStream the output stream, null to use System.out
+     * @return the previous output stream
+     */
+    public static PrintStream out(PrintStream printStream) {
+        PrintStream old = out;
+        out = (printStream != null) ? printStream : System.out;
+        return old;
+    }
+
+    /**
+     * Get the current output stream.
+     *
+     * @return the current output stream
+     */
+    public static PrintStream out() {
+        return out;
+    }
+
     /**
      * set logger Level
      *
@@ -144,9 +173,9 @@ public abstract class AnsiLog {
     public static void trace(String msg) {
         if (canLog(Level.FINEST)) {
             if (enableColor) {
-                System.out.println(TRACE_COLOR_PREFIX + msg);
+                out.println(TRACE_COLOR_PREFIX + msg);
             } else {
-                System.out.println(TRACE_PREFIX + msg);
+                out.println(TRACE_PREFIX + msg);
             }
         }
     }
@@ -159,7 +188,7 @@ public abstract class AnsiLog {
 
     public static void trace(Throwable t) {
         if (canLog(Level.FINEST)) {
-            t.printStackTrace(System.out);
+            t.printStackTrace(out);
         }
     }
 
@@ -167,9 +196,9 @@ public abstract class AnsiLog {
     public static void debug(String msg) {
         if (canLog(Level.FINER)) {
             if (enableColor) {
-                System.out.println(DEBUG_COLOR_PREFIX + msg);
+                out.println(DEBUG_COLOR_PREFIX + msg);
             } else {
-                System.out.println(DEBUG_PREFIX + msg);
+                out.println(DEBUG_PREFIX + msg);
             }
         }
     }
@@ -182,7 +211,7 @@ public abstract class AnsiLog {
 
     public static void debug(Throwable t) {
         if (canLog(Level.FINER)) {
-            t.printStackTrace(System.out);
+            t.printStackTrace(out);
         }
     }
 
@@ -190,9 +219,9 @@ public abstract class AnsiLog {
     public static void info(String msg) {
         if (canLog(Level.CONFIG)) {
             if (enableColor) {
-                System.out.println(INFO_COLOR_PREFIX + msg);
+                out.println(INFO_COLOR_PREFIX + msg);
             } else {
-                System.out.println(INFO_PREFIX + msg);
+                out.println(INFO_PREFIX + msg);
             }
         }
     }
@@ -205,7 +234,7 @@ public abstract class AnsiLog {
 
     public static void info(Throwable t) {
         if (canLog(Level.CONFIG)) {
-            t.printStackTrace(System.out);
+            t.printStackTrace(out);
         }
     }
 
@@ -213,9 +242,9 @@ public abstract class AnsiLog {
     public static void warn(String msg) {
         if (canLog(Level.WARNING)) {
             if (enableColor) {
-                System.out.println(WARN_COLOR_PREFIX + msg);
+                out.println(WARN_COLOR_PREFIX + msg);
             } else {
-                System.out.println(WARN_PREFIX + msg);
+                out.println(WARN_PREFIX + msg);
             }
         }
     }
@@ -228,7 +257,7 @@ public abstract class AnsiLog {
 
     public static void warn(Throwable t) {
         if (canLog(Level.WARNING)) {
-            t.printStackTrace(System.out);
+            t.printStackTrace(out);
         }
     }
 
@@ -236,9 +265,9 @@ public abstract class AnsiLog {
     public static void error(String msg) {
         if (canLog(Level.SEVERE)) {
             if (enableColor) {
-                System.out.println(ERROR_COLOR_PREFIX + msg);
+                out.println(ERROR_COLOR_PREFIX + msg);
             } else {
-                System.out.println(ERROR_PREFIX + msg);
+                out.println(ERROR_PREFIX + msg);
             }
         }
     }
@@ -251,7 +280,7 @@ public abstract class AnsiLog {
 
     public static void error(Throwable t) {
         if (canLog(Level.SEVERE)) {
-            t.printStackTrace(System.out);
+            t.printStackTrace(out);
         }
     }
```

---

## 六、总结

| 维度 | 说明 |
|------|------|
| **改动范围** | 仅 `AnsiLog.java` 一个文件 |
| **代码行数** | +25 行（新增字段和方法），~15 处替换 |
| **向后兼容** | ✅ 默认行为完全不变 |
| **API 风格** | ✅ 与现有 `level(Level)` 一致 |
| **测试覆盖** | 需新增单元测试验证输出重定向 |
| **文档更新** | 需更新 AnsiLog 的 JavaDoc |

**PR 提交建议**：

1. 先在 Arthas GitHub 仓库创建 Issue 说明需求
2. Fork 仓库，基于 `master` 分支创建 feature 分支
3. 提交改动 + 单元测试
4. 提交 PR，引用 Issue，说明动机和改动

这个改动能够解决嵌入式集成场景中的日志污染问题，同时保持完全的向后兼容性，是一个低风险、高价值的改进。