/* ==========================================================================
 * 易排座 · 格局与结果序列化：layout / arrangement 读写、吸附、按名单补齐座位
 * 拆分自原 index.html 内联脚本，逻辑逐字保留。
 * ========================================================================== */

import {
  CELL, FILL_COLS, MAX_SCALE, MIN_SCALE, PAD, allowEmptyBtn, allowEmptySeats, canvas, chart, clamp,
  editMode, gridAlign, gridSwitchWrap, groupSeq, groups, listItems, nameBySeatId, offsetX, offsetY,
  roleByName, scale, seats, setGroupSeq, setGroups, setHighlightedGroupId, setNameBySeatId,
  setOffsetX, setOffsetY, setRoleByName, setScale, setSeats, writeGridAlign
} from './state.js';
import { applyTransform, fitToContent } from './viewport.js';
import {
  createSeatAtCell, createSeatEl, findFreeCell, isCellTaken, moveSeatEl, paintSeat, updateEmpty,
  updateSeatCountHint
} from './seat.js';
import { renderGroupPanel, renderGroups } from './group.js';
import { toast } from './ui.js';
import { markLayoutSaved } from './mode.js';

  /* ================================================================
   *  网格对齐开关
   * ================================================================ */

  export function setGridAlign(on) {
    writeGridAlign(on);
    gridSwitchWrap.classList.toggle('on', on);
    canvas.classList.toggle('grid-bg', on);

    if (on) {
      seats.forEach(s => { s.col = null; s.row = null; });
      seats.forEach(s => {
        const cell = findFreeCell(s.x, s.y, s);
        if (cell) {
          s.col = cell.col;
          s.row = cell.row;
          s.x = s.col * CELL + PAD;
          s.y = s.row * CELL + PAD;
          moveSeatEl(s);
        }
      });
      renderGroups();
    } else {
      seats.forEach(s => { s.col = null; s.row = null; });
    }
  }

  /* ================================================================
   *  「允许空座」开关（与 EasyCore 控制台同一个字段 seat_charts.allow_empty）
   *  开启：座位数可以多于名单人数，多出来的座位排座后显示为「空座」
   *  关闭：座位数必须正好等于名单人数（旧规则）
   * ================================================================ */

  export function refreshAllowEmptyBtn() {
    const on = allowEmptySeats();
    allowEmptyBtn.classList.toggle('on', on);
    const t = allowEmptyBtn.querySelector('.rb-txt');
    if (t) t.textContent = on ? '允许空座' : '仅满座';
    allowEmptyBtn.title = on
      ? '当前允许座位数多于名单人数（多出来的算空座），点击改为「仅满座」'
      : '当前要求座位数正好等于名单人数，点击改为「允许空座」';
    allowEmptyBtn.disabled = !chart;
  }

  export function fillSeatsToMatchList() {
    if (!editMode) return;
    const need = listItems.length;
    if (!need) { toast('绑定的名单里还没有学生', true); return; }
    if (seats.length >= need) {
      toast(seats.length === need
        ? '座位数量已经和名单人数一致'
        : '现有座位（' + seats.length + '）已不少于名单人数（' + need + '），无需再铺');
      return;
    }

    let placed = 0;
    let row = 0, col = 0;
    // 从左上角开始按行扫描，跳过已被占用的格子
    while (seats.length < need && row < 400) {
      if (!isCellTaken(col, row)) {
        createSeatAtCell(col, row);
        placed++;
      }
      col++;
      if (col >= FILL_COLS) { col = 0; row++; }
    }

    renderGroups();
    renderGroupPanel();
    updateSeatCountHint();
    fitToContent();
    toast('已铺好 ' + placed + ' 个座位（共 ' + seats.length + ' 个），拖动微调后点「保存」');
  }

  /* ================================================================
   *  布局 <-> 云端数据
   * ================================================================ */

  export function clearLayout() {
    seats.forEach(s => s.el.remove());
    setSeats([]);
    setGroups([]);
    setNameBySeatId(new Map());
    setRoleByName(new Map());
    setHighlightedGroupId(null);
    updateEmpty();
    updateSeatCountHint();
    renderGroupPanel();
  }

  // 把云端 layout 还原到画布
  export function applyLayout(layout) {
    clearLayout();
    if (!layout) { markLayoutSaved(); return; }

    const rawGroups = layout.groups || [];
    rawGroups.forEach(g => {
      const gid = parseInt(g.id, 10);
      if (!gid || groups.some(x => x.id === gid)) return;
      groups.push({ id: gid, name: String(g.name || ('小组 ' + gid)), color: g.color || '#e57373' });
      if (gid > groupSeq) setGroupSeq(gid);
    });

    const rawSeats = layout.seats || [];
    rawSeats.forEach(s => {
      const x = Number(s.x), y = Number(s.y);
      if (!isFinite(x) || !isFinite(y)) return;
      const seat = createSeatEl(x, y, (s.col === null || s.col === undefined) ? null : s.col,
                               (s.row === null || s.row === undefined) ? null : s.row,
                               parseInt(s.id, 10) || null);
      const gid = parseInt(s.group, 10);
      seat.groupId = groups.some(g => g.id === gid) ? gid : null;
    });

    // 网格对齐状态：对齐时按格子重新吸附（线上保存时坐标本就是吸附值，这里幂等）
    writeGridAlign(!!layout.gridAlign);
    gridSwitchWrap.classList.toggle('on', gridAlign);
    canvas.classList.toggle('grid-bg', gridAlign);
    if (gridAlign) {
      seats.forEach(s => {
        const cell = findFreeCell(s.x, s.y, s);
        if (cell) {
          s.col = cell.col;
          s.row = cell.row;
          s.x = s.col * CELL + PAD;
          s.y = s.row * CELL + PAD;
          moveSeatEl(s);
        }
      });
    }

    renderGroups();
    renderGroupPanel();
    updateSeatCountHint();

    // 视图（缩放 / 平移）随布局保存，老师下次进来位置一致
    const view = layout.view || {};
    if (isFinite(view.scale) && view.scale > 0) {
      setScale(clamp(Number(view.scale), MIN_SCALE, MAX_SCALE));
      setOffsetX(Number(view.offsetX) || 0);
      setOffsetY(Number(view.offsetY) || 0);
      applyTransform();
    } else {
      fitToContent(true);
    }
    markLayoutSaved();
  }

  export function collectLayout() {
    return {
      gridAlign: gridAlign,
      view: { scale: scale, offsetX: offsetX, offsetY: offsetY },
      groups: groups.map(g => ({ id: g.id, name: g.name, color: g.color })),
      seats: seats.map(s => ({
        id: s.id, x: s.x, y: s.y, col: s.col, row: s.row,
        group: s.groupId === undefined ? null : s.groupId
      }))
    };
  }

  export function applyArrangement(arrangement) {
    setNameBySeatId(new Map());
    setRoleByName(new Map());
    const raw = (arrangement && arrangement.seats) || {};
    Object.keys(raw).forEach(k => {
      const sid = parseInt(k, 10);
      const name = raw[k];
      if (sid) nameBySeatId.set(sid, name || '');
    });
    // 职位：姓名 -> 职位（与座位无关，换座后仍跟着人走）
    const roles = new Map();
    const rawRoles = (arrangement && arrangement.roles) || {};
    Object.keys(rawRoles).forEach(k => {
      const name = String(k || '').trim();
      const role = String(rawRoles[k] || '').trim();
      if (name && role) roles.set(name, role);
    });
    setRoleByName(roles);
    seats.forEach(paintSeat);
    updateSeatCountHint();
  }

  export function collectArrangement() {
    const out = {};
    seats.forEach(s => {
      const name = nameBySeatId.get(s.id);
      if (name) out[String(s.id)] = name;
    });
    const result = { seats: out };
    const roles = {};
    roleByName.forEach((role, name) => {
      if (name && role) roles[name] = role;
    });
    if (Object.keys(roles).length) result.roles = roles;
    return result;
  }
