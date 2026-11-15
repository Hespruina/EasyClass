/* ==========================================================================
 * 易排座 · 拖动换座
 * 拆分自原 index.html 内联脚本，逻辑逐字保留。
 * ========================================================================== */

import {
  SEAT, canvas, clamp, dragSwap, manualSeating, offsetX, offsetY, scale, seatFlying, seats,
  setDragSwap, setSwapSourceSeat, swapSourceSeat
} from './state.js';
import { closeMenu, showMenu } from './menu.js';
import { toast } from './ui.js';
import { openRoleMenu } from './role.js';
import {
  assignNameToSeat, cancelSwap, closeNamePicker, finishSwap, openNamePicker, seatNameOf,
  setPickedSeat, startSwap
} from './swap.js';

  // 光标下的座位：用世界坐标算，不走 getBoundingClientRect（拖动时每帧都查，避免反复触发重排）
  export function seatAtPoint(cx, cy) {
    const r = canvas.getBoundingClientRect();
    const wx = (cx - r.left - offsetX) / scale;
    const wy = (cy - r.top  - offsetY) / scale;
    for (let i = seats.length - 1; i >= 0; i--) {
      const s = seats[i];
      if (wx >= s.x && wx <= s.x + SEAT && wy >= s.y && wy <= s.y + SEAT) return s;
    }
    return null;
  }

  export function moveDragGhost(cx, cy) {
    if (!dragSwap || !dragSwap.ghost) return;
    dragSwap.ghost.style.left = cx + 'px';
    dragSwap.ghost.style.top  = cy + 'px';
  }

  // 能不能从这个座位拖起来：有名字、没有正在飞的动画、没有已待定的换座
  export function canDragSeat(seat) {
    return !!seat && manualSeating && !seatFlying && !swapSourceSeat && !!seatNameOf(seat);
  }

  // 拆掉拖动中的视觉（影子 / 源座位虚线 / 落点高亮），返回被拆掉的拖动状态
  export function resetDragDom() {
    if (!dragSwap) return null;
    const d = dragSwap;
    setDragSwap(null);
    document.body.classList.remove('dragging-seat');
    if (d.from) d.from.el.classList.remove('drag-source');
    if (d.ghost) d.ghost.remove();
    if (d.target) d.target.el.classList.remove('drop-target');
    return d;
  }

  export function beginSeatDrag(seat, cx, cy) {
    if (!canDragSeat(seat)) return false;
    resetDragDom();          // 兜底：上一次松手落在窗口外没收到 mouseup
    cancelSwap(true);
    closeMenu();
    closeNamePicker();
    setPickedSeat(seat);

    const g = document.createElement('div');
    g.className = 'seat-drag-ghost';
    g.textContent = seatNameOf(seat);
    // 跟随画布缩放：影子和屏幕上的座位一样大
    const k = clamp(scale, 0.6, 2);
    g.style.transform = 'translate(-50%, -50%) scale(' + k + ')';
    document.body.appendChild(g);

    setDragSwap({ from: seat, ghost: g, target: null });
    seat.el.classList.add('drag-source');
    document.body.classList.add('dragging-seat');
    moveDragGhost(cx, cy);
    return true;
  }

  export function updateSeatDrag(cx, cy) {
    if (!dragSwap) return;
    moveDragGhost(cx, cy);
    const over = seatAtPoint(cx, cy);
    const target = (over && over !== dragSwap.from) ? over : null;
    if (target === dragSwap.target) return;
    if (dragSwap.target) dragSwap.target.el.classList.remove('drop-target');
    dragSwap.target = target;
    if (target) target.el.classList.add('drop-target');
  }

  export async function endSeatDrag(commit) {
    const d = resetDragDom();
    if (!d) return;
    setPickedSeat(null);

    if (!commit) return;
    if (!d.target) { toast('拖到另一个座位上松手才能换座'); return; }

    setSwapSourceSeat(d.from);      // 复用现有换座逻辑（目标为空座时走「移过去」分支）
    await finishSwap(d.target);
  }

  // 单击某个座位：换座中 → 完成换座；否则弹出该座位的操作菜单
  export function onSeatTap(seat) {
    if (seatFlying) return;
    if (swapSourceSeat) { finishSwap(seat); return; }

    closeNamePicker();
    const name = seatNameOf(seat);
    const r = seat.el.getBoundingClientRect();

    const items = [{ label: '手动选择名字', onClick: () => openNamePicker(seat) }];
    if (name) {
      items.push({ label: '与其他同学换座', onClick: () => startSwap(seat) });
      // 触屏没有右键：长按/轻点菜单里也给一个入口（右键走 interaction.js 那条路）
      items.push({ label: '设置职位', onClick: () => openRoleMenu(seat, r.left, r.bottom + 6) });
      items.push({ label: '移出座位', danger: true, onClick: () => assignNameToSeat(seat, '') });
    }
    items.push({ label: '当前：' + (name || '空座'), note: true });

    setPickedSeat(seat);
    closeMenu();
    showMenu(r.left, r.bottom + 6, items);
  }
