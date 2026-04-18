---
name: docsify-theme-customizer
description: Docsify 博客/文档站的主题样式深度定制专家。当用户需要修改 docsify 侧边栏样式、隐藏/替换箭头、调整层级菜单、定制 docsify-themeable 主题、覆盖 docsify-sidebar-collapse 插件样式、调试 docsify SPA 中的 CSS 渲染问题、或参考 VitePress/Docusaurus 风格重设计 docsify 界面时使用。触发关键词：docsify、sidebar、侧边栏、箭头、折叠、主题、themeable、sidebar-collapse、层级菜单。
---

# Docsify 主题深度定制

## 概述

本技能封装了 docsify + docsify-themeable + docsify-sidebar-collapse 技术栈的样式定制经验，提供 CSS 覆盖策略、调试方法论和可复用的样式代码片段。

## 核心知识：docsify 样式体系

### 三层样式优先级（从低到高）

1. **docsify 核心** — 基础 HTML 结构和默认样式
2. **docsify-themeable 主题** — CSS 变量 + `background-image` 渐变箭头
3. **docsify-sidebar-collapse 插件** — `::before` 伪元素箭头 + `.file`/`.folder`/`level-N` 自动分类
4. **用户自定义 CSS** — 在 `<style>` 中用 `!important` 覆盖

### 关键发现：箭头的双重来源

docsify 侧边栏的 `>` 箭头有**两个独立来源**，必须分别覆盖：

| 来源 | 机制 | 选择器 | 覆盖方式 |
|------|------|--------|---------|
| sidebar-collapse 插件 | `::before` 伪元素（border + rotate） | `li:not(.file)::before` | `display: none !important` |
| docsify-themeable 主题 | `background-image: linear-gradient(45deg/135deg)` | `li > a/p/strong` | `background-image: none !important` |

**⚠️ 常见陷阱**：只覆盖 `::before` 伪元素但忽略 `background-image` 渐变，导致箭头仍然可见。

### 插件自动分类机制

`docsify-sidebar-collapse` 在 `doneEach` 钩子中自动分类：
- 叶子节点（无子 li）→ 加 `.file` 类
- 分类节点（有子 li）→ 加 `.folder` 类 + `level-N` 类
- 无需额外 JS，直接利用这些类做 CSS 选择器

## 工作流程

### 1. 需求分析

确认用户的定制目标：
- 隐藏/修改箭头？
- 调整层级样式？
- 修改主题色/间距/字体？
- 移动端适配？

### 2. 读取参考文档

根据需求加载对应的参考文档：
- **CSS 覆盖策略** → 读取 `references/css-override-patterns.md`
- **调试方法论** → 读取 `references/debug-methodology.md`

### 3. 定位修改文件

docsify 博客通常所有自定义都在 `docs/index.html` 的 `<style>` 标签中。定位步骤：
1. 找到 `docs/index.html`
2. 定位 `<!-- 自定义样式 -->` 或 `<style>` 标签
3. 找到 `侧边栏样式` 区块

### 4. 实施修改

遵循以下原则：
- 使用 CSS 变量（`:root`）定义主题色、间距等可配置值
- 用 `!important` 确保覆盖插件/主题默认样式
- 提供亮色/暗色双主题适配（`@media (prefers-color-scheme: dark)`）
- 移动端适配（`@media screen and (max-width: 768px)`）

### 5. 验证

使用 Playwright headless 浏览器验证：
1. 启动本地 HTTP 服务器：`npx http-server docs -p <port> -c-1 --silent &`
2. 运行探测脚本（见 `scripts/probe-sidebar.js`）检查 DOM 和计算样式
3. 截取侧边栏截图确认视觉效果
4. 清理临时文件和服务器

## CSS 选择器速查

```css
/* 一级分类 */
.sidebar-nav > ul > li                     /* 一级 li */
.sidebar-nav > ul > li > p                 /* 一级标题（纯文本） */
.sidebar-nav > ul > li > strong            /* 一级标题（加粗） */

/* 二级子分类 */
.sidebar-nav > ul > li > ul > li.folder    /* 二级分类 li */
.sidebar-nav > ul > li > ul > li.folder > strong  /* 二级标题 */

/* 文章链接 */
.sidebar-nav li.file > a                   /* 文章链接 */
.sidebar-nav li.file.active > a            /* 当前激活文章 */

/* 三级文章（二级分类下的文章） */
.sidebar-nav > ul > li > ul > li > ul > li.file > a

/* 箭头覆盖 */
.sidebar-nav ul:not(.app-sub-sidebar) > li::before  /* 伪元素箭头 */
.sidebar-nav li > a, li > p, li > strong             /* 渐变箭头 */
```

## 常见定制模式

### 模式 A：去掉所有箭头（VitePress 风格）

```css
/* 1) 隐藏 ::before 伪元素箭头 */
.sidebar-nav ul:not(.app-sub-sidebar) > li::before {
    display: none !important;
}
/* 2) 隐藏 background-image 渐变箭头 */
.sidebar-nav li > a,
.sidebar-nav li > p,
.sidebar-nav li > strong {
    background-image: none !important;
}
```

### 模式 B：层级视觉区分（间距+字号+颜色）

```css
/* 一级分类 */
.sidebar-nav > ul > li {
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px solid rgba(128, 128, 128, 0.1);
}
.sidebar-nav > ul > li:first-child {
    border-top: none; margin-top: 0; padding-top: 0;
}
.sidebar-nav > ul > li > p,
.sidebar-nav > ul > li > strong {
    font-weight: 600 !important;
    font-size: 13px;
    color: var(--text-color) !important;
}

/* 二级子分类 */
.sidebar-nav > ul > li > ul > li.folder > strong {
    font-size: 12px !important;
    font-weight: 500 !important;
    color: var(--text-color-secondary) !important;
}

/* 文章链接 */
.sidebar-nav li.file > a {
    font-size: 13px;
    padding: 5px 8px;
    border-radius: 4px;
    background-image: none !important;
}
```

### 模式 C：Active 链接柔和高亮

```css
.sidebar-nav li.active > a {
    color: var(--theme-color) !important;
    background: rgba(66, 185, 131, 0.08) !important;
    border-radius: 4px !important;
    border: none !important;
}
```

## 资源

### scripts/
- `probe-sidebar.js` — Playwright 侧边栏 CSS 探测脚本模板

### references/
- `css-override-patterns.md` — 完整的 CSS 覆盖策略和代码片段库
- `debug-methodology.md` — docsify SPA 样式调试方法论
