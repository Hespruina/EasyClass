/* ==========================================================================
 * 易排座 · 座位指针交互：鼠标按下、触摸按下（拖拽 / 框选 / 点选的入口）
 * 拆分自原 index.html 内联脚本，逻辑逐字保留。
 * ========================================================================== */

import {
  CELL, PAD, bottomBar, cancelSeatDrag, editMode, gridAlign, groups, manualGrouping, manualSeating,
  scale, setCancelSeatDrag
} from './state.js';
import { clampWorld, screenToWorld } from './viewport.js';
import { findFreeCell, moveSeatEl, removeSeat } from './seat.js';
import {
  dissolveGroup, openGroupPanel, renameGroupPrompt, renderGroupPanel, renderGroups,
  toggleManualSelect
} from './group.js';
import { closeMenu, showMenu } from './menu.js';
import { beginSeatDrag, canDragSeat, endSeatDrag, onSeatTap, updateSeatDrag } from './drag.js';

  /* ================================================================
   *  座位拖拽（鼠标）—— 仅编辑模式
   * ================================================================ */

  export function onSeatMouseDown(e, seat) {
    if (!editMode) {
      // 排座模式：座位本身固定不动（布局只能在编辑模式里改）。
      // · 单击（没有拖动）座位 = 打开该座位的操作菜单
      // · 按住「有人的座位」拖动 = 把这位同学拖到别的座位（互换 / 移进空座）
      // · 拖动空座位仍然让给画布平移（不 stopPropagation）
      if (!manualSeating || e.button !== 0) return;

      let canDrag = canDragSeat(seat);
      if (canDrag) { e.preventDefault(); e.stopPropagation(); }   // 拖学生时不触发画布平移

      const sx = e.clientX, sy = e.clientY;
      let moved = false, dragging = false;

      function onTapMove(ev) {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 4) moved = true;
        if (!moved) return;
        if (!dragging) {
          if (!canDrag) return;
          dragging = beginSeatDrag(seat, ev.clientX, ev.clientY);
          if (!dragging) canDrag = false;
        }
        if (!dragging) return;
        ev.preventDefault();
        updateSeatDrag(ev.clientX, ev.clientY);
      }
      function onTapUp() {
        document.removeEventListener('mousemove', onTapMove);
        document.removeEventListener('mouseup', onTapUp);
        if (dragging) { endSeatDrag(true); return; }
        if (!moved) onSeatTap(seat);
      }
      document.addEventListener('mousemove', onTapMove);
      document.addEventListener('mouseup', onTapUp);
      return;
    }

    // ---- 右键：一键删除座位 ----
    if (e.button === 2) {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
      removeSeat(seat);
      return;
    }

    if (e.button !== 0) return;
    if (e.ctrlKey) return;

    e.preventDefault();
    e.stopPropagation();

    const start = screenToWorld(e.clientX, e.clientY);
    const origX = seat.x, origY = seat.y;
    let moved = false;

    function onMove(ev) {
      const now = screenToWorld(ev.clientX, ev.clientY);
      const dx = now.x - start.x;
      const dy = now.y - start.y;

      if (!moved && Math.hypot(dx * scale, dy * scale) > 4) {
        moved = true;
        seat.el.classList.add('dragging');
      }
      if (!moved) return;

      seat.x = clampWorld(origX + dx);
      seat.y = clampWorld(origY + dy);
      moveSeatEl(seat);

      const bb = bottomBar.getBoundingClientRect();
      seat.el.style.opacity = ev.clientY > bb.top ? '0.25' : '';

      renderGroups();
    }

    function onUp(ev) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      seat.el.classList.remove('dragging');
      seat.el.style.opacity = '';

      if (!moved) {
        if (manualGrouping) {
          toggleManualSelect(seat);
        } else if (seat.groupId) {
          const g = groups.find(x => x.id === seat.groupId);
          if (g) {
            showMenu(ev.clientX, ev.clientY, [
              { label: '更改组名', onClick: () => renameGroupPrompt(g) },
              { label: '解散小组', danger: true, onClick: () => dissolveGroup(g) },
              { label: '查看小组总览', onClick: () => openGroupPanel() }
            ]);
          }
        }
        return;
      }

      const bb = bottomBar.getBoundingClientRect();
      if (ev.clientY > bb.top) {
        removeSeat(seat);
        return;
      }

      if (gridAlign) {
        const cell = findFreeCell(seat.x, seat.y, seat);
        if (cell) {
          seat.col = cell.col;
          seat.row = cell.row;
          seat.x = seat.col * CELL + PAD;
          seat.y = seat.row * CELL + PAD;
        }
      } else {
        seat.x = clampWorld(seat.x);
        seat.y = clampWorld(seat.y);
      }
      moveSeatEl(seat);
      renderGroups();
      renderGroupPanel();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  /* ================================================================
   *  座位拖拽（触屏）—— 仅编辑模式
   * ================================================================ */
  export function onSeatTouchStart(e, seat) {
    if (!editMode) {
      // 手动排座：轻点座位 = 打开该座位的操作菜单；
      // 按住「有人的座位」单指拖动 = 拖学生去换座（和鼠标一致）。
      // 首指 preventDefault 吃掉浏览器合成的 mouse 事件，一次触摸只走一套逻辑；
      // 双指落下时这里不接管，交给画布的双指手势（不 stopPropagation）。
      if (!manualSeating || e.touches.length !== 1) return;
      e.preventDefault();

      const t0 = e.changedTouches[0];
      const sx = t0.clientX, sy = t0.clientY;
      let moved = false, done = false, dragging = false;
      let canDrag = canDragSeat(seat);

      function detach() {
        document.removeEventListener('touchmove', onTapMove);
        document.removeEventListener('touchend', onTapEnd);
        document.removeEventListener('touchcancel', onTapEnd);
      }
      function onTapMove(ev) {
        if (ev.touches.length !== 1) {          // 变双指 → 放弃这次点击 / 拖拽
          done = true;
          detach();
          if (dragging) endSeatDrag(false);
          return;
        }
        const t = ev.changedTouches[0];
        if (!t) return;
        if (!moved && Math.hypot(t.clientX - sx, t.clientY - sy) > 8) moved = true;
        if (!moved) return;
        if (!dragging) {
          if (!canDrag) return;
          dragging = beginSeatDrag(seat, t.clientX, t.clientY);
          if (!dragging) { canDrag = false; return; }
        }
        ev.preventDefault();
        updateSeatDrag(t.clientX, t.clientY);
      }
      function onTapEnd() {
        if (done) return;
        done = true;
        detach();
        if (dragging) { endSeatDrag(true); return; }
        if (!moved) onSeatTap(seat);
      }
      document.addEventListener('touchmove', onTapMove, { passive: false });
      document.addEventListener('touchend', onTapEnd);
      document.addEventListener('touchcancel', onTapEnd);
      return;
    }
    // 第二根手指落下时这里早退（且不 stopPropagation），交给画布的双指手势接手
    if (e.touches.length !== 1) return;
    e.stopPropagation();
    e.preventDefault();

    const t0 = e.changedTouches[0];
    const start = screenToWorld(t0.clientX, t0.clientY);
    const origX = seat.x, origY = seat.y;
    let moved = false;
    let done = false;

    function detach() {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      if (cancelSeatDrag === abort) setCancelSeatDrag(null);
    }

    // 被双指手势抢占：撤销这次拖拽，把座位放回原处（不吸附、不删除）
    function abort() {
      if (done) return;
      done = true;
      detach();
      seat.el.classList.remove('dragging');
      seat.el.style.opacity = '';
      seat.x = origX;
      seat.y = origY;
      moveSeatEl(seat);
      renderGroups();
    }

    function onMove(ev) {
      if (ev.touches.length !== 1) { abort(); return; }
      const t = ev.changedTouches[0];
      const now = screenToWorld(t.clientX, t.clientY);
      const dx = now.x - start.x;
      const dy = now.y - start.y;

      if (!moved && Math.hypot(dx * scale, dy * scale) > 8) {
        moved = true;
        seat.el.classList.add('dragging');
      }
      if (!moved) return;

      ev.preventDefault();
      seat.x = clampWorld(origX + dx);
      seat.y = clampWorld(origY + dy);
      moveSeatEl(seat);

      const bb = bottomBar.getBoundingClientRect();
      seat.el.style.opacity = t.clientY > bb.top ? '0.25' : '';
      renderGroups();
    }

    function onEnd(ev) {
      if (done) return;
      done = true;
      detach();
      seat.el.classList.remove('dragging');
      seat.el.style.opacity = '';

      if (!moved) {
        if (manualGrouping) {
          toggleManualSelect(seat);
        } else if (seat.groupId) {
          const g = groups.find(x => x.id === seat.groupId);
          if (g) {
            const t = ev.changedTouches[0];
            showMenu(t.clientX, t.clientY, [
              { label: '更改组名', onClick: () => renameGroupPrompt(g) },
              { label: '解散小组', danger: true, onClick: () => dissolveGroup(g) },
              { label: '查看小组总览', onClick: () => openGroupPanel() }
            ]);
          }
        }
        return;
      }

      const t = ev.changedTouches[0];
      const bb = bottomBar.getBoundingClientRect();
      if (t && t.clientY > bb.top) {
        removeSeat(seat);
        return;
      }

      if (gridAlign) {
        const cell = findFreeCell(seat.x, seat.y, seat);
        if (cell) {
          seat.col = cell.col;
          seat.row = cell.row;
          seat.x = seat.col * CELL + PAD;
          seat.y = seat.row * CELL + PAD;
        }
      } else {
        seat.x = clampWorld(seat.x);
        seat.y = clampWorld(seat.y);
      }
      moveSeatEl(seat);
      renderGroups();
      renderGroupPanel();
    }

    setCancelSeatDrag(abort);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
  }
