"""链表领域可视化：把链表的「状态快照」渲染成帧。

复用 visualizer 的绘图基础能力；未来其他链表算法（环形检测、合并有序链表等）
只需产出同样结构的 state，即可复用 render_list_state。

state 结构：
{
    "values": [1, 2, 3, 4, 5],          # 节点值（原始顺序）
    "next": {0: 1, 1: None, ...},       # index -> 下一节点 index，None 表示 NULL
    "prev": None | int,                 # prev 游标指向的节点 index
    "curr": None | int,                 # curr 游标指向的节点 index
    "next_ptr": None | int,             # next 游标指向的节点 index
    "title": "步骤说明",
}
"""

from __future__ import annotations

from collections import defaultdict
from typing import Dict, Optional

from PIL import Image, ImageDraw

from visualizer import (
    BG,
    NODE_FILL,
    NODE_BORDER,
    TEXT,
    ARROW,
    NIL_BORDER,
    NIL_TEXT,
    PREV_COLOR,
    CURR_COLOR,
    NEXT_COLOR,
    load_font,
    draw_arrow,
    draw_curved_arrow,
)

R = 30          # 节点半径
GAP = 120       # 节点中心间距
TOP = 175       # 节点圆心 y
TAG_H = 26      # 游标标签块高度
TAG_W = 52      # 游标标签块宽度


def render_list_state(state: Dict) -> Image.Image:
    values = state["values"]
    nxt = state.get("next", {})
    n = len(values)
    nil_index = n  # NULL 放在节点序列末尾

    width = GAP * (n + 1) + 80
    height = 300
    img = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(img)

    font_val = load_font(22)
    font_tag = load_font(14)
    font_nil = load_font(16)
    font_title = load_font(18)

    def cx(i: int) -> int:
        return 60 + i * GAP

    # 1. next 箭头：相邻前进边画直线；回指边 / 跨节点边画下方弧线，避免视觉重叠
    for i in range(n):
        target = nxt.get(i)
        t = target if target is not None else nil_index
        if t == i + 1:
            draw_arrow(draw, (cx(i) + R, TOP), (cx(t) - R, TOP), ARROW, 3)
        else:
            depth = min(70, abs(t - i) * GAP // 5 + 20)
            draw_curved_arrow(
                draw, (cx(i), TOP + R), (cx(t), TOP + R), ARROW, 3, depth=depth
            )

    # 2. 节点圆 + 值
    for i in range(n):
        x, y = cx(i), TOP
        outline, ow = NODE_BORDER, 2
        if i == state.get("curr"):
            outline, ow = CURR_COLOR, 5
        elif i == state.get("prev"):
            outline, ow = PREV_COLOR, 5
        elif i == state.get("next_ptr"):
            outline, ow = NEXT_COLOR, 5
        draw.ellipse([x - R, y - R, x + R, y + R], fill=NODE_FILL, outline=outline, width=ow)
        val = str(values[i])
        tw = draw.textlength(val, font=font_val)
        draw.text((x - tw / 2, y - 14), val, fill=TEXT, font=font_val)

    # 3. NULL 节点（虚线圆）
    x, y = cx(nil_index), TOP
    draw.ellipse([x - R, y - R, x + R, y + R], outline=NIL_BORDER, width=2)
    nil_label = "NULL"
    tw = draw.textlength(nil_label, font=font_nil)
    draw.text((x - tw / 2, y - 11), nil_label, fill=NIL_TEXT, font=font_nil)

    # 4. 游标标签（按目标节点聚合，None 归到 NULL 节点）
    cursors = [
        ("prev", state.get("prev"), PREV_COLOR),
        ("curr", state.get("curr"), CURR_COLOR),
        ("next", state.get("next_ptr"), NEXT_COLOR),
    ]
    node_tags: Dict[Optional[int], list] = defaultdict(list)
    for name, target, color in cursors:
        node_tags[target].append((name, color))

    for target, tags in node_tags.items():
        x = cx(nil_index) if target is None else cx(target)
        total_w = len(tags) * TAG_W
        start_x = x - total_w / 2
        top = TOP - R - 14
        for k, (name, color) in enumerate(tags):
            bx = start_x + k * TAG_W
            draw.rounded_rectangle(
                [bx, top - TAG_H, bx + TAG_W, top], radius=6, fill=color
            )
            tw = draw.textlength(name, font=font_tag)
            draw.text((bx + (TAG_W - tw) / 2, top - TAG_H + 5), name, fill="#ffffff", font=font_tag)
            draw_arrow(draw, (bx + TAG_W / 2, top), (x, TOP - R), color, 3)

    # 5. 标题
    title = state.get("title", "")
    if title:
        draw.text((12, 10), title, fill=TEXT, font=font_title)

    return img
