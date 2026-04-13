# AlphaTex 吉他编谱实战指南
> 基于 https://alphatab.net/docs/alphatex/introduction 深度研究
> 面向吉他手的高效编谱姿势手册

---

## 📌 快速入门：60秒写出第一段 TAB

```atex
\title "我的第一首曲"
\tempo 120

\track "Guitar"
\staff {tabs}
\tuning (E4 B3 G3 D3 A2 E2)

// 4/4拍，从这里开始
:4 0.3 2.3 4.3 5.3 | 5.3 4.3 2.3 0.3
```

运行规则：**品位.弦号**，弦1=高e弦，弦6=低E弦。就这一条记住，其他都是附加功能。

---

## 一、语法核心速查

### 1.1 基本结构模板

```atex
/* === 文件头：乐曲信息 === */
\title "曲名"
\artist "艺术家"
\album "专辑"
\music "作曲者"
\words "作词者"
\tempo 90                    // BPM速度

/* === 音轨与谱表 === */
\track "Guitar"
\staff {tabs}                // 仅TAB谱（推荐）
// \staff {score}            // 仅五线谱
// \staff {mixed}            // TAB+五线谱组合
\tuning (E4 B3 G3 D3 A2 E2) // 标准调弦
// \capo 2                   // 加变调夹在第2品

/* === 乐谱正文 === */
// 每个小节用 | 结束（最后一节可省略）
:4 0.3 2.3 4.3 5.3 |
:8 0.1 2.1 3.1 5.1 5.1 3.1 2.1 0.1 |
```

### 1.2 音符语法：`品位.弦号`

```
弦号定义（标准调弦）：
  弦1 = 高e弦（E4，最细）
  弦2 = B弦（B3）
  弦3 = G弦（G3）
  弦4 = D弦（D3）
  弦5 = A弦（A2）
  弦6 = 低E弦（E2，最粗）

示例：
  0.1   → 1弦空弦（E4）
  5.2   → 2弦第5品（E4，高一个八度）
  x.3   → 闷音/死音（G弦）
  -.3   → 延音（与上一个同弦音符连接）
```

### 1.3 时值系统

```atex
// 全局时值切换（冒号）
:1    // 全音符
:2    // 二分音符
:4    // 四分音符（常用默认）
:8    // 八分音符
:16   // 十六分音符
:32   // 三十二分音符

// 单音符附加时值（在音符后加 .时值）
5.3.4    // G弦5品，四分音符
5.3.8    // G弦5品，八分音符

// 附点（延长时值1.5倍）
5.3 { d }    // 附点四分音符
5.3 { dd }   // 双附点

// 连音符（延长到下一个同弦音）
5.3 -.3      // 二分 + 延长
```

### 1.4 休止符

休止符用 `r` 替代品位.弦号，表示静默对应时长：

```atex
// 基本休止符
r.1       // 全休止符（静默一整小节）
r.2       // 二分休止符（静默两拍）
r.4       // 四分休止符（静默一拍）
r.8       // 八分休止符（静默半拍）
r.16      // 十六分休止符
r.32      // 三十二分休止符

// 附点休止符（1.5 倍时值）
r.4 { d }       // 附点四分休止符（1.5拍）
r.4 { dd }      // 双附点四分休止符（1.75拍）
```

**实际应用示例：**

```atex
// 4/4拍 "弹弹停弹" 节奏
:4 3.3 5.3 r 3.3 |

// 前奏休止一小节再进
:4 r * 4 | 0.3 2.3 4.3 5.3 |

// 小节末尾休止
:8 3.3 5.3 3.3 5.3 r r r r |
```

> **提示**：休止符同样受全局时值 `:` 控制，如果当前时值为 `:8`，直接写 `r` 就是八分休止符。

### 1.5 延音线

延音线（Tie）将两个**相同音高**的音符连接，第二个音不重新发声，而是延续第一个音的时值。

**三种等价写法：**

```atex
// 方法1：用 - 替代品位（最简洁，推荐吉他谱使用）
:2 5.3 -.3 |              // G弦5品延续到下一拍

// 方法2：音符效果 {-}
:2 5.3 5.3{-} |           // 效果完全相同

// 方法3：音符效果 {t}
:2 5.3 5.3{t} |           // t = tie 缩写
```

**和弦中的延音线（精确控制某根弦延续）：**

```atex
// 只有3弦延续，4弦重新发声
:2 (5.3 3.4) (-.3 5.4) |

// 只有4弦延续，3弦重新弹奏
:2 (5.3 3.4) (5.3 -.4) |
```

