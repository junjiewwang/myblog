"""翻转链表（迭代法）动画生成入口。

执行迭代法翻转，dump 每一步状态快照，复用 linked_list.render_list_state
与 visualizer.export_gif 生成 GIF。

用法：
    cd scripts/algo-visualizer && python3 reverse_linked_list.py
输出：
    docs/algorithms/assets/reverse-linked-list/reverse-iter.gif
"""

from __future__ import annotations

import os
from typing import Dict, List, Optional

from visualizer import export_gif
from linked_list import render_list_state

_BASE = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(os.path.dirname(_BASE))
_OUT = os.path.join(
    _PROJECT_ROOT, "docs", "algorithms", "assets", "reverse-linked-list", "reverse-iter.gif"
)


def build_steps(values: List[int]) -> List[Dict]:
    """执行迭代法翻转，返回每一步的状态快照序列。"""
    n = len(values)
    next_of: List[Optional[int]] = [i + 1 if i + 1 < n else None for i in range(n)]
    prev: Optional[int] = None
    curr: Optional[int] = 0
    steps: List[Dict] = []

    steps.append(_snapshot(values, next_of, prev, curr, None, "初始：prev=NULL，curr=head"))

    round_no = 1
    while curr is not None:
        nxt = next_of[curr]  # 暂存 curr.next
        steps.append(
            _snapshot(
                values, next_of, prev, curr, nxt,
                f"第{round_no}轮 · 暂存 next = curr.next = {_name(values, nxt)}",
            )
        )
        old_prev = prev
        next_of[curr] = prev  # 反转指针
        prev = curr
        curr = nxt
        steps.append(
            _snapshot(
                values, next_of, prev, curr, None,
                f"第{round_no}轮 · {_name(values, prev)}.next = {_name(values, old_prev)}，prev/curr 前移",
            )
        )
        round_no += 1

    steps.append(_snapshot(values, next_of, prev, None, None, "完成：curr=NULL，返回 prev 为新头"))
    return steps


def _name(values: List[int], idx: Optional[int]) -> str:
    return "NULL" if idx is None else str(values[idx])


def _snapshot(
    values: List[int],
    next_of: List[Optional[int]],
    prev: Optional[int],
    curr: Optional[int],
    next_ptr: Optional[int],
    title: str,
) -> Dict:
    return {
        "values": values,
        "next": dict(enumerate(next_of)),
        "prev": prev,
        "curr": curr,
        "next_ptr": next_ptr,
        "title": title,
    }


def main() -> None:
    values = [1, 2, 3, 4, 5]
    steps = build_steps(values)
    frames = [render_list_state(s) for s in steps]
    # 最后一帧（结束状态）停留更久
    durations = [1100] * (len(frames) - 1) + [2500]
    export_gif(frames, _OUT, durations=durations)
    print(f"生成完成：{_OUT}（共 {len(frames)} 帧）")


if __name__ == "__main__":
    main()
