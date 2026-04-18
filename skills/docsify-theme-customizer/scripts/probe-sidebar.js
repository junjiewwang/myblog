/**
 * Docsify 侧边栏 CSS 探测脚本模板
 * 
 * 用法：
 *   1. 启动本地服务器：npx http-server docs -p 3847 -c-1 --silent &
 *   2. 运行：node probe-sidebar.js
 *   3. 查看输出：DOM 结构、计算样式、截图
 * 
 * 可自定义参数：
 *   - PORT: 本地服务器端口
 *   - SCREENSHOT_PATH: 截图保存路径
 *   - EXPAND_FOLDERS: 是否自动展开所有分类
 */

const { chromium } = require('playwright');

// ========== 可自定义参数 ==========
const PORT = process.env.PORT || 3847;
const BASE_URL = `http://localhost:${PORT}/#/`;
const SCREENSHOT_PATH = process.env.SCREENSHOT_PATH || '/tmp/sidebar-probe.png';
const EXPAND_FOLDERS = process.env.EXPAND_FOLDERS !== 'false'; // 默认展开

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

    console.log(`🔍 正在探测 ${BASE_URL} ...\n`);

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // ========== 1. 检查插件是否加载 ==========
    const pluginCheck = await page.evaluate(() => {
        const hasFile = document.querySelector('.sidebar-nav li.file');
        const hasFolder = document.querySelector('.sidebar-nav li.folder');
        const hasLevel = document.querySelector('.sidebar-nav li.level-1, .sidebar-nav li.level-2');
        return {
            sidebarCollapse: !!(hasFile || hasFolder || hasLevel),
            fileCount: document.querySelectorAll('.sidebar-nav li.file').length,
            folderCount: document.querySelectorAll('.sidebar-nav li.folder').length,
        };
    });
    console.log('📦 插件状态:', JSON.stringify(pluginCheck, null, 2));

    // ========== 2. 展开分类（可选） ==========
    if (EXPAND_FOLDERS) {
        await page.evaluate(() => {
            document.querySelectorAll('.sidebar-nav li.folder').forEach(li => {
                li.classList.add('open');
                li.classList.remove('collapse');
            });
        });
        await page.waitForTimeout(500);
        console.log('\n📂 已展开所有分类');
    }

    // ========== 3. 探测所有 folder 节点的 CSS 状态 ==========
    const folderProbe = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('.sidebar-nav li.folder').forEach(li => {
            const childEl = li.querySelector('p, strong, a');
            const text = childEl ? childEl.textContent : '';
            const beforeStyle = getComputedStyle(li, '::before');
            const childBeforeStyle = childEl ? getComputedStyle(childEl, '::before') : null;

            results.push({
                text: text.substring(0, 40).trim(),
                className: li.className,
                // 伪元素箭头
                liBeforeDisplay: beforeStyle.display,
                liBeforeContent: beforeStyle.content,
                // 渐变箭头
                childTag: childEl ? childEl.tagName : 'none',
                childBgImage: childEl ? getComputedStyle(childEl).backgroundImage : 'none',
                childPaddingLeft: childEl ? getComputedStyle(childEl).paddingLeft : 'none',
                // 子元素伪元素
                childBeforeDisplay: childBeforeStyle ? childBeforeStyle.display : 'none',
                childBeforeContent: childBeforeStyle ? childBeforeStyle.content : 'none',
            });
        });
        return results;
    });

    console.log('\n🎯 Folder 节点探测结果:');
    folderProbe.forEach((item, i) => {
        const hasArrow = item.liBeforeDisplay !== 'none' || item.childBgImage !== 'none';
        const status = hasArrow ? '⚠️ 有箭头' : '✅ 无箭头';
        console.log(`  ${i + 1}. [${status}] ${item.text}`);
        if (hasArrow) {
            console.log(`     liBeforeDisplay: ${item.liBeforeDisplay}`);
            console.log(`     childBgImage: ${item.childBgImage.substring(0, 60)}`);
        }
    });

    // ========== 4. 探测文章节点 ==========
    const fileProbe = await page.evaluate(() => {
        const results = [];
        const files = document.querySelectorAll('.sidebar-nav li.file');
        // 只检查前 5 个
        for (let i = 0; i < Math.min(5, files.length); i++) {
            const li = files[i];
            const a = li.querySelector('a');
            const text = a ? a.textContent : '';
            const beforeStyle = getComputedStyle(li, '::before');
            results.push({
                text: text.substring(0, 40).trim(),
                liBeforeDisplay: beforeStyle.display,
                aBgImage: a ? getComputedStyle(a).backgroundImage : 'none',
                aPaddingLeft: a ? getComputedStyle(a).paddingLeft : 'none',
            });
        }
        return results;
    });

    console.log('\n📄 文章节点探测结果（前 5 个）:');
    fileProbe.forEach((item, i) => {
        const hasArrow = item.liBeforeDisplay !== 'none' || item.aBgImage !== 'none';
        const status = hasArrow ? '⚠️ 有箭头' : '✅ 无箭头';
        console.log(`  ${i + 1}. [${status}] ${item.text}`);
    });

    // ========== 5. 截图 ==========
    const sidebar = await page.$('.sidebar');
    if (sidebar) {
        await sidebar.screenshot({ path: SCREENSHOT_PATH });
        console.log(`\n📸 截图已保存: ${SCREENSHOT_PATH}`);
    }

    // ========== 6. 总结 ==========
    const totalFolders = folderProbe.length;
    const arrowFolders = folderProbe.filter(f => f.liBeforeDisplay !== 'none' || f.childBgImage !== 'none').length;
    const totalFiles = fileProbe.length;
    const arrowFiles = fileProbe.filter(f => f.liBeforeDisplay !== 'none' || f.aBgImage !== 'none').length;

    console.log('\n📊 总结:');
    console.log(`  分类节点: ${totalFolders} 个, ${arrowFolders} 个有箭头`);
    console.log(`  文章节点: ${totalFiles} 个（采样）, ${arrowFiles} 个有箭头`);
    console.log(arrowFolders + arrowFiles === 0 ? '  🎉 所有箭头已隐藏！' : '  ⚠️ 仍有箭头残留，需要进一步覆盖');

    await browser.close();
})();
