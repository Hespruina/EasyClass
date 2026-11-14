/* ==========================================================================
 * 易排座 · 选人与换座：选人面板、落座、换座、飞行动画、清空名字
 * 拆分自原 index.html 内联脚本，逻辑逐字保留。
 * ========================================================================== */

import {
  SEAT, listItems, nameBySeatId, namePicker, npBody, npSearch, npSub, npTitle, pickedSeat,
  pickerSeat, seatFlying, seats, setNameBySeatId, setNpCurrent, setPickerSeat, setSeatFlying,
  setSwapSourceSeat, swapSourceSeat, writePickedSeat
} from './state.js';
import { paintSeat, updateSeatCountHint } from './seat.js';
import { closeGroupPanel } from './group.js';
import { closeMenu } from './menu.js';
import { escapeHtml, toast } from './ui.js';
import { saveArrangement } from './arrange.js';

  /* ================================================================
   *  手动排座（仅排座模式）
   *  点座位 →「手动选择名字」/「与其他同学换座」/「移出座位」
   *  每次改动立即保存到云端（提交期间底部提示区显示转圈）
   * ================================================================ */

  export function seatNameOf(seat) { return nameBySeatId.get(seat.id) || ''; }

  export function setPickedSeat(seat) {
    if (pickedSeat && pickedSeat !== seat) pickedSeat.el.classList.remove('picked');
    writePickedSeat(seat || null);
    if (pickedSeat) pickedSeat.el.classList.add('picked');
  }

  export function clearSwapHint() {
    seats.forEach(s => s.el.classList.remove('swap-target'));
  }

  // 名单里还没排到座位的同学。按「份数」扣减，两个同名的同学不会被互相顶掉。
  export function unseatedNames() {
    const left = new Map();
    nameBySeatId.forEach(n => { if (n) left.set(n, (left.get(n) || 0) + 1); });
    const out = [];
    listItems.forEach(i => {
      const c = left.get(i.name) || 0;
      if (c > 0) left.set(i.name, c - 1);
      else out.push(i.name);
    });
    return out;
  }

  export function flashMoved(list) {
    list.forEach(s => {
      s.el.classList.remove('just-moved');
      void s.el.offsetWidth;                 // 强制重排，让动画能重复触发
      s.el.classList.add('just-moved');
      setTimeout(() => s.el.classList.remove('just-moved'), 520);
    });
  }

  /* ---------- 换座飞行动画 ---------- */
  // 克隆座位块 → 按屏幕坐标走弧线 → 真实座位在飞行期间隐藏，落地后再改数据
  // 飞行期间 seatFlying = true：这段时间不接受新的换座 / 拖拽，避免动画叠在一起
  export async function animateSeatFlight(flights) {
    const usable = flights.filter(f => f.from && f.to && f.from.el.getBoundingClientRect().width > 0);
    if (!usable.length) return;

    setSeatFlying(true);
    try {
      await runSeatFlight(usable);
    } finally {
      setSeatFlying(false);
    }
  }

  export async function runSeatFlight(usable) {
    const DUR = 460;
    const ghosts = [];
    usable.forEach(f => {
      const r = f.from.el.getBoundingClientRect();
      const tr = f.to.el.getBoundingClientRect();
      const k = r.width / SEAT;                       // 当前画布缩放比
      const dx = tr.left - r.left;
      const dy = tr.top - r.top;
      const lift = f.lift === undefined ? -22 : f.lift;

      const g = f.from.el.cloneNode(true);
      g.classList.add('seat-flight');
      g.classList.remove('picked', 'swap-target', 'just-moved', 'hl', 'selected', 'drag-source', 'drop-target');
      g.textContent = f.name;
      g.style.left = r.left + 'px';
      g.style.top  = r.top + 'px';
      document.body.appendChild(g);
      ghosts.push(g);

      g.animate([
        { transform: 'translate(0px, 0px) scale(' + k + ')' },
        { transform: 'translate(' + (dx / 2) + 'px, ' + (dy / 2 + lift) + 'px) scale(' + k + ')' },
        { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(' + k + ')' }
      ], { duration: DUR, easing: 'cubic-bezier(.42,.02,.36,1)', fill: 'forwards' });
    });

    // 只把原名藏起来，座位格子留在原地 —— 飞的是「名字」，不是座位本身。
    // （整块 visibility:hidden 会在网格上留出空洞，看着像座位丢了）
    usable.forEach(f => { f.from.el.style.color = 'transparent'; });
    await new Promise(r => setTimeout(r, DUR + 30));
    ghosts.forEach(g => g.remove());
    usable.forEach(f => { f.from.el.style.color = ''; });
  }

  export function renderNamePicker() {
    if (!pickerSeat) return;
    const names = unseatedNames();
    const kw = (npSearch.value || '').trim();
    const shown = kw ? names.filter(n => n.indexOf(kw) >= 0) : names;
    setNpCurrent(shown);

    npSub.textContent = '还没排座：' + names.length + ' 人'
      + (kw ? '（筛出 ' + shown.length + ' 人）' : '');

    if (!names.length) {
      setNpCurrent([]);
      npSetHl(-1);
      npBody.innerHTML = '<div class="np-empty">全班同学都已经排到座位上。<br>'
        + '想换人请点座位选「与其他同学换座」。</div>';
      return;
    }
    if (!shown.length) {
      setNpCurrent([]);
      npSetHl(-1);
      npBody.innerHTML = '<div class="np-empty">没有匹配「' + escapeHtml(kw) + '」的同学</div>';
      return;
    }
    npBody.innerHTML = shown.map((n, i) =>
      '<div class="np-item" data-idx="' + i + '">' + escapeHtml(n) + '</div>').join('');
    npSetHl(0);   // 默认高亮第一条：回车直接落座，↑↓ 可换人
  }

  /* ---------- 键盘操作（输入框自动聚焦 + ↑↓ 选择 + 回车落座） ---------- */

  let npHl = -1;   // 当前键盘高亮的条目下标（对齐 npCurrent）

  function npSetHl(i) {
    npHl = i;
    npBody.querySelectorAll('.np-item').forEach((el, idx) => {
      el.classList.toggle('hl', idx === npHl);
    });
    const el = npBody.querySelector('.np-item.hl');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }

  // main.js 绑定在 npSearch 的 keydown 上：只在本面板打开时有意义
  export function handleNpKeydown(e) {
    if (!namePicker.classList.contains('show')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (npCurrent.length) npSetHl(Math.min(npHl + 1, npCurrent.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (npCurrent.length) npSetHl(Math.max(npHl - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const name = npCurrent[npHl];
      if (!name || !pickerSeat) return;
      const seat = pickerSeat;
      closeNamePicker();
      assignNameToSeat(seat, name);   // 与点击结果走同一条路径
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeNamePicker();
    }
  }

  export function openNamePicker(seat) {
    closeGroupPanel();          // 两个面板都在右侧，避免叠在一起
    setPickerSeat(seat);
    npTitle.textContent = '为座位选一个同学';
    npSearch.value = '';
    renderNamePicker();
    namePicker.classList.add('show');
    npSearch.focus();           // 键盘焦点直接进搜索框，抬起头就能打字
  }

  export function closeNamePicker() {
    namePicker.classList.remove('show');
    setPickerSeat(null);
  }

  /* ---------- 落座 / 换座 ---------- */
  // 把某个名字放到某个座位上；该座位原本的同学自然回到「未排座」池
  export async function assignNameToSeat(seat, name) {
    if (seatFlying) return;
    if (seatNameOf(seat) === name) { toast('这位同学就坐在这个座位上'); return; }

    if (name) nameBySeatId.set(seat.id, name);
    else nameBySeatId.delete(seat.id);
    paintSeat(seat);
    flashMoved([seat]);
    updateSeatCountHint();   // 先刷计数，保存失败也不会和画布对不上

    if (name) await saveArrangement('已把 ' + name + ' 安排到这个座位');
    else await saveArrangement('已把这位同学移出座位');
  }

  export function startSwap(seat) {
    setSwapSourceSeat(seat);
    clearSwapHint();
    setPickedSeat(seat);
    closeMenu();
    seats.forEach(s => { if (seatNameOf(s)) s.el.classList.add('swap-target'); });
    toast('请点击另一位同学的座位完成换座');
  }

  export function cancelSwap(silent) {
    if (!swapSourceSeat) return;
    setSwapSourceSeat(null);
    clearSwapHint();
    setPickedSeat(null);
    if (!silent) toast('已取消换座');
  }

  export async function finishSwap(target) {
    const from = swapSourceSeat;
    if (!from || seatFlying) return;
    if (target.id === from.id) { cancelSwap(); return; }

    const nameA = seatNameOf(from);
    const nameB = seatNameOf(target);

    clearSwapHint();
    setSwapSourceSeat(null);
    setPickedSeat(null);

    if (!nameA) { toast('这个座位还没有同学', true); return; }

    // 目标空座：直接把同学搬过去（同样是「换座」操作，只是另一边没人）
    if (!nameB) {
      await animateSeatFlight([{ from, to: target, name: nameA, lift: -24 }]);
      nameBySeatId.delete(from.id);
      nameBySeatId.set(target.id, nameA);
      paintSeat(from); paintSeat(target);
      flashMoved([target]);
      updateSeatCountHint();
      await saveArrangement('已把 ' + nameA + ' 移到空座位');
      return;
    }

    // 两个名字沿弧线交叉飞过，一上一下，视觉上分得开
    await animateSeatFlight([
      { from, to: target, name: nameA, lift: -26 },
      { from: target, to: from, name: nameB, lift: 26 }
    ]);
    nameBySeatId.set(from.id, nameB);
    nameBySeatId.set(target.id, nameA);
    paintSeat(from); paintSeat(target);
    flashMoved([from, target]);
    updateSeatCountHint();
    await saveArrangement('已交换 ' + nameA + ' 与 ' + nameB);
  }

  /* ---------- 一键清空所有名字 ---------- */
  export async function clearAllNames() {
    const seated = seats.filter(s => seatNameOf(s)).length;
    if (!seated) { toast('现在没有任何已排座的名字', true); return; }
    if (!window.confirm('确定要清空全部 ' + seated + ' 个座位上的名字吗？\n（清空结果会立即保存到云端）')) return;

    cancelSwap(true);
    closeNamePicker();
    closeMenu();
    setPickedSeat(null);
    setNameBySeatId(new Map());
    seats.forEach(paintSeat);
    updateSeatCountHint();
    await saveArrangement('已清空所有名字');
  }