**跨小节延音：**

```atex
// 5品的音延续到下一小节第一拍
:4 5.3 5.3 5.3 5.3 | -.3 r r r |
```

**非弦乐器（钢琴/键盘）的延音线：**

```atex
// 非弦乐器没有"弦号"来确定延音对象，需用音高匹配规则
:2 a4 - |                   // 前一拍只有一个音时，直接用 -

// 和弦中需显式指定哪个音延续
:2 (a4 a3) (a4{t} a3) |    // 第一个音延续，第二个重弹
:2 (a4 a3) (- a3) |        // 同上，更简洁写法
```

> **注意**：延音线不同于击弦（hammer-on），前者连接**相同音高**（不重新发声），后者连接**不同音高**（左手击弦发声）。

### 1.6 常用快捷写法

```atex
// 重复同一节拍 N 次（乘法器）
(0.1 2.2 2.3 2.4 0.5) * 4    // Am和弦弹4次

// 节拍倍增：不用重复打字，一次搞定
:8 3.3 * 8    // 同一个音弹8个八分音符
```

---

## 二、常见调弦模板

```atex
// 标准调弦（Standard E）
\tuning (E4 B3 G3 D3 A2 E2)

// 降音调弦（Drop D）
\tuning (E4 B3 G3 D3 A2 D2)

// 降半音（Eb）
\tuning (Eb4 Bb3 Gb3 Db3 Ab2 Eb2)

// 降一个全音（D Standard）
\tuning (D4 A3 F3 C3 G2 D2)

// Open G（开放G调弦）
\tuning (D4 B3 G3 D3 G2 D2)

// DADGAD
\tuning (D4 A3 G3 D3 A2 D2)

// 7弦吉他标准调弦
\tuning (E4 B3 G3 D3 A2 E2 B1)
```

---

## 三、和弦图完整使用

### 3.1 定义和弦图

```atex
// 格式：\chord ("名称" 1弦品位 2弦品位 3弦 4弦 5弦 6弦)
// x = 不弹  0 = 空弦

// 基础开放和弦
\chord ("E"  0 0 1 2 2 0)
\chord ("Em" 0 0 0 2 2 0)
\chord ("A"  0 2 2 2 0 x)
\chord ("Am" 0 1 2 2 0 x)
\chord ("D"  2 3 2 0 x x)
\chord ("Dm" 1 3 2 0 x x)
\chord ("C"  0 1 0 2 3 x)
\chord ("G"  3 0 0 0 2 3)

// 高把位和弦（需要设置起始品位）
\chord ("F"  1 1 2 3 3 1) { barre 1 }
\chord ("Bm" 2 3 4 4 2 x) { barre 2 firstfret 2 }
\chord ("D#" 6 8 8 8 6 x) { firstfret 6 }

// 不显示和弦图名称（只显示指法）
\chord ("X" 3 3 3 1 1 1) { showname false barre (1 3) }
```

### 3.2 使用和弦图

```atex
// 弹奏时显示和弦图，音符还是要单独写
\chord ("Am" 0 1 2 2 0 x)
\chord ("G"  3 0 0 0 2 3)

(0.1 1.2 2.3 2.4 0.5) { ch "Am" }    // 触发Am和弦图
(3.1 0.2 0.3 0.4 2.5 3.6) { ch "G" } // 触发G和弦图
```

### 3.3 和弦图内联显示（chordDiagramsInScore）

默认情况下，`\chord` 定义的**指法图**集中显示在乐谱头部（Header 区域），而 `{ ch "Am" }` 只会在小节上方显示和弦**名称**文字。

通过 `\chordDiagramsInScore` 指令，可以让和弦指法图**内联显示在 `{ ch }` 引用的小节上方**，方便读谱者在演奏位置直接看到指法图。

**语法：**

```atex
// 在 Score 元数据区（文件头）开启
\chordDiagramsInScore           // 默认 true，开启内联和弦图
\chordDiagramsInScore true      // 显式开启
\chordDiagramsInScore false     // 关闭（回到默认的头部集中显示）
```

**完整示例：**

