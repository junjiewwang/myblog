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

---

## 五度圈 × 调式：滑动窗口

> 一个更深层的洞察：**调式 = 五度圈上滑动的 7 音窗口**。任何一个自然大调音阶，都是五度圈上连续的 7 个音；保持主音 C 不动、把这 7 音窗口在五度圈上左右滑动，就依次得到七个调式。

### 核心结论

- **窗口右移 1 格（+1 升号）** → C Lydian（最亮，特征音 #4）
- **不动** → C Ionian（大调基准）
- **窗口左移 1～5 格（+1～5 降号）** → C Mixolydian → C Dorian → C Aeolian → C Phrygian → C Locrian（越来越暗）

每滑一格，就「丢掉窗口一端的音、在另一端补一个音」：右移丢 F 补 F♯，左移丢 B 补 B♭。调式的「级数顺序」（Lydian Ⅳ - Ionian Ⅰ - Mixolydian Ⅴ - Dorian Ⅱ - Aeolian Ⅵ - Phrygian Ⅲ - Locrian Ⅶ，即 4-1-5-2-6-3-7）与「音级顺序」一致，正是因为这个滑动结构。

### 静态对照图：七个窗口全貌

<svg viewBox="0 0 820 320" xmlns="http://www.w3.org/2000/svg" style="max-width: 760px; height: auto; display: block; margin: 0 auto;">
  <defs>
    <linearGradient id="winGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#42b983" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#42b983" stop-opacity="0.22"/>
    </linearGradient>
  </defs>

  <!-- 顶部音名 -->
  <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" font-size="13" text-anchor="middle">
    <text x="119" y="30" fill="#8b949e">G♭</text>
    <text x="167" y="30" fill="#8b949e">D♭</text>
    <text x="215" y="30" fill="#8b949e">A♭</text>
    <text x="263" y="30" fill="#8b949e">E♭</text>
    <text x="311" y="30" fill="#8b949e">B♭</text>
    <text x="359" y="30" fill="#8b949e">F</text>
    <text x="407" y="30" fill="#42b983" font-weight="700">C</text>
    <text x="455" y="30" fill="#8b949e">G</text>
    <text x="503" y="30" fill="#8b949e">D</text>
    <text x="551" y="30" fill="#8b949e">A</text>
    <text x="599" y="30" fill="#8b949e">E</text>
    <text x="647" y="30" fill="#8b949e">B</text>
    <text x="695" y="30" fill="#8b949e">F♯</text>
  </g>

  <!-- 以下 7 行：每行一个调式，窗口矩形内标注 7 个音名，主音 C 用深色块突出 -->
  <!-- Lydian：窗口 C G D A E B F♯ -->
  <rect x="383" y="44" width="336" height="26" rx="4" fill="url(#winGrad)" stroke="#42b983" stroke-opacity="0.5"/>
  <rect x="383" y="44" width="48" height="26" rx="4" fill="#42b983"/>
  <text x="407" y="57" font-family="-apple-system, Arial, sans-serif" font-size="12" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">C</text>
  <text x="455" y="57" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">G</text>
  <text x="503" y="57" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">D</text>
  <text x="551" y="57" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">A</text>
  <text x="599" y="57" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">E</text>
  <text x="647" y="57" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">B</text>
  <text x="695" y="57" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">F♯</text>
  <text x="90" y="57" font-family="-apple-system, Arial, sans-serif" font-size="13" font-weight="700" fill="#2d3748" text-anchor="end" dominant-baseline="central">Lydian</text>
  <text x="726" y="57" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#8b949e" dominant-baseline="central">1♯</text>

  <!-- Ionian：窗口 F C G D A E B -->
  <rect x="335" y="78" width="336" height="26" rx="4" fill="url(#winGrad)" stroke="#42b983" stroke-opacity="0.5"/>
  <rect x="383" y="78" width="48" height="26" rx="4" fill="#42b983"/>
  <text x="407" y="91" font-family="-apple-system, Arial, sans-serif" font-size="12" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">C</text>
  <text x="359" y="91" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">F</text>
  <text x="455" y="91" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">G</text>
  <text x="503" y="91" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">D</text>
  <text x="551" y="91" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">A</text>
  <text x="599" y="91" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">E</text>
  <text x="647" y="91" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">B</text>
  <text x="90" y="91" font-family="-apple-system, Arial, sans-serif" font-size="13" font-weight="700" fill="#2d3748" text-anchor="end" dominant-baseline="central">Ionian</text>
  <text x="726" y="91" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#8b949e" dominant-baseline="central">0</text>

  <!-- Mixolydian：窗口 B♭ F C G D A E -->
  <rect x="287" y="112" width="336" height="26" rx="4" fill="url(#winGrad)" stroke="#42b983" stroke-opacity="0.5"/>
  <rect x="383" y="112" width="48" height="26" rx="4" fill="#42b983"/>
  <text x="407" y="125" font-family="-apple-system, Arial, sans-serif" font-size="12" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">C</text>
  <text x="311" y="125" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">B♭</text>
  <text x="359" y="125" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">F</text>
  <text x="455" y="125" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">G</text>
  <text x="503" y="125" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">D</text>
  <text x="551" y="125" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">A</text>
  <text x="599" y="125" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">E</text>
  <text x="90" y="125" font-family="-apple-system, Arial, sans-serif" font-size="13" font-weight="700" fill="#2d3748" text-anchor="end" dominant-baseline="central">Mixolydian</text>
  <text x="726" y="125" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#8b949e" dominant-baseline="central">1♭</text>

  <!-- Dorian：窗口 E♭ B♭ F C G D A -->
  <rect x="239" y="146" width="336" height="26" rx="4" fill="url(#winGrad)" stroke="#42b983" stroke-opacity="0.5"/>
  <rect x="383" y="146" width="48" height="26" rx="4" fill="#42b983"/>
  <text x="407" y="159" font-family="-apple-system, Arial, sans-serif" font-size="12" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">C</text>
  <text x="263" y="159" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">E♭</text>
  <text x="311" y="159" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">B♭</text>
  <text x="359" y="159" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">F</text>
  <text x="455" y="159" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">G</text>
  <text x="503" y="159" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">D</text>
  <text x="551" y="159" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">A</text>
  <text x="90" y="159" font-family="-apple-system, Arial, sans-serif" font-size="13" font-weight="700" fill="#2d3748" text-anchor="end" dominant-baseline="central">Dorian</text>
  <text x="726" y="159" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#8b949e" dominant-baseline="central">2♭</text>

  <!-- Aeolian：窗口 A♭ E♭ B♭ F C G D -->
  <rect x="191" y="180" width="336" height="26" rx="4" fill="url(#winGrad)" stroke="#42b983" stroke-opacity="0.5"/>
  <rect x="383" y="180" width="48" height="26" rx="4" fill="#42b983"/>
  <text x="407" y="193" font-family="-apple-system, Arial, sans-serif" font-size="12" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">C</text>
  <text x="215" y="193" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">A♭</text>
  <text x="263" y="193" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">E♭</text>
  <text x="311" y="193" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">B♭</text>
  <text x="359" y="193" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">F</text>
  <text x="455" y="193" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">G</text>
  <text x="503" y="193" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">D</text>
  <text x="90" y="193" font-family="-apple-system, Arial, sans-serif" font-size="13" font-weight="700" fill="#2d3748" text-anchor="end" dominant-baseline="central">Aeolian</text>
  <text x="726" y="193" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#8b949e" dominant-baseline="central">3♭</text>

  <!-- Phrygian：窗口 D♭ A♭ E♭ B♭ F C G -->
  <rect x="143" y="214" width="336" height="26" rx="4" fill="url(#winGrad)" stroke="#42b983" stroke-opacity="0.5"/>
  <rect x="383" y="214" width="48" height="26" rx="4" fill="#42b983"/>
  <text x="407" y="227" font-family="-apple-system, Arial, sans-serif" font-size="12" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">C</text>
  <text x="167" y="227" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">D♭</text>
  <text x="215" y="227" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">A♭</text>
  <text x="263" y="227" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">E♭</text>
  <text x="311" y="227" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">B♭</text>
  <text x="359" y="227" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">F</text>
  <text x="455" y="227" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">G</text>
  <text x="90" y="227" font-family="-apple-system, Arial, sans-serif" font-size="13" font-weight="700" fill="#2d3748" text-anchor="end" dominant-baseline="central">Phrygian</text>
  <text x="726" y="227" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#8b949e" dominant-baseline="central">4♭</text>

  <!-- Locrian：窗口 G♭ D♭ A♭ E♭ B♭ F C -->
  <rect x="95" y="248" width="336" height="26" rx="4" fill="url(#winGrad)" stroke="#42b983" stroke-opacity="0.5"/>
  <rect x="383" y="248" width="48" height="26" rx="4" fill="#42b983"/>
  <text x="407" y="261" font-family="-apple-system, Arial, sans-serif" font-size="12" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">C</text>
  <text x="119" y="261" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">G♭</text>
  <text x="167" y="261" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">D♭</text>
  <text x="215" y="261" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">A♭</text>
  <text x="263" y="261" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">E♭</text>
  <text x="311" y="261" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">B♭</text>
  <text x="359" y="261" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#2d3748" text-anchor="middle" dominant-baseline="central">F</text>
  <text x="90" y="261" font-family="-apple-system, Arial, sans-serif" font-size="13" font-weight="700" fill="#2d3748" text-anchor="end" dominant-baseline="central">Locrian</text>
  <text x="726" y="261" font-family="-apple-system, Arial, sans-serif" font-size="12" fill="#8b949e" dominant-baseline="central">5♭</text>

  <!-- 底部方向标注 -->
  <g font-family="-apple-system, Arial, sans-serif" font-size="12">
    <text x="95" y="305" fill="#667eea">◀ 加降号 · 变暗</text>
    <text x="719" y="305" fill="#42b983" text-anchor="end">加升号 · 变亮 ▶</text>
  </g>
