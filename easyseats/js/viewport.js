/* ==========================================================================
 * 易排座 · 视口：坐标换算、缩放、平移、双指手势
 * 拆分自原 index.html 内联脚本，逻辑逐字保留。
 * ========================================================================== */

import {
  CELL, MAX_SCALE, MIN_SCALE, SEAT, WORLD_MARGIN, cancelSeatDrag, canvas, clamp, marquee, offsetX,
  offsetY, scale, seats, setCancelSeatDrag, setMarquee, setOffsetX, setOffsetY, setPinch, setScale,
  setTouchPan, setTwoFinger, touchPan, twoFinger, world, zoomHint
} from './state.js';
import { noteViewChanged } from './sync.js';

  /* ================================================================
   *  坐标换算
   * ================================================================ */
  export function screenToWorld(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left - offsetX) / scale,
      y: (clientY - r.top  - offsetY) / scale
    };
  }

  export function applyTransform() {
    world.style.transform =
      `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    canvas.style.backgroundSize =
      (CELL * scale) + 'px ' + (CELL * scale) + 'px';
    canvas.style.backgroundPosition =
      offsetX + 'px ' + offsetY + 'px';
    zoomHint.textContent = '缩放 ' + Math.round(scale * 100) + '%';
    // 相机位置变了：防抖持久化到云端（layout.view），下次打开视角一致（js/sync.js）
    noteViewChanged();
  }

  export function zoomAt(clientX, clientY, newScale) {
    newScale = clamp(newScale, MIN_SCALE, MAX_SCALE);
    if (newScale === scale) return;

    const r = canvas.getBoundingClientRect();
    const px = clientX - r.left;
    const py = clientY - r.top;

    const wx = (px - offsetX) / scale;
    const wy = (py - offsetY) / scale;

    setScale(newScale);
    setOffsetX(px - wx * scale);
    setOffsetY(py - wy * scale);

    applyTransform();
  }

  // 把整张座位表居中显示（避免打开时座位在屏幕外）
  export function fitToContent(keepScale) {
    if (!seats.length) { return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    seats.forEach(s => {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + SEAT);
      maxY = Math.max(maxY, s.y + SEAT);
    });
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;

    if (!keepScale) {
      const pad = 80;
      const sx = (r.width - pad * 2) / Math.max(1, maxX - minX);
      const sy = (r.height - pad * 2) / Math.max(1, maxY - minY);
      setScale(clamp(Math.min(sx, sy, 1.6), MIN_SCALE, MAX_SCALE));
    }
    setOffsetX((r.width  - (maxX - minX) * scale) / 2 - minX * scale);
    setOffsetY((r.height - (maxY - minY) * scale) / 2 - minY * scale);
    applyTransform();
  }

  export function pinchAnchor(list) {
    const a = list[0], b = list[1];
    return {
      dist:  Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)),
      scale: scale,
      midX:  (a.clientX + b.clientX) / 2,
      midY:  (a.clientY + b.clientY) / 2,
      ox:    offsetX,
      oy:    offsetY
    };
  }

  // 单指操作给双指手势让位：撤销（不是提交），避免误框选 / 误移动
  export function abortSingleTouch() {
    if (marquee) { marquee.abort(); setMarquee(null); }
    if (cancelSeatDrag) { cancelSeatDrag(); setCancelSeatDrag(null); }
    if (touchPan) { setTouchPan(null); canvas.classList.remove('panning'); }
  }

  export function startTouchPan(clientX, clientY) {
    const sx = clientX, sy = clientY;
    const ox = offsetX, oy = offsetY;
    setTouchPan({ moveTo(x, y) {
      setOffsetX(ox + (x - sx));
      setOffsetY(oy + (y - sy));
      applyTransform();
    } });
  }

  export function onTouchEnd(e) {
    const n = e.touches.length;

    if (n >= 2) {                 // 还有两指以上：重新锚定，避免跳一下
      setPinch(pinchAnchor(e.touches));
      return;
    }

    if (n === 1) {                // 双指 → 单指：粘连，剩下的手指不做事
      if (twoFinger) setPinch(null);
      return;
    }

    // ---- 全部抬起：本轮触摸收尾 ----
    setTwoFinger(false);
    setPinch(null);
    canvas.classList.remove('panning');
    setTouchPan(null);
    if (marquee) {
      const t = e.changedTouches[0];
      if (t) marquee.finish(t.clientX, t.clientY);
      setMarquee(null);
    }
  }

  /* ================================================================
   *  座位基础操作
   * ================================================================ */

  export function clampWorld(v) {
    return clamp(v, -WORLD_MARGIN, WORLD_MARGIN);
  }
