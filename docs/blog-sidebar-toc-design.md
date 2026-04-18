# 博客侧边栏同步 + 右侧 TOC 面板需求

## 需求背景

1. **问题 1**：打开文章后，浏览过程中左侧菜单栏不会自动滚动同步到当前文章位置
2. **问题 2**：左侧侧边栏同时包含文章名和文章内标题（h2/h3），过于冗长。希望左侧仅显示文章名列表并指示当前文章，右侧独立展示章节目录

## 方案设计

### 架构变更

| 区域 | 变更前 | 变更后 |
|------|--------|--------|
| 左侧侧边栏 | 文章列表 + 文章内 h2/h3 标题 | 仅文章名列表（保留分类折叠）|
| 当前文章指示 | 仅颜色高亮 | 绿色高亮 + 左侧竖条指示器 + 自动滚动到可视区 |
| 右侧 | 无 | TOC 面板（章节目录，滚动同步高亮）|

### 右侧 TOC 面板交互

- **桌面端**：固定右侧，默认可见；提供折叠按钮可收起，收起后右侧边缘显示展开按钮
- **移动端**：默认隐藏；右下角浮动按钮(☰)触发抽屉面板，带遮罩层；选择章节后自动关闭
- **滚动同步**：使用 IntersectionObserver + 滚动节流检测当前可视标题，实时高亮 TOC 对应项
- **空状态**：文章无 h2/h3 标题时，TOC 面板自动隐藏
- **主题**：支持亮色/暗色自动跟随

## 技术实现

### 改动文件
- `docs/index.html`（所有代码集中在此文件）

### 具体改动

1. **Docsify 配置**：`subMaxLevel: 3` → `subMaxLevel: 0`
2. **CSS 新增**：
   - 侧边栏 active 链接左侧绿色竖条指示器
   - 右侧 TOC 面板完整样式（桌面端固定 + 移动端抽屉）
   - 内容区域右边距适配（桌面端为 TOC 留空间）
   - 亮色/暗色主题双适配
3. **HTML 新增**：
   - `#toc-panel` TOC 面板容器（header + body + list）
   - `#toc-edge-btn` 桌面端边缘展开按钮
   - `#toc-fab` 移动端浮动按钮
   - `#toc-overlay` 移动端遮罩层
4. **JS 新增**：
   - 侧边栏 active 链接自动 `scrollIntoView`
   - `buildTOC()` 解析 h2/h3 标题构建列表
   - IntersectionObserver 滚动同步高亮
   - 桌面端折叠/展开控制
   - 移动端抽屉开关
   - Docsify `doneEach` 钩子集成

## 实施进展

- [x] 修改 subMaxLevel 为 0
- [x] 添加侧边栏 active 链接增强指示器（CSS）
- [x] 添加右侧 TOC 面板完整 CSS
- [x] 添加 TOC 面板 HTML 元素
- [x] 添加 TOC 核心 JS 逻辑
- [x] 添加侧边栏 active 自动滚动 JS
- [x] 移动端浮动按钮 + 抽屉适配
- [x] 移除"精选推荐"分类
- [x] 侧边栏 active 样式优化：柔和浅背景 + 圆角 + 去除绿色竖条和加粗
- [x] 统一隐藏文章（叶子）节点前的 `>` 箭头
- [x] 重新设计侧边栏层级样式（去掉所有箭头，参考 VitePress/Docusaurus 风格）

## 关键技术点

### 侧边栏箭头隐藏原理

docsify 侧边栏存在两类箭头来源，需要分别覆盖：

1. **sidebar-collapse 插件的 `::before` 伪元素箭头**
   - 选择器：`.sidebar-nav ul:not(.app-sub-sidebar) > li:not(.file)::before`
   - 通过 `border-right + border-bottom + rotate` 画折叠三角
   - 覆盖方式：`.sidebar-nav ul:not(.app-sub-sidebar) > li::before { display: none !important; }`

2. **docsify-themeable 主题的 `background-image` 渐变箭头**
   - 在 `<a>`、`<p>`、`<strong>` 元素的 `padding-left` 区域用 `linear-gradient(45deg/135deg)` 画 `>` 箭头
   - 覆盖方式：`.sidebar-nav li > a, .sidebar-nav li > p, .sidebar-nav li > strong { background-image: none !important; }`

### 层级样式设计（VitePress 风格）

| 层级 | 元素 | 字号 | 字重 | 颜色 | 间距 |
|------|------|------|------|------|------|
| 一级分类 | `> ul > li > p/strong` | 13px | 600 | `--text-color` | `margin-top: 4px; padding-top: 8px; border-top 分隔线` |
| 二级子分类 | `li.folder.level-2 > strong` | 12px | 500 | `--text-color-secondary` | `margin: 10px 0 2px 0` |
| 文章链接 | `li.file > a` | 13px / 12.5px（三级） | normal | `--sidebar-nav-link-color` | `padding: 5px 8px` |

### 插件自动分类机制

- `docsify-sidebar-collapse` 在 `doneEach` 钩子中自动给叶子 li 加 `.file` 类、分类 li 加 `.folder` 类和 `level-N` 类
- 无需额外 JS（之前的 `markLeafArticles()` 函数已清理）

## 遗留问题

- 无

## 验证记录

**2026-04-18** 使用 Playwright headless Chromium 探测所有 folder 节点 CSS 状态：
- 所有 `li.folder` 的 `li::before` display = `none` ✅（sidebar-collapse 箭头已隐藏）
- 所有 `<p>/<strong>` 的 `backgroundImage` = `none` ✅（docsify-themeable 渐变箭头已隐藏）
- 截图确认：一级分类、二级子分类、文章链接均无任何箭头残留
- 层级区分清晰：通过字号、字重、颜色深浅和间距实现视觉层次
- 折叠/展开功能正常
- 若浏览器未显示变化，需 Cmd+Shift+R 硬刷新清除缓存
