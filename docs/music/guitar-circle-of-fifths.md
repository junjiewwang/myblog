# 🎸 五度圈

> 五度圈是音乐理论中最重要的工具之一，展示了 12 个调之间的五度关系

## 五度圈图示

<svg viewBox="0 0 440 460" xmlns="http://www.w3.org/2000/svg" style="max-width: 420px; height: auto; display: block; margin: 0 auto;">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fafbfc"/>
      <stop offset="100%" stop-color="#f0f2f5"/>
    </radialGradient>
    <!-- 箭头标记 -->
    <marker id="arrowGreen" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L10,5 L0,10 L3,5 Z" fill="#42b983"/>
    </marker>
    <marker id="arrowPurple" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L10,5 L0,10 L3,5 Z" fill="#667eea"/>
    </marker>
  </defs>
  
  <!-- 背景圆 -->
  <circle cx="220" cy="230" r="200" fill="url(#bgGrad)" stroke="#e1e4e8" stroke-width="2"/>
  
  <!-- 外圈区域 - 大调（填充色块，无边框线） -->
  <circle cx="220" cy="230" r="185" fill="#42b983" opacity="0.08"/>
  <circle cx="220" cy="230" r="155" fill="#fff"/>
  
  <!-- 内圈区域 - 小调（填充色块，无边框线） -->
  <circle cx="220" cy="230" r="140" fill="#667eea" opacity="0.08"/>
  <circle cx="220" cy="230" r="95" fill="#fff"/>
  
  <!-- 中心圆 -->
  <circle cx="220" cy="230" r="70" fill="#fff"/>
  
  <!-- 大调标签 - 半径170 -->
  <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" font-weight="700" font-size="20" fill="#2d3748" text-anchor="middle" dominant-baseline="central">
    <!-- 使用精确的三角函数计算位置: x = 220 + 170*sin(angle), y = 230 - 170*cos(angle) -->
    <text x="220" y="60">C</text>
    <text x="305" y="87.3">G</text>
    <text x="367.3" y="145">D</text>
    <text x="390" y="230">A</text>
    <text x="367.3" y="315">E</text>
    <text x="305" y="372.7">B</text>
    <text x="220" y="400" font-size="14">F♯/G♭</text>
    <text x="135" y="372.7">D♭</text>
    <text x="72.7" y="315">A♭</text>
    <text x="50" y="230">E♭</text>
    <text x="72.7" y="145">B♭</text>
    <text x="135" y="87.3">F</text>
  </g>
  
  <!-- 小调标签 - 半径117 -->
  <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" font-weight="600" font-size="14" fill="#5a67d8" text-anchor="middle" dominant-baseline="central">
    <!-- x = 220 + 117*sin(angle), y = 230 - 117*cos(angle) -->
    <text x="220" y="113">Am</text>
    <text x="278.5" y="131.5">Em</text>
    <text x="321.3" y="171.5">Bm</text>
    <text x="337" y="230">F♯m</text>
    <text x="321.3" y="288.5">C♯m</text>
    <text x="278.5" y="328.5">G♯m</text>
    <text x="220" y="347">E♭m</text>
    <text x="161.5" y="328.5">B♭m</text>
    <text x="118.7" y="288.5">Fm</text>
    <text x="103" y="230">Cm</text>
    <text x="118.7" y="171.5">Gm</text>
    <text x="161.5" y="131.5">Dm</text>
  </g>
  
  <!-- 升降号标记 - 更靠外 -->
  <g font-family="-apple-system, Arial, sans-serif" font-size="11" fill="#8b949e" text-anchor="middle" dominant-baseline="central">
    <text x="220" y="38">0</text>
    <text x="315" y="68">1♯</text>
    <text x="385" y="130">2♯</text>
    <text x="410" y="215">3♯</text>
    <text x="385" y="330">4♯</text>
    <text x="315" y="392">5♯</text>
    <text x="220" y="420">6</text>
    <text x="125" y="392">5♭</text>
    <text x="55" y="330">4♭</text>
    <text x="30" y="215">3♭</text>
    <text x="55" y="130">2♭</text>
    <text x="125" y="68">1♭</text>
  </g>
  
  <!-- 中心说明 -->
  <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" text-anchor="middle">
    <text x="220" y="215" font-size="18" font-weight="700" fill="#2d3748">五度圈</text>
    <text x="220" y="236" font-size="11" fill="#8b949e">Circle of Fifths</text>
    <text x="220" y="256" font-size="11" fill="#42b983">● 外圈: 大调</text>
    <text x="220" y="272" font-size="11" fill="#667eea">● 内圈: 小调</text>
  </g>
  
  <!-- 方向箭头 - 使用弧线和标准箭头 -->
  <g>
    <!-- 顺时针箭头 (+5度) -->
    <path d="M 245 35 A 180 180 0 0 1 290 50" fill="none" stroke="#42b983" stroke-width="2.5" marker-end="url(#arrowGreen)"/>
    <text x="300" y="35" font-family="-apple-system, Arial, sans-serif" font-size="12" font-weight="600" fill="#42b983">+5度 →</text>
    
    <!-- 逆时针箭头 (+4度) -->
    <path d="M 195 35 A 180 180 0 0 0 150 50" fill="none" stroke="#667eea" stroke-width="2.5" marker-end="url(#arrowPurple)"/>
    <text x="140" y="35" font-family="-apple-system, Arial, sans-serif" font-size="12" font-weight="600" fill="#667eea" text-anchor="end">← +4度</text>
  </g>