```atex
\title "和弦图内联演示"

// 1. 开启内联和弦图显示
\chordDiagramsInScore

// 2. 定义和弦
\chord ("E"  0 0 1 2 2 0)
\chord ("Am" 0 1 2 2 0 x)
\chord ("C"  0 1 0 2 3 x)
\chord ("G"  3 0 0 0 2 3)

\track "Guitar"
\staff {tabs}
\tuning (E4 B3 G3 D3 A2 E2)

// 3. 在演奏位置用 { ch } 引用 → 和弦指法图直接显示在该小节上方
:4
(0.1 0.2 1.3 2.4 2.5 0.6) { ch "E" } * 2 |
(0.1 1.2 2.3 2.4 0.5) { ch "Am" } * 2 |
(0.1 1.2 0.3 2.4 3.5) { ch "C" } * 2 |
(3.1 0.2 0.3 0.4 2.5 3.6) { ch "G" } * 2 |
```

> **效果对比**：
> - **不加** `\chordDiagramsInScore`：指法图集中在乐谱头部，`{ ch "E" }` 处只显示 "E" 文字
> - **加上** `\chordDiagramsInScore`：指法图直接出现在 `{ ch "E" }` 所在小节的上方，方便边弹边看

### 3.4 和弦图属性控制

除了内联显示，还可以精细控制每个和弦图的显示属性：

**定义时控制显示属性：**

```atex
// showDiagram: 控制是否显示指法图
\chord ("Am" 0 1 2 2 0 x)                          // 默认：显示指法图 + 名称
\chord ("Am/E" 0 1 2 2 0 0) { showDiagram false }  // 只显示名称，不显示指法图

// showName: 控制是否显示和弦名称
\chord ("X"  3 3 3 1 1 1) { showName false }       // 只显示指法图，不显示名称

// showFingering: 控制是否显示手指编号
\chord ("C" 0 1 0 2 3 x) { showFingering false }   // 不显示手指编号

// firstFret: 设置起始品位（高把位和弦）
\chord ("Bm" 2 3 4 4 2 x) { firstFret 2 }         // 指法图从第2品开始显示

// 组合使用
\chord ("F"  1 1 2 3 3 1) { barre 1 firstFret 1 showName true }
\chord ("D#" 6 8 8 8 6 x) { barre 6 firstFret 6 showFingering false }
```

**API 层面全局控制（JavaScript/C#/Kotlin）：**

alphaTab 中和弦相关的显示由 3 个独立的 `NotationElement` 控制：

| 枚举名 | 值 | 控制内容 |
|--------|---|---------|
| `ChordDiagrams` | 10 | 乐谱头部的和弦指法图 |
| `EffectChordNames` | 16 | 小节上方的和弦名称文字 |
| `ChordDiagramFretboardNumbers` | 52 | 指法图内的品位数字 |

```javascript
// 初始化时配置
const api = new alphaTab.AlphaTabApi(element, {
  notation: {
    elements: {
      chordDiagrams: true,                  // 头部指法图
      effectChordNames: true,               // 小节上方和弦名称
      chordDiagramFretboardNumbers: true    // 指法图内品位数字
    }
  }
});

// 运行时动态开关
api.settings.notation.elements.set(
  alphaTab.NotationElement.ChordDiagrams, false
);
api.updateSettings();
api.render();
```

---

## 四、调号与拍号

### 4.1 常用调号

```atex
// 大调
\ks C      // C大调（无升降号）
\ks G      // G大调（1个升号）
\ks D      // D大调（2个升号）
\ks A      // A大调（3个升号）
\ks E      // E大调（4个升号）
\ks F      // F大调（1个降号）
\ks Bb     // 降B大调（2个降号）
\ks Eb     // 降E大调（3个降号）

// 小调
\ks Aminor  // A小调
\ks Eminor  // E小调
\ks Bminor  // B小调
\ks Dminor  // D小调
```

### 4.2 拍号

```atex
\ts (4 4)      // 4/4 拍（最常见）
\ts (3 4)      // 3/4 拍（华尔兹）
\ts (6 8)      // 6/8 拍
\ts (2 4)      // 2/4 拍
\ts common     // 等同于 4/4
\ts (7 8)      // 7/8（复杂拍号）
\ts (5 4)      // 5/4
```

---

## 五、演奏技法效果（完整速查表）

### 5.1 Note 级别效果（加在单个音符后）

