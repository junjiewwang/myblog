## 技能文档

### 基本信息
- 技能名: `docsify-theme-customizer`
- 创建人: @junjiewwang (junjiewwang@tencent.com)
- 版本: v1.0.0
- 更新时间: 2026-04-18

### 适用场景

1. **侧边栏箭头定制** — 隐藏/替换 docsify 侧边栏中的折叠箭头（包括插件 `::before` 伪元素箭头和主题 `background-image` 渐变箭头）
2. **层级菜单样式重设计** — 参考 VitePress/Docusaurus 等现代文档站风格，通过字号、字重、颜色深浅和间距区分层级
3. **docsify-themeable 主题覆盖** — 覆盖 CSS 变量、background-image 渐变等主题默认样式
4. **docsify-sidebar-collapse 插件样式调整** — 利用插件自动生成的 `.file`/`.folder`/`level-N` 类做精准 CSS 选择器
5. **docsify SPA 样式调试** — 使用 Playwright headless 浏览器探测渲染后 DOM 和计算样式
6. **亮色/暗色双主题适配** — `@media (prefers-color-scheme: dark)` 的完整覆盖策略

### 前置条件
- docsify 4.x 博客/文档站
- docsify-themeable 主题（`theme-simple.css` 或其他）
- docsify-sidebar-collapse 插件
- Node.js（用于本地服务器和 Playwright 调试）
- Playwright（`npx playwright install chromium`，用于自动化验证）

### 技术栈
| 组件 | 版本 | 说明 |
|------|------|------|
| docsify | 4.x | 文档站核心框架 |
| docsify-themeable | 0.x | CSS 变量主题引擎 |
| docsify-sidebar-collapse | latest | 侧边栏折叠插件 |
| Playwright | 1.x | headless 浏览器调试 |

### 使用示例
```
"隐藏 docsify 侧边栏的箭头"
"重新设计侧边栏层级样式，参考 VitePress 风格"
"docsify 侧边栏的箭头隐藏不了，帮我调试"
"修改 docsify 主题色和侧边栏样式"
"docsify 深色模式的侧边栏样式不对"
```

### 注意事项
⚠️ **缓存问题**：docsify 是 SPA，浏览器会缓存 `index.html`，修改 CSS 后需要 Cmd+Shift+R 硬刷新
⚠️ **箭头双来源**：侧边栏箭头有两个独立来源（`::before` 伪元素 + `background-image` 渐变），必须分别覆盖
⚠️ **!important 必要性**：覆盖插件/主题样式时必须使用 `!important`，否则会被后加载的样式覆盖
⚠️ **插件加载顺序**：sidebar-collapse 的 JS 在 `doneEach` 中给 li 加类，CSS 需要匹配这些动态添加的类
⚠️ **不要重复造轮子**：sidebar-collapse 插件自身已经给叶子 li 加 `.file` 类，无需额外 JS

### 核心经验（踩坑记录）

1. **误判箭头来源** — 最初以为 `>` 箭头来自 `li::before` 伪元素，实际上是 docsify-themeable 用 `background-image: linear-gradient()` 在 `<a>` 的 `padding-left` 区域画的
2. **getComputedStyle 是王道** — 调试 docsify 样式不能靠猜，必须用 Playwright 的 `page.evaluate(() => getComputedStyle(el))` 检查真实计算样式
3. **`content: ""` ≠ 可见** — `::before` 的 `content: ""` 配合 `display: none` 不会产生可见效果，不必恐慌
4. **MutationObserver 非必需** — sidebar-collapse 插件在 `doneEach` 中已经给 li 加类，不需要额外的 MutationObserver 监控

### 已知问题
- [x] 箭头来源误判（v1.0.0 已记录解决方案）
- [x] 二级子分类箭头残留（v1.0.0 已记录 `background-image: none` 覆盖方案）
- [ ] 超深层级（4 级+）的样式尚未覆盖（当前最多支持 3 级）

### 相关技能
- `frontend-design`: 前端界面设计，可配合用于整体 UI 优化
- `browse`: 浏览器自动化，可配合用于 Playwright 调试验证
- `debug`: 系统性调试，可配合用于复杂 CSS 问题定位