</svg>

## 五度圈解读

**基本规律**：
- **顺时针**：每移动一格，升高纯五度，增加一个升号
- **逆时针**：每移动一格，升高纯四度，增加一个降号
- **对角位置**：相差 6 个升/降号，为等音调（如 F♯ = G♭）

**关系大小调**：
- 外圈为大调，内圈为对应的关系小调
- 关系小调比大调低小三度（3个半音）
- 例如：C大调 → Am小调，G大调 → Em小调

**实用技巧**：

| 应用场景 | 方法 |
|---------|------|
| 找属和弦 | 顺时针下一个（C → G） |
| 找下属和弦 | 逆时针下一个（C → F） |
| 转调 | 相邻调最自然（C → G 或 C → F） |
| 找关系小调 | 看内圈对应位置 |

## 4152637 级数规律

> 五度圈隐藏着一个重要规律：**4-1-5-2-6-3-7** 级数顺序

**核心概念**：从任意大调的主音开始，沿五度圈顺时针方向，依次对应的音级为 **4-1-5-2-6-3-7**

**以 C 大调为例**：

| 位置 | F | C | G | D | A | E | B |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 音级 | 4 | 1 | 5 | 2 | 6 | 3 | 7 |
| 和弦 | F | C | G | Dm | Am | Em | Bdim |
| 功能 | S | T | D | S | T | T | D |

> **功能说明**：T = 主功能 (Tonic)，S = 下属功能 (Subdominant)，D = 属功能 (Dominant)

**规律解读**：

```
五度圈顺时针方向:

  F  ->  C  ->  G  ->  D  ->  A  ->  E  ->  B
  4      1      5      2      6      3      7
  |      |      |      |      |      |      |
  IV     I      V      II     VI     III    VII
```

**其他调的 4152637**：

| 调 | 4 | 1 | 5 | 2 | 6 | 3 | 7 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **C** | F | C | G | D | A | E | B |
| **G** | C | G | D | A | E | B | F♯ |
| **D** | G | D | A | E | B | F♯ | C♯ |
| **F** | B♭ | F | C | G | D | A | E |

**实用价值**：

1. **快速找和弦**：知道调内任意一个音，顺着五度圈就能找到所有级数
2. **和弦进行**：常见的 4-5-1、2-5-1、6-4-5-1 进行，在五度圈上都是相邻位置
3. **即兴伴奏**：熟记 4152637 顺序，任何调都能快速反应

**记忆口诀**：`四一五二六三七，五度圈上顺时记`