```atex
// 连奏技法
5.3 { h }      // 击弦 hammer-on / 勾弦 pull-off（自动判断）
5.3 { lht }    // 左手敲弦 left-hand tap

// 滑音
5.3 { sl }     // 连奏滑音 legato slide（音保留）
5.3 { ss }     // 换把滑音 shift slide（音截断）
5.3 { sib }    // 从下方滑入 slide in from below
5.3 { sia }    // 从上方滑入 slide in from above
5.3 { sou }    // 向上滑出 slide out upwards
5.3 { sod }    // 向下滑出 slide out downwards
x.3 { psu }    // Pick 上滑
x.3 { psd }    // Pick 下滑

// 推弦 Bend（值单位：quarter-tone，4 = 全音推，2 = 半音推）
5.3 { b (0 4) }         // 推到全音
5.3 { b (0 2) }         // 推到半音
5.3 { b (0 4 0) }       // 推弦+放回
5.3 { b (0 4 4 0) }     // 推弦+保持+放回
5.3 { b prebend (0 4) } // 预先推弦

// 颤音
5.3 { v }     // 轻微颤音 vibrato
5.3 { vw }    // 宽颤音 wide vibrato

// 泛音
5.3 { nh }    // 自然泛音 natural harmonic
5.3 { ah }    // 人工泛音 artificial harmonic
5.3 { ph }    // 捏泛音 pinch harmonic
5.3 { th }    // 敲泛音 tapped harmonic

// 特殊音符类型
5.3 { g }     // 幽灵音 ghost note（括号括起来的音）
5.3 { x }     // 闷音 dead note（也可直接写 x.3）
5.3 { t }     // 延音线（与前一个同弦音符连接）

// 装饰音
5.3 { turn }     // 回音
5.3 { iturn }    // 倒回音
5.3 { umordent } // 上波音
5.3 { lmordent } // 下波音

// 指法标注
5.3 { lf 2 }   // 左手食指（1=拇指，2=食指，3=中指，4=无名指，5=小指）
5.3 { rf 1 }   // 右手拇指

// 连音线
(3.3 {slur s1} 4.4).4  10.3 {slur s1}   // 用ID标记开始和结束
```

### 5.2 Beat 级别效果（加在整个节拍后）

```atex
// 扫弦/拨弦方向
(0.1 0.2 0.3 2.4 2.5 0.6) { su }   // 向上扫弦 ↑
(0.1 0.2 0.3 2.4 2.5 0.6) { sd }   // 向下扫弦 ↓
5.3 { bu }   // 刷弦向上（brush up）
5.3 { bd }   // 刷弦向下（brush down）

// 渐强渐弱
5.3 { cre }   // 渐强 crescendo <
5.3 { dec }   // 渐弱 decrescendo >

// 淡入淡出
5.3 { f }     // 淡入 fade-in
5.3 { fo }    // 淡出 fade-out
5.3 { vs }    // 音量涌动 volume swell

// 颤音（全和弦级别）
(0.1 0.2 0.3) { v }   // 和弦颤音
(0.1 0.2 0.3) { vw }  // 和弦宽颤音

// 文字标注（显示在谱子上方）
5.3 { txt "Solo" }
r.2 { txt "Pause" }

// 连奏
5.3.4 { legatoOrigin } 10.3.4   // 从这个音连奏到下一个

// 震音
5.3 { tp 8 }    // 8分音符震音
5.3 { tp 16 }   // 16分音符震音

// Bass 技法
5.5 { s }    // Bass 打弦 slap
5.5 { p }    // Bass 勾弦 pop
5.5 { tt }   // 吉他/Bass tapping

// 连音符（连续N个音合为一组）
:4 { tu 3 }   // 三连音（3个音占2拍位置）
:8 { tu 5 }   // 五连音
:4 { tu (3 2) }   // 3音占2拍的连音

// 和弦标注（调用已定义的和弦图）
(0.1 1.2 2.3 2.4 0.5) { ch "Am" }
```

---

## 六、小节结构控制

### 6.1 重复记号

```atex
// 反复括号
\ro 0.3 2.3 4.3 5.3 |     // 开始反复 \ro = repeat open
5.3 4.3 2.3 0.3 |
\rc 2 0.3 2.3 4.3 5.3     // 结束反复，演奏2次 \rc = repeat close

// 多重结尾（1、2、3次结尾不同）
\ro 3.3*4 |
\ae (1 2) 5.3 6.3 7.3 8.3 |   // 前两次演奏这小节
\ae 3 9.3 10.3 11.3 12.3       // 第三次演奏这小节
```

### 6.2 段落标记

```atex
\section "Intro"         // 段落标记（只显示文字）
3.3*4 | 4.3*4 |

\section "V" "Verse"    // 段落标记（字母+文字）
5.3*4 |

\section "C" "Chorus"
7.3*4 |
```

