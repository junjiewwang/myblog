# Docsify CSS 覆盖策略参考

## 1. 侧边栏箭头完全隐藏

### 1.1 sidebar-collapse 插件的 `::before` 伪元素箭头

**原始样式**（来自 `sidebar.min.css`）：
```css
.sidebar-nav ul:not(.app-sub-sidebar) > li:not(.file)::before {
    content: "";
    display: block;
    position: absolute;
    width: 0; height: 0;
    border-right: 5px solid transparent;
    border-bottom: 5px solid var(--sidebar-nav-link-color);
    transform: rotate(-45deg);
    /* ... */
}
```

**覆盖方式**：
```css
.sidebar-nav ul:not(.app-sub-sidebar) > li::before {
    display: none !important;
}
```

### 1.2 docsify-themeable 主题的渐变箭头

**原始样式**（来自 `theme-simple.css`）：
```css
/* 在 <a>/<p>/<strong> 的 padding-left 区域画渐变 > 箭头 */
.sidebar-nav li > a {
    background-image: linear-gradient(45deg, currentColor 50%, transparent 50%),
                      linear-gradient(135deg, transparent 50%, currentColor 50%);
    background-position: /* ... */;
    background-size: /* ... */;
    padding-left: 20px;
}
```

**覆盖方式**：
```css
.sidebar-nav li > a,
.sidebar-nav li > p,
.sidebar-nav li > strong {
    background-image: none !important;
}
```

**⚠️ 关键**：必须同时覆盖 `<a>`、`<p>` 和 `<strong>` 三种元素，因为侧边栏中分类标题可能用不同标签渲染。

## 2. 层级样式区分

### 2.1 一级分类标题

```css
/* 容器 */
.sidebar-nav > ul > li {
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px solid rgba(128, 128, 128, 0.1);
}
.sidebar-nav > ul > li:first-child {
    border-top: none;
    margin-top: 0;
    padding-top: 0;
}

/* 标题文字 */
.sidebar-nav > ul > li > p,
.sidebar-nav > ul > li > strong {
    font-weight: 600 !important;
    color: var(--text-color) !important;
    font-size: 13px;
    margin: 4px 0;
    padding: 6px 8px;
    display: block;
    letter-spacing: 0.3px;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.2s ease;
}
.sidebar-nav > ul > li > p:hover,
.sidebar-nav > ul > li > strong:hover {
    background: rgba(128, 128, 128, 0.06);
}
```

### 2.2 二级子分类标题

```css
.sidebar-nav > ul > li > ul > li.folder > p,
.sidebar-nav > ul > li > ul > li.folder > strong,
.sidebar-nav > ul > li > ul > li.folder > p > strong {
    font-size: 12px !important;
    font-weight: 500 !important;
    color: var(--text-color-secondary, #888) !important;
    letter-spacing: 0.4px;
    margin: 10px 0 2px 0;
    padding: 4px 8px;
    display: block;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.2s ease;
}
```

### 2.3 文章链接

```css
.sidebar-nav li.file > a {
    font-size: 13px;
    color: var(--sidebar-nav-link-color) !important;
    padding: 5px 8px;
    padding-left: 8px !important;
    display: block;
    border-radius: 4px;
    transition: all 0.2s ease;
    background-image: none !important;
}
.sidebar-nav li.file > a:hover {
    color: var(--theme-color) !important;
    background: rgba(128, 128, 128, 0.06);
}

/* 三级文章链接（更紧凑） */
.sidebar-nav > ul > li > ul > li > ul > li.file > a {
    font-size: 12.5px;
    padding: 4px 8px;
}
```

### 2.4 Active 链接高亮

```css
/* 柔和背景 + 主题色文字 */
.sidebar-nav li.active > a {
    color: var(--theme-color) !important;
    font-weight: normal !important;
    background: rgba(66, 185, 131, 0.08) !important;
    border-radius: 4px !important;
    border: none !important;
}

/* 清除 themeable 的 active 右边框 */
.sidebar-nav li.active > a,
.sidebar-nav li.collapse > a {
    border: none !important;
    margin-right: 0 !important;
}

/* 暗色模式 */
@media (prefers-color-scheme: dark) {
    .sidebar-nav li.active > a {
        background: rgba(66, 211, 146, 0.1) !important;
    }
}
```

## 3. CSS 变量体系

### 3.1 docsify-themeable 可覆盖的侧边栏变量

```css
:root {
    --sidebar-width: 280px;
    --sidebar-background: #fff;
    --sidebar-nav-link-color: #3a3a3a;
    --sidebar-nav-link-color--active: var(--theme-color);
    --sidebar-nav-link-font-weight--active: normal;
    --sidebar-nav-link-border-color--active: transparent;
    --sidebar-nav-link-border-width--active: 0;
    --sidebar-nav-link-border-width: 0;
    --sidebar-nav-link-background--active: rgba(66, 185, 131, 0.08);
    --sidebar-nav-link-margin: 0;
}
```

### 3.2 自定义主题变量

```css
:root {
    /* 主题色 */
    --theme-color: #42b983;
    --theme-color-light: #67c99a;
    --theme-color-dark: #33a06f;
    
    /* 文字颜色 */
    --text-color: #1a1a1a;
    --text-color-secondary: #4a4a4a;
    --text-color-tertiary: #6a6a6a;
    
    /* 背景色 */
    --bg-color: #ffffff;
    --bg-color-secondary: #f5f7f9;
    
    /* 边框色 */
    --border-color: #e0e4e8;
}

@media (prefers-color-scheme: dark) {
    :root {
        --theme-color: #42d392;
        --text-color: #e8e8e8;
        --text-color-secondary: #b8b8b8;
        --text-color-tertiary: #888888;
        --bg-color: #1e1e1e;
        --sidebar-background: #252526;
        --border-color: #404040;
    }
}
```

## 4. 侧边栏切换按钮定制

### 4.1 胶囊形状替换（桌面端）

```css
body .sidebar-toggle {
    position: fixed !important;
    left: calc(var(--sidebar-width) - 14px) !important;
    top: 80px !important;
    width: 28px !important;
    height: 56px !important;
    background: var(--sidebar-background) !important;
    border: 1px solid var(--border-color) !important;
    border-left: none !important;
    border-radius: 0 14px 14px 0 !important;
    box-shadow: 2px 0 8px rgba(0,0,0,0.08) !important;
}

/* 隐藏默认三条横线 */
body .sidebar-toggle span,
body .sidebar-toggle .sidebar-toggle-button {
    display: none !important;
}

/* 自定义箭头 */
body .sidebar-toggle::before {
    content: '' !important;
    width: 7px !important;
    height: 7px !important;
    border-left: 2px solid var(--theme-color) !important;
    border-bottom: 2px solid var(--theme-color) !important;
    transform: rotate(45deg) !important;
}
```

## 5. 移动端适配要点

```css
@media screen and (max-width: 768px) {
    /* 隐藏桌面端切换按钮 */
    body .sidebar-toggle { display: none !important; }
    
    /* 侧边栏打开/关闭逻辑（注意：移动端和桌面端相反！）
       body 没有 close 类 = 侧边栏隐藏
       body 有 close 类 = 侧边栏显示 */
}
```

**⚠️ 关键知识**：docsify-themeable 在移动端的 `body.close` 行为与桌面端**相反**。移动端添加 `close` 类才是打开侧边栏。
