#!/usr/bin/env node
/**
 * 🚀 快速创建新文章脚本
 * 
 * 使用方法：
 *   node scripts/new-post.js <分类> <文章标题>
 * 
 * 示例：
 *   node scripts/new-post.js java "Spring Boot 入门指南"
 *   node scripts/new-post.js linux "Docker 容器化部署"
 * 
 * 或使用 npm:
 *   npm run new java "文章标题"
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');

// 分类目录映射
const CATEGORIES = {
    'java': 'java',
    'spring': 'spring',
    'springboot': 'springboot',
    'go': 'programmingLanguage/golang_study',
    'golang': 'programmingLanguage/golang_study',
    'linux': 'linux',
    'mac': 'mac',
    'nginx': 'nginx',
    'mybatis': 'mybatis',
    'node': 'nodejs',
    'nodejs': 'nodejs',
    'algo': 'data_structure_algorithms',
    'leetcode': 'leetcode',
    'interview': 'interview',
    'vscode': 'vscode'
};

/**
 * 生成文件名（移除特殊字符）
 */
function generateFileName(title) {
    return title
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);
}

/**
 * 生成文章模板
 */
function generateTemplate(title) {
    const date = new Date().toLocaleDateString('zh-CN');
    
    return `# ${title}

> 📅 创建时间: ${date}

## 概述

在这里写文章概述...

## 正文

### 第一部分

内容...

### 第二部分

内容...

## 总结

总结要点...

## 参考

- [参考链接1](https://example.com)
`;
}

/**
 * 主函数
 */
function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log(`
📝 快速创建新文章

使用方法:
  node scripts/new-post.js <分类> <文章标题>

可用分类:
  ${Object.keys(CATEGORIES).join(', ')}

示例:
  node scripts/new-post.js java "Spring Boot 入门"
  node scripts/new-post.js linux "Docker 部署指南"
`);
        process.exit(1);
    }
    
    const category = args[0].toLowerCase();
    const title = args.slice(1).join(' ');
    
    // 验证分类
    if (!CATEGORIES[category]) {
        console.error(`❌ 未知分类: ${category}`);
        console.log(`可用分类: ${Object.keys(CATEGORIES).join(', ')}`);
        process.exit(1);
    }
    
    const categoryDir = path.join(DOCS_DIR, CATEGORIES[category]);
    const fileName = generateFileName(title) + '.md';
    const filePath = path.join(categoryDir, fileName);
    
    // 确保目录存在
    if (!fs.existsSync(categoryDir)) {
        fs.mkdirSync(categoryDir, { recursive: true });
        console.log(`📁 创建目录: ${CATEGORIES[category]}`);
    }
    
    // 检查文件是否已存在
    if (fs.existsSync(filePath)) {
        console.error(`❌ 文件已存在: ${filePath}`);
        process.exit(1);
    }
    
    // 创建文件
    const content = generateTemplate(title);
    fs.writeFileSync(filePath, content, 'utf-8');
    
    console.log(`
✅ 文章创建成功!

📄 文件路径: ${filePath}
🔗 访问路径: /${CATEGORIES[category]}/${fileName}

下一步:
1. 编辑文章内容
2. 运行 npm run sidebar 更新侧边栏
3. git add && git commit && git push
`);
}

main();
