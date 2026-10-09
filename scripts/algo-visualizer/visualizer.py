"""算法动画可视化核心管线。

职责：
1. 提供统一视觉规范（颜色、字体）与通用绘图基础能力（节点、箭头）。
2. 提供 GIF 导出能力。
3. 与具体算法解耦：具体算法只需产出「状态快照序列」，渲染与导出完全复用。

设计原则：
- DRY：绘图基础能力集中于此，避免每个算法各写一份绘图代码。
- 高内聚低耦合：本文件只关心「画图与导出」，不感知任何具体算法 / 数据结构。
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import List, Optional, Sequence, Tuple

from PIL import Image, ImageDraw, ImageFont

# ---- 统一视觉规范 ----
BG = "#ffffff"
NODE_FILL = "#eef2f7"
NODE_BORDER = "#475569"
TEXT = "#0f172a"
ARROW = "#94a3b8"
NIL_BORDER = "#cbd5e1"
NIL_TEXT = "#64748b"

PREV_COLOR = "#2563eb"  # 蓝
CURR_COLOR = "#ea580c"  # 橙
NEXT_COLOR = "#16a34a"  # 绿

Point = Tuple[int, int]

_FONT_CACHE = {}


def load_font(size: int) -> ImageFont.ImageFont:
    """加载字体：优先系统字体，失败回退默认位图字体。"""
    if size in _FONT_CACHE:
        return _FONT_CACHE[size]
    # 优先中文字体（标题含中英混排），缺失时回退英文字体
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    font: ImageFont.ImageFont = ImageFont.load_default(size=size)
    for path in candidates:
        if Path(path).exists():
            try:
                font = ImageFont.truetype(path, size)
                break
            except OSError:
                continue
    _FONT_CACHE[size] = font
    return font


def draw_arrow(
    draw: ImageDraw.ImageDraw,
    start: Point,
    end: Point,
    color: str = ARROW,
    width: int = 3,
    head: int = 10,
) -> None:
    """绘制带箭头尖的线段。"""
    draw.line([start, end], fill=color, width=width)
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    for da in (math.pi - 0.45, math.pi + 0.45):
        tip = (
            end[0] + head * math.cos(angle + da),
            end[1] + head * math.sin(angle + da),
        )
        draw.line([end, tip], fill=color, width=width)


def draw_curved_arrow(
    draw: ImageDraw.ImageDraw,
    start: Point,
    end: Point,
    color: str = ARROW,
    width: int = 3,
    depth: int = 40,
) -> None:
    """绘制下方绕行的弧线箭头（二次贝塞尔），用于回指边 / 跨节点边，避免与直线边重叠。

    depth：弧线下探深度（像素）。
    """
    mx = (start[0] + end[0]) / 2
    my = max(start[1], end[1]) + depth
    steps = 24
    pts: List[Point] = []
    for s in range(steps + 1):
        t = s / steps
        x = (1 - t) ** 2 * start[0] + 2 * (1 - t) * t * mx + t ** 2 * end[0]
        y = (1 - t) ** 2 * start[1] + 2 * (1 - t) * t * my + t ** 2 * end[1]
        pts.append((x, y))
    draw.line(pts, fill=color, width=width, joint="curve")
    # 箭头尖沿末端切线方向
    angle = math.atan2(pts[-1][1] - pts[-2][1], pts[-1][0] - pts[-2][0])
    for da in (math.pi - 0.45, math.pi + 0.45):
        tip = (
            end[0] + 10 * math.cos(angle + da),
            end[1] + 10 * math.sin(angle + da),
        )
        draw.line([end, tip], fill=color, width=width)


def export_gif(
    frames: Sequence[Image.Image],
    out_path: str,
    durations: Optional[Sequence[int]] = None,
    loop: int = 0,
) -> None:
    """把帧序列导出为 GIF。durations 为每帧时长(ms)，默认 1200ms。"""
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    if durations is None:
        durations = [1200] * len(frames)
    frames[0].save(
        out,
        save_all=True,
        append_images=list(frames[1:]),
        duration=list(durations),
        loop=loop,
        disposal=2,
        optimize=True,
    )
