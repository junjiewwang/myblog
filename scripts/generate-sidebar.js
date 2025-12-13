#!/usr/bin/env node
/**
 * 🚀 自动生成侧边栏脚本
 * 
 * 约定大于配置：
 * - 目录名 = 分类名
 * - .md 文件 = 文章
 * - 文件内第一个 # 标题 = 文章标题（否则使用文件名）
 * 
 * 使用方法：
 *   node scripts/generate-sidebar.js
 * 
 * 或添加到 package.json:
 *   "scripts": { "sidebar": "node scripts/generate-sidebar.js" }
 */

const fs = require('fs');
const path = require('path');

// 配置
const DOCS_DIR = path.join(__dirname, '../docs');
const OUTPUT_FILE = path.join(DOCS_DIR, '_sidebar.md');

// 目录映射（可自定义分类名称和图标）
const CATEGORY_MAP = {
    'java': { name: 'Java', icon: '☕' },
    'spring': { name: 'Spring', icon: '🌱' },
    'springboot': { name: 'SpringBoot', icon: '🚀' },
    'programmingLanguage': { name: '编程语言', icon: '💻' },
    'golang_study': { name: 'Golang', icon: '🐹' },
    'linux': { name: 'Linux', icon: '🐧' },
    'mac': { name: 'Mac', icon: '🍎' },
    'nginx': { name: 'Nginx', icon: '🌐' },
    'mybatis': { name: 'MyBatis', icon: '🗃️' },
    'nodejs': { name: 'Node.js', icon: '📦' },
    'data_structure_algorithms': { name: '数据结构与算法', icon: '🔢' },
    'binary_tree': { name: '二叉树', icon: '🌳' },
    'tree': { name: '树', icon: '🌲' },
    'leetcode': { name: 'LeetCode', icon: '💡' },
    'interview': { name: '面试', icon: '📝' },
    'vscode': { name: 'VSCode', icon: '🛠️' },
};

// 忽略的目录和文件
const IGNORE_DIRS = ['images', 'assets', '.git', 'node_modules', 'scripts'];
const IGNORE_FILES = ['_sidebar.md', '_navbar.md', '.nojekyll', 'index.html', 'README.md'];

/**
 * 从 Markdown 文件中提取标题
 */
function extractTitle(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const match = content.match(/^#\s+(.+)$/m);
        if (match) {
            return match[1].trim();
        }
    } catch (e) {
        // 忽略读取错误
    }
    // 使用文件名作为标题
    const basename = path.basename(filePath, '.md');
    return basename.replace(/[-_]/g, ' ');
}

/**
 * 递归扫描目录
 */
function scanDirectory(dir, relativePath = '') {
    const result = [];
    
    try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            const itemRelativePath = relativePath ? `${relativePath}/${item.name}` : item.name;
            
            if (item.isDirectory()) {
                // 忽略特定目录
                if (IGNORE_DIRS.some(ignore => item.name.includes(ignore))) {
                    continue;
                }
                
                // 递归扫描子目录
                const children = scanDirectory(fullPath, itemRelativePath);
                if (children.length > 0) {
                    result.push({
                        type: 'directory',
                        name: item.name,
                        path: itemRelativePath,
                        children: children
                    });
                }
            } else if (item.isFile() && item.name.endsWith('.md')) {
                // 忽略特定文件
                if (IGNORE_FILES.includes(item.name)) {
                    continue;
                }
                
                const title = extractTitle(fullPath);
                result.push({
                    type: 'file',
                    name: item.name,
                    path: itemRelativePath,
                    title: title
                });
            }
        }
    } catch (e) {
        console.error(`Error scanning ${dir}:`, e.message);
    }
    
    return result;
}

/**
 * 收集目录下所有文件（扁平化子目录）
 */
function collectAllFiles(item) {
    let files = [];
    
    if (item.type === 'file') {
        files.push(item);
    } else if (item.type === 'directory' && item.children) {
        for (const child of item.children) {
            files = files.concat(collectAllFiles(child));
        }
    }
    
    return files;
}

/**
 * URL 编码路径中的中文字符
 */
function encodePathSegments(filePath) {
    return filePath.split('/').map(segment => {
        // 如果包含非 ASCII 字符，进行编码
        if (/[^\x00-\x7F]/.test(segment)) {
            return encodeURIComponent(segment);
        }
        return segment;
    }).join('/');
}

/**
 * 生成侧边栏 Markdown
 */
function generateSidebar(items, indent = 0, isTopLevel = true) {
    let content = '';
    const prefix = '  '.repeat(indent);
    
    for (const item of items) {
        if (item.type === 'directory') {
            // 获取分类配置
            const category = CATEGORY_MAP[item.name] || { name: item.name, icon: '📁' };
            
            // 收集所有文件（包括子目录中的）
            const allFiles = collectAllFiles(item);
            
            if (allFiles.length > 0) {
                content += `${prefix}* **${category.icon} ${category.name}**\n`;
                
                // 添加所有文件 - 使用绝对路径（以 / 开头），并对中文进行 URL 编码
                for (const file of allFiles) {
                    const encodedPath = encodePathSegments(file.path);
                    content += `${prefix}  * [${file.title}](/${encodedPath})\n`;
                }
            }
        }
    }
    
    return content;
}

/**
 * 主函数
 */
function main() {
    console.log('🔍 扫描文档目录...');
    
    const structure = scanDirectory(DOCS_DIR);
    
    console.log('📝 生成侧边栏...');
    
    let sidebar = `<!-- 
  🤖 此文件由脚本自动生成
  📅 生成时间: ${new Date().toLocaleString('zh-CN')}
  
  运行 node scripts/generate-sidebar.js 重新生成
-->

* **🏠 首页**
  * [首页](/)

`;
    
    sidebar += generateSidebar(structure);
    
    fs.writeFileSync(OUTPUT_FILE, sidebar, 'utf-8');
    
    console.log(`✅ 侧边栏已生成: ${OUTPUT_FILE}`);
    console.log(`📊 共扫描到 ${countFiles(structure)} 篇文章`);
}

/**
 * 统计文件数量
 */
function countFiles(items) {
    let count = 0;
    for (const item of items) {
        if (item.type === 'file') {
            count++;
        } else if (item.children) {
            count += countFiles(item.children);
        }
    }
    return count;
}

main();
