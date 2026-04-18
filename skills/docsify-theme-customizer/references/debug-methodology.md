# Docsify SPA 样式调试方法论

## 为什么 docsify 样式调试特别困难？

1. **SPA 架构**：docsify 是单页应用，DOM 在运行时动态生成，静态检查 HTML 看不到实际渲染结果
2. **多层样式叠加**：核心 CSS + 主题 CSS + 插件 CSS + 用户自定义 CSS，优先级关系复杂
3. **插件动态修改 DOM**：sidebar-collapse 在 `doneEach` 中给 li 加类名，页面切换时可能重新生成
4. **SPA 缓存**：浏览器缓存 `index.html`，修改后不硬刷新看不到效果

## 调试工具链

### 首选：Playwright headless Chromium

**为什么不用 DevTools？** — docsify 样式问题往往需要检查计算后的样式（computed style），Playwright 的 `page.evaluate()` 可以精确获取 `getComputedStyle()` 结果，且可自动化批量检查。

### 环境搭建

```bash
# 1. 启动本地服务器（禁用缓存）
npx http-server docs -p <port> -c-1 --silent &

# 2. 确认服务器启动
curl -s -o /dev/null -w "%{http_code}" http://localhost:<port>/

# 3. 运行探测脚本
node /tmp/probe-sidebar.js

# 4. 清理
kill $(lsof -ti :<port>)
rm /tmp/probe-sidebar.js
```

## 调试流程（分层排查）

### 第一步：确认 DOM 结构

```javascript
// 检查侧边栏 DOM 结构
const structure = await page.evaluate(() => {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return 'sidebar-nav not found';
    return nav.innerHTML.substring(0, 2000);
});
```

**关注点**：
- li 是否有 `.file`/`.folder`/`level-N` 类？（确认插件是否生效）
- 标题用的是 `<a>`、`<p>` 还是 `<strong>`？（决定 CSS 选择器）
- 是否有意外的嵌套结构？

### 第二步：检查计算样式

```javascript
const probeResult = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('.sidebar-nav li.folder').forEach(li => {
        const text = (li.querySelector('p, strong, a') || {}).textContent || '';
        const beforeStyle = getComputedStyle(li, '::before');
        const childEl = li.querySelector('p, strong');
        results.push({
            text: text.substring(0, 30),
            className: li.className,
            // 伪元素箭头检查
            liBeforeDisplay: beforeStyle.display,
            liBeforeContent: beforeStyle.content,
            // 渐变箭头检查
            childBgImage: childEl ? getComputedStyle(childEl).backgroundImage : 'none',
            // 子元素伪元素检查
            childBeforeDisplay: childEl ? getComputedStyle(childEl, '::before').display : 'none',
        });
    });
    return results;
});
```

**判断标准**：
| 属性 | 期望值（箭头已隐藏） | 问题值 |
|------|---------------------|--------|
| `liBeforeDisplay` | `none` | `block` |
| `childBgImage` | `none` | `linear-gradient(...)` |
| `childBeforeDisplay` | `none` 或 `inline` (content=none) | `inline-block` (content 非 none) |

### 第三步：截图对比

```javascript
const sidebar = await page.$('.sidebar');
if (sidebar) {
    await sidebar.screenshot({ path: '/tmp/sidebar-check.png' });
}
```

**检查点**：
- 箭头是否可见？
- 层级间距是否合理？
- 文字大小/颜色是否符合预期？
- 暗色模式下是否正常？

### 第四步：展开/折叠状态检查

```javascript
// 手动展开子分类
await page.evaluate(() => {
    const folders = document.querySelectorAll('.sidebar-nav li.folder.level-2');
    folders.forEach(f => {
        f.classList.add('open');
        f.classList.remove('collapse');
    });
});
await page.waitForTimeout(500);
// 再次截图检查展开后的样式
```

## 常见问题排查表

| 现象 | 可能原因 | 排查方式 |
|------|---------|---------|
| 修改 CSS 后无变化 | 浏览器缓存 | Cmd+Shift+R 硬刷新 |
| `::before { display: none }` 但箭头仍在 | 箭头来自 `background-image` | 检查 `backgroundImage` 计算值 |
| 部分 li 没有 `.file`/`.folder` 类 | sidebar-collapse 未加载或加载顺序问题 | 检查插件 JS 是否正确引入 |
| 移动端 `body.close` 行为异常 | 移动端 close 逻辑与桌面端相反 | 确认使用正确的 class 切换逻辑 |
| Active 链接箭头残留 | active li 被包进 `.app-sub-sidebar` | 用更通用的选择器覆盖 |
| 子分类标题样式不生效 | `_sidebar.md` 中用了 `**加粗**` | 检查渲染后是 `<strong>` 还是 `<p>` |

## 调试脚本模板

完整的 Playwright 探测脚本见 `scripts/probe-sidebar.js`。
