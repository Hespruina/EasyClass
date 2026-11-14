/* ==========================================================================
 * 易排座 · 座位模型与渲染：网格占位、创建 / 删除 / 移动 / 计数
 * 拆分自原 index.html 内联脚本，逻辑逐字保留。
 * ========================================================================== */

import {
  CELL, PAD, WORLD_MARGIN, canvas, clamp, editMode, gridAlign, listItems, manualSelected,
  nameBySeatId, nextSeatSeq, notice, saveBtn, seatCountHint, seatSeq, seats, seatsFit, setSeatSeq,
  setSeats, world
} from './state.js';
import { clampWorld } from './viewport.js';
import { onSeatMouseDown, onSeatTouchStart } from './interaction.js';
import { renderGroupPanel, renderGroups } from './group.js';
import { syncTabState } from './mode.js';

  // 坐标 → 网格号（供吸附与刷座共用，保证取整规则一致）
  export function cellAt(x, y) {
    const maxCells = Math.ceil(WORLD_MARGIN / CELL);
    return {
      col: clamp(Math.round((x - PAD) / CELL), -maxCells, maxCells),
      row: clamp(Math.round((y - PAD) / CELL), -maxCells, maxCells)
    };
  }

  // 指定格子是否已被占用
  export function isCellTaken(col, row) {
    return seats.some(s => s.col === col && s.row === row);
  }

  export function findFreeCell(x, y, exclude) {
    const maxCells = Math.ceil(WORLD_MARGIN / CELL);

    const occupied = new Set();
    seats.forEach(s => {
      if (s !== exclude && s.col !== null && s.row !== null) {
        occupied.add(s.col + ',' + s.row);
      }
    });

    const start = cellAt(x, y);
    const col = start.col, row = start.row;
    if (!occupied.has(col + ',' + row)) return { col, row };

    for (let r = 1; r <= maxCells * 2; r++) {
      for (let dc = -r; dc <= r; dc++) {
        for (let dr = -r; dr <= r; dr++) {
          if (Math.abs(dc) !== r && Math.abs(dr) !== r) continue;
          const c = col + dc, rr = row + dr;
          if (c < -maxCells || rr < -maxCells ||
              c >  maxCells || rr >  maxCells) continue;
          if (!occupied.has(c + ',' + rr)) return { col: c, row: rr };
        }
      }
    }
    return null;
  }

  // 座位显示内容：编辑模式固定"座位"，排座模式显示姓名，没名字就是「空座」
  export function seatLabelText(seat) {
    if (editMode) return '座位';
    const name = nameBySeatId.get(seat.id);
    return name ? name : '空座';
  }

  export function paintSeat(seat) {
    seat.el.textContent = seatLabelText(seat);
    // has-name 与模式无关，永远按当前姓名刷：只在排座态维护的话，
    // 在格局编辑态新增 / 改动的座位会带着过期的类回到排座态（光标、空座样式都不对）
    seat.el.classList.toggle('has-name', !!nameBySeatId.get(seat.id));
  }

  // 按最终世界坐标落一个座位（col / row 为网格号，非吸附时为 null）
  export function createSeatEl(x, y, col, row, id) {
    const seat = { id: id || nextSeatSeq(), x, y, col, row, groupId: null, el: null };
    if (seat.id > seatSeq) setSeatSeq(seat.id);

    const el = document.createElement('div');
    el.className = 'seat';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.addEventListener('mousedown', ev => onSeatMouseDown(ev, seat));
    el.addEventListener('touchstart', ev => onSeatTouchStart(ev, seat), { passive: false });

    world.appendChild(el);
    seat.el = el;
    seats.push(seat);
    paintSeat(seat);
    updateEmpty();
    renderGroups();
    updateSeatCountHint();
    return seat;
  }

  export function addSeat(worldX, worldY) {
    let col = null, row = null;
    let x = clampWorld(worldX), y = clampWorld(worldY);

    if (gridAlign) {
      const cell = findFreeCell(x, y, null);
      if (!cell) return null;
      col = cell.col;
      row = cell.row;
      x = col * CELL + PAD;
      y = row * CELL + PAD;
    }

    return createSeatEl(x, y, col, row, null);
  }

  // 按网格号落一个座位
  export function createSeatAtCell(col, row) {
    return createSeatEl(col * CELL + PAD, row * CELL + PAD, col, row, null);
  }

  // 求一块世界坐标矩形覆盖到、且当前为空的格子。
  // 判定用「格子槽位」（每格占 CELL×CELL，座位居中、四周留 (CELL-SEAT)/2 间隙），
  // 而不是「座位矩形」——否则框落在两格之间的空隙里会一格都算不到。
  // 槽位边界正好是 CELL 的整数倍，因此任意小的一块（哪怕 1px）都至少落进一格。
  export function cellsInRect(x1, y1, x2, y2) {
    const maxCells = Math.ceil(WORLD_MARGIN / CELL);
    const cells = [];

    let colFrom = Math.floor(x1 / CELL);
    let colTo   = (x2 > x1) ? Math.ceil(x2 / CELL) - 1 : colFrom;
    let rowFrom = Math.floor(y1 / CELL);
    let rowTo   = (y2 > y1) ? Math.ceil(y2 / CELL) - 1 : rowFrom;

    colFrom = Math.max(colFrom, -maxCells);
    colTo   = Math.min(colTo,   maxCells);
    rowFrom = Math.max(rowFrom, -maxCells);
    rowTo   = Math.min(rowTo,   maxCells);

    for (let col = colFrom; col <= colTo; col++) {
      for (let row = rowFrom; row <= rowTo; row++) {
        if (isCellTaken(col, row)) continue;        // 已有座位则跳过
        cells.push({ col, row });
      }
    }
    return cells;
  }

  export function removeSeat(seat) {
    if (!seat) return;
    seat.el.remove();
    setSeats(seats.filter(s => s !== seat));
    manualSelected.delete(seat.id);
    nameBySeatId.delete(seat.id);
    updateEmpty();
    renderGroups();
    updateSeatCountHint();
    renderGroupPanel();
  }

  export function moveSeatEl(seat) {
    seat.el.style.left = seat.x + 'px';
    seat.el.style.top  = seat.y + 'px';
  }

  export function updateEmpty() {
    // 排座模式下有提示卡兜底，不再显示"从下方拖拽"的空状态文案
    canvas.classList.toggle('empty',
      editMode && seats.length === 0 && !notice.classList.contains('show'));
  }

  export function updateSeatCountHint() {
    if (!editMode) {
      const arranged = seats.filter(s => nameBySeatId.get(s.id)).length;
      const empty = seats.length - arranged;
      seatCountHint.textContent = '已排座 ' + arranged + ' / ' + seats.length
        + (empty > 0 ? '（' + empty + ' 个空座）' : '');
      seatCountHint.className = 'tb-hint' + (seats.length && empty === 0 ? ' ok' : '');
      syncTabState();
      return;
    }
    const need = listItems.length;
    const have = seats.length;
    const extra = have - need;
    const ok = need > 0 && seatsFit(have, need);
    seatCountHint.innerHTML = '座位 <b>' + have + '</b> / 名单 <b>' + need + '</b>'
      + (extra > 0 ? '（' + extra + ' 空座）' : '')
      + (ok ? ' ✓' : '');
    seatCountHint.className = 'tb-hint' + (ok ? ' ok' : (have ? ' bad' : ''));
    saveBtn.disabled = !ok;
    syncTabState();
  }
