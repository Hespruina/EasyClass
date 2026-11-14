/* ==========================================================================
 * 易排座 · 框选
 * 拆分自原 index.html 内联脚本，逻辑逐字保留。
 * ========================================================================== */

import { SEAT, manualGrouping, manualSelected, seats, world } from './state.js';
import { screenToWorld } from './viewport.js';
import { cellsInRect, createSeatAtCell, findFreeCell, removeSeat } from './seat.js';
import { createGroupFromSeats } from './group.js';
import { showMenu } from './menu.js';

  /* ================================================================
   *  框选模块（鼠标左键拖动 / 触屏单指拖动 共用一套，仅编辑模式）
   * ================================================================ */

  export function createMarquee(cx, cy) {
    const startW = screenToWorld(cx, cy);
    let box = null;
    let moved = false;
    let rect = null;

    return {
      get moved() { return moved; },

      moveTo(x, y) {
        if (!moved && Math.hypot(x - cx, y - cy) <= 4) return;
        if (!moved) {
          moved = true;
          box = document.createElement('div');
          box.className = 'select-box';
          world.appendChild(box);
        }
        const w = screenToWorld(x, y);
        const x1 = Math.min(startW.x, w.x);
        const y1 = Math.min(startW.y, w.y);
        const x2 = Math.max(startW.x, w.x);
        const y2 = Math.max(startW.y, w.y);
        rect = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
        box.style.left   = x1 + 'px';
        box.style.top    = y1 + 'px';
        box.style.width  = rect.w + 'px';
        box.style.height = rect.h + 'px';
      },

      // 松手：拖出过框 → 按框内容弹菜单；只是点了一下 → 仅取消选中
      finish(x, y) {
        if (box) { box.remove(); box = null; }
        if (moved && rect) { commitMarquee(rect, x, y); return; }
        if (manualGrouping) {
          manualSelected.clear();
          seats.forEach(s => s.el.classList.remove('selected'));
        }
      },

      // 被双指手势打断：静默撤掉，不弹菜单
      abort() {
        if (box) { box.remove(); box = null; }
        moved = false;
        rect = null;
      }
    };
  }

  // 框选结算：框里有座位 → 建组 / 批量删除；框里全空 → 批量建座
  export function commitMarquee(r, menuX, menuY) {
    const sel = seats.filter(s =>
      !(s.x + SEAT < r.x || s.x > r.x + r.w ||
        s.y + SEAT < r.y || s.y > r.y + r.h)
    );

    if (sel.length) {
      if (manualGrouping) {
        sel.forEach(s => {
          manualSelected.add(s.id);
          s.el.classList.add('selected');
        });
      } else {
        showMenu(menuX, menuY, [
          { label: '设为小组', onClick: () => createGroupFromSeats(sel) },
          { label: '批量删除', danger: true, onClick: () => sel.forEach(removeSeat) }
        ]);
      }
      return;
    }

    if (manualGrouping) return;

    // 框里一个座位都没有 → 视作「铺座」手势，提供批量创建
    // 不设最小尺寸门槛：哪怕只框住不到一格空白，也照样给按钮
    let cells = cellsInRect(r.x, r.y, r.x + r.w, r.y + r.h);
    if (!cells.length) {
      // 框正好卡在座位之间的缝隙里（覆盖到的格子全被占）→ 退一步取最近的空格
      const c = findFreeCell(r.x + r.w / 2, r.y + r.h / 2, null);
      if (c) cells = [c];
    }
    if (cells.length) {
      showMenu(menuX, menuY, [{
        label: '批量创建座位（' + cells.length + '）',
        onClick: () => cells.forEach(c => createSeatAtCell(c.col, c.row))
      }]);
    }
  }
