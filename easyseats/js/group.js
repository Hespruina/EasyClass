/* ==========================================================================
 * 易排座 · 分组：创建、重命名、解散、总览面板、手动分组
 * 拆分自原 index.html 内联脚本，逻辑逐字保留。
 * ========================================================================== */

import {
  GROUP_COLORS, SEAT, editMode, gpTitle, groupPanel, groupPanelBody, groupSeq, groups,
  highlightedGroupId, manualActions, manualGroupBtn, manualSelected, seats, setGroupSeq, setGroups,
  setHighlightedGroupId, setManualGrouping, world
} from './state.js';
import { escapeHtml } from './ui.js';
import { sortSeatsByPosition } from './arrange.js';
import { closeNamePicker } from './swap.js';

  /* ================================================================
   *  小组渲染
   * ================================================================ */

  export function renderGroups() {
    world.querySelectorAll('.group-frame').forEach(el => el.remove());

    groups.forEach(g => {
      const members = seats.filter(s => s.groupId === g.id);
      if (!members.length) return;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      members.forEach(s => {
        minX = Math.min(minX, s.x);
        minY = Math.min(minY, s.y);
        maxX = Math.max(maxX, s.x + SEAT);
        maxY = Math.max(maxY, s.y + SEAT);
      });

      const pad = 10;
      const frame = document.createElement('div');
      frame.className = 'group-frame' + (highlightedGroupId === g.id ? ' hl' : '');
      frame.style.left   = (minX - pad) + 'px';
      frame.style.top    = (minY - pad) + 'px';
      frame.style.width  = (maxX - minX + pad * 2) + 'px';
      frame.style.height = (maxY - minY + pad * 2) + 'px';
      frame.style.borderColor = g.color;

      const label = document.createElement('span');
      label.className = 'group-label';
      label.style.background = g.color;
      label.textContent = g.name;
      frame.appendChild(label);

      world.appendChild(frame);
    });

    seats.forEach(s => {
      const g = groups.find(x => x.id === s.groupId);
      // 分组标识改为描边换色 + 加粗（新风格为扁平描边，不用外发光圈）
      s.el.style.borderColor = g ? g.color : '';
      s.el.style.borderWidth = g ? '2px' : '';
    });
  }

  /* ================================================================
   *  小组增删改
   * ================================================================ */

  export function nextGroupColor() {
    for (let i = 0; i < GROUP_COLORS.length; i++) {
      const c = GROUP_COLORS[(groupSeq + i) % GROUP_COLORS.length];
      if (!groups.some(g => g.color === c)) return c;
    }
    return GROUP_COLORS[groupSeq % GROUP_COLORS.length];
  }

  export function createGroupFromSeats(list, name) {
    if (!list || !list.length) return null;
    setGroupSeq(groupSeq + 1);
    const g = {
      id: groupSeq,
      name: name || ('小组 ' + groupSeq),
      color: nextGroupColor()
    };
    groups.push(g);
    list.forEach(s => { s.groupId = g.id; });
    renderGroups();
    renderGroupPanel();
    return g;
  }

  // 原生 prompt 改名（座位右键菜单里用）
  export function renameGroupPrompt(g) {
    const n = prompt('请输入新的组名：', g.name);
    if (n !== null && n.trim() !== '') {
      g.name = n.trim();
      renderGroups();
      renderGroupPanel();
    }
  }

  export function renameGroup(g, newName) {
    const n = (newName || '').trim();
    if (!n) return false;
    g.name = n;
    renderGroups();
    renderGroupPanel();
    return true;
  }

  export function dissolveGroup(g) {
    seats.forEach(s => { if (s.groupId === g.id) s.groupId = null; });
    setGroups(groups.filter(x => x !== g));
    if (highlightedGroupId === g.id) setHighlightedGroupId(null);
    renderGroups();
    renderGroupPanel();
  }

  /* ================================================================
   *  小组总览面板
   * ================================================================ */

  export function groupMembersSorted(g) {
    return sortSeatsByPosition(seats.filter(s => s.groupId === g.id));
  }

  // 按「组内最靠前的座位」排序，让总览顺序与座位视觉顺序一致
  export function sortedGroups() {
    return groups.map(g => {
      const members = groupMembersSorted(g);
      return { g, members, key: members[0] || null };
    }).sort((a, b) => {
      if (!a.key) return 1;
      if (!b.key) return -1;
      return (a.key.y - b.key.y) || (a.key.x - b.key.x);
    }).map(x => ({ g: x.g, members: x.members }));
  }

  export function renderGroupPanel() {
    const rows = sortedGroups();
    gpTitle.textContent = '小组总览（' + rows.length + ' 组）';
    const ungrouped = seats.filter(s => !s.groupId || !groups.some(g => g.id === s.groupId)).length;

    if (!rows.length) {
      groupPanelBody.innerHTML = '<div class="gp-empty">还没有小组。<br>'
        + (editMode
            ? '编辑模式下：框选若干座位 → 点「设为小组」，或点「手动建组」逐个选中后点「完成」。'
            : '请到 EasyCore 控制台点这个座位表的「编辑」来建立小组。')
        + '</div>';
      return;
    }

    let html = '';
    rows.forEach(({ g, members }) => {
      html += '<div class="gp-row' + (highlightedGroupId === g.id ? ' hl' : '') + '" data-gid="' + g.id + '">'
        + '<span class="gp-dot" style="background:' + g.color + '"></span>'
        + '<span class="gp-name" data-role="name" title="点击高亮该组座位">' + escapeHtml(g.name) + '</span>'
        + '<span class="gp-count">' + members.length + ' 人</span>'
        + (editMode
            ? '<span class="gp-acts">'
              + '<button data-act="rename">改名</button>'
              + '<button data-act="del" class="del">删除</button>'
              + '</span>'
            : '')
        + '</div>';
    });
    if (ungrouped) {
      html += '<div class="gp-row" data-gid="0"><span class="gp-dot" style="background:#555"></span>'
        + '<span class="gp-name">未分组</span><span class="gp-count">' + ungrouped + ' 人</span></div>';
    }
    if (editMode) {
      html += '<div class="gp-empty">点组名可高亮该组座位；点「改名」可快速修改组名。</div>';
    }
    groupPanelBody.innerHTML = html;
  }

  export function openGroupPanel() {
    closeNamePicker();          // 两个面板都在右侧，避免叠在一起
    groupPanel.classList.add('show');
    renderGroupPanel();
  }

  export function closeGroupPanel() {
    groupPanel.classList.remove('show');
  }

  export function highlightGroupId(gid) {
    setHighlightedGroupId((highlightedGroupId === gid) ? null : gid);
    seats.forEach(s => s.el.classList.toggle('hl', !!highlightedGroupId && s.groupId === highlightedGroupId));
    groupPanelBody.querySelectorAll('.gp-row').forEach(r => {
      r.classList.toggle('hl', parseInt(r.dataset.gid, 10) === highlightedGroupId);
    });
    renderGroups();
  }

  // 行内改名：把组名换成输入框，回车/失焦提交，Esc 取消
  export function startInlineRename(row, g) {
    const nameEl = row.querySelector('[data-role="name"]');
    if (!nameEl) return;
    const input = document.createElement('input');
    input.className = 'gp-name-input';
    input.value = g.name;
    input.maxLength = 20;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const commit = (save) => {
      if (done) return;
      done = true;
      if (save) renameGroup(g, input.value);
      else renderGroupPanel();
    };
    input.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); commit(true); }
      else if (ev.key === 'Escape') { ev.preventDefault(); commit(false); }
    });
    input.addEventListener('blur', () => commit(true));
    input.addEventListener('mousedown', ev => ev.stopPropagation());
    input.addEventListener('click', ev => ev.stopPropagation());
  }

  /* ================================================================
   *  手动建组模式
   * ================================================================ */

  // 功能区按钮的图标在 .rb-ico 里，只能换 .rb-txt 这段文字
  export function setManualGroupLabel(text) {
    const t = manualGroupBtn.querySelector('.rb-txt');
    if (t) t.textContent = text;
  }

  export function toggleManualSelect(seat) {
    if (manualSelected.has(seat.id)) {
      manualSelected.delete(seat.id);
      seat.el.classList.remove('selected');
    } else {
      manualSelected.add(seat.id);
      seat.el.classList.add('selected');
    }
  }

  export function startManualGrouping() {
    setManualGrouping(true);
    manualSelected.clear();
    seats.forEach(s => s.el.classList.remove('selected'));
    manualGroupBtn.classList.add('on');
    setManualGroupLabel('选择中…');
    manualActions.style.display = 'flex';
  }

  export function endManualGrouping() {
    setManualGrouping(false);
    manualSelected.clear();
    seats.forEach(s => s.el.classList.remove('selected'));
    manualGroupBtn.classList.remove('on');
    setManualGroupLabel('手动建组');
    manualActions.style.display = 'none';
  }