### 6.3 跳奏指令（D.C. / D.S. / Fine）

```atex
\jump DaCapo              // D.C. 从头再来
\jump DaCapoAlFine        // D.C. al Fine
\jump Segno               // Segno 标记 §
\jump DalSegno            // D.S. 从 § 处再来
\jump DalSegnoAlCoda      // D.S. al Coda
\jump Coda                // Coda 标记
\jump Fine                // Fine 结束
```

### 6.4 速度变化

```atex
// 在小节开头设置速度
\tempo 120 3.3 2.3 | 
\tempo (80 "Slow Down") 3.3 * 4 |

// 小节内某个节拍改变速度（隐藏显示）
\tempo (60 "" 0.5 hide)   // 在本小节50%位置处开始60BPM，不显示
```

### 6.5 节拍律动（Swing）

```atex
\tf none         // 正常律动
\tf triplet8th   // 三连音摇摆（爵士常用）
\tf dotted8th    // 附点八分摇摆
\tf triplet16th  // 16分三连音摇摆
\tf scottish8th  // 苏格兰风格
```

---

## 七、多音轨与编制

### 7.1 多音轨写法

```atex
\title "二重奏"

\track "Guitar 1"
\staff {tabs}
\tuning (E4 B3 G3 D3 A2 E2)
:4 0.3 2.3 4.3 5.3 |
5.3 4.3 2.3 0.3

\track "Guitar 2"
\staff {tabs}
\tuning (E4 B3 G3 D3 A2 E2)
:4 7.4 9.4 7.4 5.4 |
5.4 7.4 9.4 7.4
```

### 7.2 五线谱 + TAB 双行

```atex
\track "Guitar"
\staff {score}         // 第一谱表：五线谱
:4 0.3 2.3 4.3 5.3 |

\staff {tabs}          // 第二谱表：TAB谱
:4 0.3 2.3 4.3 5.3 |  // 相同的音符在两个谱表同步显示
```

### 7.3 双声部写法

```atex
\track "Guitar"
\staff {tabs}
\voice           // 声部1（旋律）
:4 0.1 2.1 3.1 5.1 |

\voice           // 声部2（低音/节奏）
:4 2.6 0.5 3.5 2.5 |
```

### 7.4 每行显示几个小节

```atex
\track "Guitar" { systemsLayout (2 3 2) }   // 第1行2小节，第2行3小节，第3行2小节
\track "Guitar" { defaultSystemsLayout 4 }  // 默认每行4小节
```

### 7.5 简谱谱表

alphaTab 从 **v1.4.0** 开始支持简谱（Numbered Notation / 简谱），使用数字 1-7 表示 do-re-mi-fa-sol-la-si，在亚洲地区广泛使用。

```atex
// 方法1: TAB + 简谱 双行显示（推荐吉他手使用）
\track "Guitar"
\staff {tabs}                    // 第一谱表：TAB 谱
\tuning (E4 B3 G3 D3 A2 E2)
:4 0.3 2.3 4.3 5.3 |

\staff {numbered}                // 第二谱表：简谱
\tuning piano
:4 0.3 2.3 4.3 5.3 |            // 相同的音符，渲染为数字简谱
```

```atex
// 方法2: 仅简谱显示（适合键盘/教学场景）
\track "Piano"
\staff {numbered}
\tuning piano
:4 c4 d4 e4 f4 | g4 a4 b4 c5 |
```

```atex
// 方法3: 五线谱 + 简谱 组合
\track "Melody"
\staff {score}                   // 五线谱
\tuning piano
:4 c4 d4 e4 f4 |

\staff {numbered}                // 简谱（音高数据自动映射为 1234567）
\tuning piano
:4 c4 d4 e4 f4 |
```

```atex
// 方法4: 五线谱 + TAB + 简谱 三行组合
\track "Guitar"
\staff {score tabs}              // 五线谱 + TAB
\tuning (E4 B3 G3 D3 A2 E2)
:4 0.3 2.3 4.3 5.3 |

\staff {numbered}                // 简谱（第三行）
\tuning piano
:4 0.3 2.3 4.3 5.3 |
```

**简谱规则：**
- 数字 1-7 分别对应 do、re、mi、fa、sol、la、si
- 高八度在数字上方加点，低八度在下方加点
- 升降号用 `#`（升）和 `b`（降）表示，如 `#4` = Fa#
- 需要 alphaTab >= **1.4.0** 版本支持

