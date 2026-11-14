/* ==========================================================================
 * 易排座 · 手动排座搜索
 * ribbon「搜索」按钮（seat 模式）开关画布顶部的浮动搜索条：
 *   - 输入姓名实时过滤：已排座（按座位视觉顺序）在前，未入座在后；
 *   - ↑↓ 选择、回车定位；点击结果同样生效；
 *   - 命中已排座：画布居中到该座位并高亮约 1.8s；
 *   - 命中未入座：提示该同学还没排座。
 * ========================================================================== */

import {
  SEAT, canvas, nameBySeatId, offsetX, offsetY, scale, seatSearch,
  seatSearchInput, seatSearchResults, seats, setOffsetX, setOffsetY
} from './state.js';
import { applyTransform } from './viewport.js';
import { sortSeatsByPosition } from './arrange.js';
import { unseatedNames } from './swap.js';
import { escapeHtml, toast } from './ui.js';

  let entries = [];      // 当前渲染的结果项 [{ name, seat, seated }]
  let hlIdx = -1;        // 键盘高亮下标
  let flashTimer = null;

  /* ---------- 开关 ---------- */

  export function showSearchBar() {
    seatSearch.classList.add('show');
    seatSearchInput.value = '';
    renderResults('');
    seatSearchInput.focus();
  }

  export function hideSearchBar() {
    seatSearch.classList.remove('show');
    seatSearchInput.value = '';
    entries = [];
    hlIdx = -1;
  }

  export function toggleSearchBar() {
    if (seatSearch.classList.contains('show')) hideSearchBar();
    else showSearchBar();
  }

  /* ---------- 结果渲染 ---------- */

  function renderResults(rawKw) {
    const kw = (rawKw || '').trim();
    entries = [];
    hlIdx = -1;

    if (!kw) {
      seatSearchResults.innerHTML =
        '<div class="ss-hint">输入姓名查找同学坐哪；↑↓ 选择，回车定位</div>';
      return;
    }

    // 已排座：按座位视觉顺序（上→下、左→右），同名多份各占一条
    sortSeatsByPosition(seats).forEach(seat => {
      const n = nameBySeatId.get(seat.id);
      if (n && n.indexOf(kw) >= 0) entries.push({ name: n, seat, seated: true });
    });
    // 名单里有、但还没排到座位的同学
    unseatedNames().forEach(n => {
      if (n.indexOf(kw) >= 0) entries.push({ name: n, seat: null, seated: false });
    });

    if (!entries.length) {
      seatSearchResults.innerHTML =
        '<div class="ss-empty">没有找到「' + escapeHtml(kw) + '」</div>';
      return;
    }

    seatSearchResults.innerHTML = entries.map((e, i) =>
      '<div class="ss-item' + (e.seated ? '' : ' unseated') + '" data-idx="' + i + '">'
      + '<span class="ss-name">' + escapeHtml(e.name) + '</span>'
      + '<span class="ss-badge">' + (e.seated ? '已排座' : '未入座') + '</span>'
      + '</div>').join('');
    setHl(0);
  }

  function setHl(i) {
    hlIdx = i;
    seatSearchResults.querySelectorAll('.ss-item').forEach((el, idx) => {
      el.classList.toggle('hl', idx === hlIdx);
    });
    const el = seatSearchResults.querySelector('.ss-item.hl');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }

  /* ---------- 定位 ---------- */

  function flashSeat(seat) {
    if (flashTimer) clearTimeout(flashTimer);
    seats.forEach(s => s.el.classList.remove('search-hit'));
    seat.el.classList.add('search-hit');
    flashTimer = setTimeout(() => {
      seat.el.classList.remove('search-hit');
      flashTimer = null;
    }, 1800);
  }

  function centerOnSeat(seat) {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    setOffsetX(r.width / 2 - (seat.x + SEAT / 2) * scale);
    setOffsetY(r.height / 2 - (seat.y + SEAT / 2) * scale);
    applyTransform();
    flashSeat(seat);
  }

  function pick(i) {
    const e = entries[i];
    if (!e) return;
    if (!e.seated) { toast('「' + e.name + '」还没有排到座位'); return; }
    centerOnSeat(e.seat);
  }

  /* ---------- 事件入口（main.js 绑定） ---------- */

  export function onSearchInput() {
    renderResults(seatSearchInput.value);
  }

  export function onSearchKeydown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (entries.length) setHl(Math.min(hlIdx + 1, entries.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (entries.length) setHl(Math.max(hlIdx - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(hlIdx);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideSearchBar();
    }
  }

  export function onSearchResultsClick(e) {
    const item = e.target && e.target.closest ? e.target.closest('.ss-item') : null;
    if (!item) return;
    pick(parseInt(item.dataset.idx, 10));
  }
