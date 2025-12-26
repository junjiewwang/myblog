# OpenTelemetry Java 二次开发经验

> 记录 OpenTelemetry Java 项目二次开发过程中的经验和踩坑记录

## 编译构建

### opentelemetry-java-instrumentation 编译

编译 `opentelemetry-java-instrumentation` 项目时，需要添加 `--no-configuration-cache` 参数，否则会编译失败：

```bash
# 正确的编译命令
./gradlew build --no-configuration-cache

# 或者指定具体模块
./gradlew :instrumentation:build --no-configuration-cache
```

> **原因**: 该项目使用了一些与 Gradle Configuration Cache 不兼容的构建逻辑，启用配置缓存会导致编译错误。

---

## 常见问题

<!-- 后续补充 -->

---

## 参考资源

- [opentelemetry-java](https://github.com/open-telemetry/opentelemetry-java)
- [opentelemetry-java-instrumentation](https://github.com/open-telemetry/opentelemetry-java-instrumentation)