</svg>

> 每一行是一个调式，绿色块是 7 音窗口，深色块是主音 C。可以清楚看到：窗口从左到右逐行「下滑」，主音 C 在窗口里的位置从最右（Locrian）逐步移到最左（Lydian）——这就是「窗口滑动」。

### 可交互演示

<div class="fifths-widget" id="fifths-widget">
  <div class="fw-keys"><span class="fw-keys-label">主音</span><span class="fw-keys-btns" id="fw-keys"></span></div>
  <div class="fw-title"><span id="fw-title">C Ionian</span><span id="fw-cn">伊奥尼亚</span></div>
  <div class="fw-meta">级数 <b id="fw-degree">Ⅰ</b>　｜　调号 <b id="fw-sig">0</b>　｜　对应 <b id="fw-parent">C 大调</b></div>
  <div class="fw-notes">组成音：<b id="fw-notes">C D E F G A B</b></div>
  <div class="fw-bright">亮度 <span class="fw-dots" id="fw-bright"></span><span class="fw-char">特征音 <b id="fw-char">—</b></span></div>
  <div class="fw-axis" id="fw-axis"></div>
  <div class="fw-controls"><button class="fw-btn" id="fw-left" type="button">◀ 更暗</button><button class="fw-btn" id="fw-right" type="button">更亮 ▶</button></div>
  <div class="fw-modes" id="fw-modes"></div>