> **提示**：简谱谱表中的音符数据与标准谱表共享，alphaTab 会自动将音高映射为简谱数字。在同一音轨中创建多个 `\staff`，可以让同一份音符数据以不同谱表类型同时展示。

### 7.6 简谱延时线（Duration Dash）

简谱中，当一个音符的时值**超过一拍**（即长于四分音符）时，后续拍位用 **`-`** 表示延续。这个 `-` 是**渲染器自动生成**的，不需要在 AlphaTex 中手动编写。

**启用条件：**
1. 使用 `\staff {numbered}` 开启简谱模式
2. 音符时值 ≥ 二分音符（`:2`、`:1` 等）

**完整示例：**

```atex
\title "简谱延时线演示"
\staff {numbered}
\tuning piano
\ts 4 4
\tempo 80
.
:2 C4 D4 |
:1 E4 |
:2 F4 :4 G4 A4 |
:2 C5{d} :4 B4 |
```

渲染后的简谱效果：

```
第1小节:  1 -  2 -        ← 两个二分音符，各占两拍
第2小节:  3 -  - -        ← 一个全音符，占满四拍
第3小节:  4 -  5  6       ← 二分音符 + 两个四分音符
第4小节:  1̇ -  - 7        ← 附点二分音符(三拍) + 四分音符
```

**与 Tie（连音线）的区别：**

简谱中有两种不同的 `-` 概念，**不要混淆**：

| 概念 | AlphaTex 语法 | 简谱显示 | 说明 |
|------|--------------|---------|------|
| 延时线（Duration Dash） | `:2 C4` | `1 -` | 同一音符时值延续，**渲染器自动生成** |
| 连音线（Tie） | `:4 C4 C4{t}` | `1 ⌒ 1` | 两个相同音符用弧线连接 |

> **关键区别**：AlphaTex 中的 `-` 字符（如 `-.2`）是吉他谱的 **tie（连音）** 语法，不是简谱的延时线。简谱的延时线 `-` 是渲染器根据音符时值**自动生成**的，无需手动编写。

**总结：** 你不需要在 AlphaTex 中手动写 `-` 来实现简谱延时线。只需用 `\staff {numbered}` 开启简谱模式，正常写长时值音符（如 `:2 C4`、`:1 E4`），渲染器会自动在多余的拍位上画 `-`。

---

## 八、歌词绑定

```atex
\title "小星星"
\track "Guitar"
\staff {tabs}
\tuning (E4 B3 G3 D3 A2 E2)
\lyrics "一 闪 一 闪 亮 晶 晶 满 天 都 是 小 星 星"

:4 0.3 0.3 7.4 7.4 | 9.4 9.4 7.4 r | 5.4 5.4 4.4 4.4 | 2.4 2.4 0.4 r
```

歌词规则：
- 空格分隔每个音节
- `+` 合并多个音节到同一节拍（如：`走+路`）
- `[注释]` 括号内内容不显示

---

## 九、实战谱例

### 9.1 小星星（C大调，开放把位）

```atex
\title "小星星"
\artist "传统童谣"
\tempo 100

\chord ("C" 0 1 0 2 3 x)
\chord ("G7" 1 1 2 0 2 3)
\chord ("F" 1 1 2 3 3 1) { barre 1 }

\track "Guitar"
\staff {tabs}
\tuning (E4 B3 G3 D3 A2 E2)
\ks C

\section "Verse"
:4 0.3 0.3 7.4 7.4 |     // do do so so（C和弦区域）
9.4 9.4 7.4 r |            // la la so -
5.4 5.4 4.4 4.4 |          // fa fa mi mi
2.4 2.4 0.4 r |            // re re do -
7.4 7.4 5.4 5.4 |          // so so fa fa
4.4 4.4 2.4 r |            // mi mi re -
7.4 7.4 5.4 5.4 |          // so so fa fa
4.4 4.4 2.4 r |            // mi mi re -
0.3 0.3 7.4 7.4 |          // do do so so
9.4 9.4 7.4 r |            // la la so -
5.4 5.4 4.4 4.4 |          // fa fa mi mi
2.4 2.4 0.4 r              // re re do -
```

### 9.2 天空之城（G大调，指弹）

```atex
\title "天空之城"
\artist "久石让"
\tempo 80

\chord ("G"  3 0 0 0 2 3)
\chord ("Em" 0 0 0 2 2 0)
\chord ("Am" 0 1 2 2 0 x)
\chord ("D"  2 3 2 0 x x)
\chord ("C"  0 1 0 2 3 x)

\track "Guitar"
\staff {tabs}
\tuning (E4 B3 G3 D3 A2 E2)
\ks G

\section "Intro"
:8
// G - Em - Am - D 和弦进行
3.2 3.2 0.1 0.1 |
3.3 0.3 2.4 2.4 |
```

### 9.3 推弦+颤音 Blues Lick

```atex
\title "Blues Lick"
\tempo 120

\track "Guitar"
\staff {tabs}
\tuning (E4 B3 G3 D3 A2 E2)

\section "Lick 1"
:8
8.1 { sib } 8.1 |                       // 从下方滑入
10.1 { b (0 4) } -.1 |                  // 全音推弦+保持
10.1 { b (0 4 0) } 8.1 { h } 10.1 |    // 推+放+击弦
8.1 { v } 6.1 |                         // 颤音+下行

\section "Lick 2"
:16
10.1 { h } 8.1 { h } 6.1 10.2 8.2 6.2 10.3 8.3 |  // 扫把
6.1 { vw } * 4                                       // 宽颤音重复
```

### 9.4 指弹分解和弦（Fingerpicking Pattern）

```atex
\title "指弹练习"
\tempo 80

\chord ("Am" 0 1 2 2 0 x)
\chord ("G"  3 0 0 0 2 3)
\chord ("C"  0 1 0 2 3 x)
\chord ("E"  0 0 1 2 2 0)

\track "Guitar"
\staff {tabs}
\tuning (E4 B3 G3 D3 A2 E2)

// 每拍分解：6弦(拇指)-3弦-2弦-1弦 循环
:8
// Am和弦
0.5 { sd } 2.3 1.2 0.1 2.3 1.2 |      // 拆分Am
// G和弦
3.6 { sd } 0.3 0.2 3.1 0.3 0.2 |      // 拆分G
// C和弦
3.5 { sd } 0.3 1.2 0.1 0.3 1.2 |      // 拆分C
// E和弦
0.6 { sd } 1.3 0.2 0.1 1.3 0.2        // 拆分E
```

### 9.5 摇滚节奏 Power Chord + 扫弦

```atex
\title "Power Chord Riff"
\tempo 130

\track "Guitar"
\staff {tabs}
\tuning (E4 B3 G3 D3 A2 D2)   // Drop D 调弦

\ks D

\section "Riff"
:8
(0.6 0.5 2.4) { sd } (0.6 0.5 2.4) { sd } (3.6 3.5 5.4) { sd } (3.6 3.5 5.4) { sd } |
(5.6 5.5 7.4) { sd } (5.6 5.5 7.4) { su } r.4 (3.6 3.5 5.4) { sd sd }
```

---

## 十、编谱效率技巧

### 10.1 善用乘法器减少重复输入

```atex
// ❌ 效率低的写法
:4 0.3 | 0.3 | 0.3 | 0.3

// ✅ 高效写法
:4 0.3 * 4      // 重复4个相同小节

// 和弦也一样
(0.1 2.2 2.3 2.4 0.5) { ch "Am" } * 2   // Am和弦弹2次
```

### 10.2 利用时值记忆减少 `:` 切换

```atex
// alphaTex 会记住上一个时值
:8                     // 从这里起默认八分音符
3.3 4.3 5.3 4.3 |     // 全是八分
3.3.4 4.3 5.3 |       // 第一个音换四分，但后面的又回到八分（历史设计，注意）
```

### 10.3 注释组织段落结构

```atex
// ===== INTRO (4 bars) =====
\section "Intro"
...

// ===== VERSE (8 bars) =====
\section "Verse"
...

// ===== CHORUS (8 bars) =====
\section "Chorus"
...
```

### 10.4 利用 `\ro` / `\rc` 避免重复写相同段落

```atex
// 主歌重复2次
\section "Verse"
\ro 
3.3*4 | 5.3*4 | 4.3*4 | 2.3*4 |
\rc 2

// 副歌前不同结尾
\ro
3.3*4 |
\ae 1 5.3*4 |    // 第一次结尾
\ae 2 7.3*4      // 第二次结尾（进副歌）
```

### 10.5 预定义常用和弦（文件开头一次性写好）