</div>

<style>
.fifths-widget {
  --fw-main: var(--theme-color, #42b983);
  --fw-ink: var(--text-color, #1a1a1a);
  --fw-ink2: var(--text-color-secondary, #4a4a4a);
  --fw-ink3: var(--text-color-tertiary, #6a6a6a);
  --fw-bg: var(--bg-color-secondary, #f5f7f9);
  --fw-border: var(--border-color, #e0e4e8);
  --fw-active: var(--theme-color-bg-subtle, rgba(66,185,131,0.08));
  margin: 1.6em 0;
  padding: 18px 20px;
  border: 1px solid var(--fw-border);
  border-radius: 12px;
  background: var(--fw-bg);
  font-size: 14px;
  line-height: 1.7;
  color: var(--fw-ink);
}
.fifths-widget .fw-keys { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.fifths-widget .fw-keys-label { font-size: 13px; color: var(--fw-ink3); flex-shrink: 0; }
.fifths-widget .fw-keys-btns { display: flex; flex-wrap: wrap; gap: 4px; }
.fifths-widget .fw-key-btn { padding: 3px 9px; border: 1px solid var(--fw-border); background: transparent; color: var(--fw-ink); border-radius: 6px; cursor: pointer; font-size: 12px; transition: all .15s; }
.fifths-widget .fw-key-btn:hover { border-color: var(--fw-main); }
.fifths-widget .fw-key-btn.active { background: var(--fw-main); border-color: var(--fw-main); color: #fff; }
.fifths-widget .fw-title { font-size: 19px; font-weight: 700; }
.fifths-widget .fw-title span { font-weight: 400; font-size: 13px; color: var(--fw-ink2); margin-left: 6px; }
.fifths-widget .fw-meta { color: var(--fw-ink2); margin: 4px 0; }
.fifths-widget .fw-meta b { color: var(--fw-ink); }
.fifths-widget .fw-notes { color: var(--fw-ink2); }
.fifths-widget .fw-notes b { color: var(--fw-main); letter-spacing: 1px; }
.fifths-widget .fw-bright { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin: 6px 0 4px; color: var(--fw-ink2); }
.fifths-widget .fw-dots { display: inline-flex; gap: 3px; }
.fifths-widget .fw-dot { width: 14px; height: 14px; border-radius: 3px; border: 1px solid var(--fw-border); background: transparent; transition: background .15s; }
.fifths-widget .fw-dot.on { background: var(--fw-main); border-color: var(--fw-main); }
.fifths-widget .fw-char { color: var(--fw-ink3); }
.fifths-widget .fw-char b { color: var(--fw-ink); }
.fifths-widget .fw-axis { display: flex; margin: 14px 0 6px; }
.fifths-widget .fw-note { flex: 1; text-align: center; padding: 7px 0; border-radius: 5px; font-size: 13px; color: var(--fw-ink3); transition: background .15s, color .15s; }
.fifths-widget .fw-note.in-window { color: var(--fw-ink); font-weight: 600; background: var(--fw-active); }
.fifths-widget .fw-note.tonic { background: var(--fw-main); color: #fff; font-weight: 700; }
.fifths-widget .fw-controls { display: flex; gap: 10px; margin: 6px 0; }
.fifths-widget .fw-btn { flex: 1; padding: 8px 0; border: 1px solid var(--fw-border); background: var(--fw-bg); color: var(--fw-ink); border-radius: 8px; cursor: pointer; font-size: 13px; transition: all .15s; }
.fifths-widget .fw-btn:hover { border-color: var(--fw-main); color: var(--fw-main); }
.fifths-widget .fw-modes { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.fifths-widget .fw-mode-btn { padding: 5px 12px; border: 1px solid var(--fw-border); background: transparent; color: var(--fw-ink); border-radius: 20px; cursor: pointer; font-size: 13px; transition: all .15s; }
.fifths-widget .fw-mode-btn:hover { border-color: var(--fw-main); }
.fifths-widget .fw-mode-btn.active { background: var(--fw-main); border-color: var(--fw-main); color: #fff; }
.fifths-widget .fw-mode-btn small { opacity: .75; font-size: 11px; }
@media (max-width: 768px) {
  .fifths-widget { padding: 14px 12px; }
  .fifths-widget .fw-note { font-size: 11px; padding: 6px 0; }
}
</style>

### 小结

1. **滑动规则**：窗口右移 = 加升号 = 变亮；左移 = 加降号 = 变暗。七个调式正好落在「1 升 → 5 降」的连续 7 个调号上。
2. **升降号与亮度**：升号越多越亮（Lydian 最亮），降号越多越暗（Locrian 最暗）——这就是调式的「明暗光谱」。
3. **平行 vs 关系调式**：上面讲的是**平行调式**（同一主音 C 换调式 = 窗口滑动）；而「同一组音换主音」（如 C 大调音阶从 D 开始 = D Dorian）叫**关系调式**，那是「同一窗口换起点」。两者一个横着滑、一个竖着数，合起来才是调式的完整图景。
4. **一个例外**：Locrian 降了 5 音，主和弦是减三和弦，调性立不住，实际音乐中几乎不当主调式用，只短暂借用。