```atex
// 文件开头定义所有和弦
\chord ("Em" 0 0 0 2 2 0)
\chord ("Am" 0 1 2 2 0 x)
\chord ("C"  0 1 0 2 3 x)
\chord ("G"  3 0 0 0 2 3)
\chord ("D"  2 3 2 0 x x)
\chord ("F"  1 1 2 3 3 1) { barre 1 }
\chord ("B7" 2 0 2 1 2 x)

// 之后正文中随时用
```

---

## 十一、效果缩写一览表

### Note 级别效果

| 缩写 | 全名 | 说明 |
|------|------|------|
| `h`  | hammer-on/pull-off | 击弦/勾弦（自动判断） |
| `sl` | legato slide | 连奏滑音 |
| `ss` | shift slide | 换把滑音 |
| `sib` | slide in from below | 从下方滑入 |
| `sia` | slide in from above | 从上方滑入 |
| `sou` | slide out upwards | 向上滑出 |
| `sod` | slide out downwards | 向下滑出 |
| `b`  | bend | 推弦 `{ b (0 4) }` |
| `v`  | vibrato | 轻微颤音 |
| `vw` | wide vibrato | 宽颤音 |
| `nh` | natural harmonic | 自然泛音 |
| `ah` | artificial harmonic | 人工泛音 |
| `ph` | pinch harmonic | 捏泛音 |
| `g`  | ghost note | 幽灵音 |
| `x`  | dead note | 闷音 |
| `t` 或 `-` | tie | 延音线 |
| `lf N` | left finger | 左手指法（1~5） |
| `rf N` | right finger | 右手指法（1~5） |

### Beat 级别效果

| 缩写 | 全名 | 说明 |
|------|------|------|
| `su` | strum up | 向上扫弦 ↑ |
| `sd` | strum down | 向下扫弦 ↓ |
| `cre` | crescendo | 渐强 |
| `dec` | decrescendo | 渐弱 |
| `f`  | fade in | 淡入 |
| `fo` | fade out | 淡出 |
| `vs` | volume swell | 音量涌动 |
| `d`  | dot | 附点 |
| `dd` | double dot | 双附点 |
| `v`  | vibrato | Beat 级颤音 |
| `vw` | wide vibrato | Beat 级宽颤音 |
| `tp N` | tremolo picking | 震音 (8/16/32分) |
| `tu N` | tuplet | N连音 |
| `ch "名称"` | chord | 显示和弦图 |
| `txt "文字"` | text | 文字标注 |
| `s`  | slap | Bass打弦 |
| `p`  | pop | Bass勾弦 |
| `tt` | tapping | 敲弦 |

### 小节级别标签

| 标签 | 说明 |
|------|------|
| `\ts (4 4)` | 拍号 |
| `\ks G` | 调号 |
| `\tempo 120` | 速度 |
| `\ro` | 开始反复 |
| `\rc N` | 结束反复（N次） |
| `\ae (1 2)` | 多重结尾 |
| `\section "名"` | 段落标记 |
| `\tf triplet8th` | 摇摆律动 |
| `\ac` | 弱起小节 |
| `\ft` | 自由时值小节 |
| `\simile simple` | 重复上一小节 |

---

## 十二、文件完整模板

```atex
/* =====================================================
   模板：流行吉他独奏谱
   ===================================================== */

// 曲谱信息
\title "曲名"
\subtitle "副标题"
\artist "艺术家"
\album "专辑"
\music "作曲"
\words "作词"
\tempo 120

// 预定义所有和弦图
\chord ("C"  0 1 0 2 3 x)
\chord ("Am" 0 1 2 2 0 x)
\chord ("F"  1 1 2 3 3 1) { barre 1 }
\chord ("G"  3 0 0 0 2 3)

// 音轨设置
\track "Guitar"
\staff {tabs}
\tuning (E4 B3 G3 D3 A2 E2)   // 标准调弦
// \capo 2                     // 变调夹
\ks C                           // C大调
\lyrics "歌 词 写 在 这 里"    // 可选歌词

// ===== Intro =====
\section "Intro"
\ts (4 4)
:4 r * 4 |

// ===== Verse =====
\section "V" "Verse"
:8 0.3 2.3 3.3 5.3 5.3 3.3 2.3 0.3 |

// ===== Chorus =====
\section "C" "Chorus"
(0.1 1.2 0.3 2.4 3.5) { ch "C" su } r.8 0.1 2.1 | 

// ===== Outro =====
\section "Outro"
:2 0.3 { v } -.3
```

---

*文档由 @clawbot 整理 | 基于 alphatab.net 官方文档 | 2026-03-16*
