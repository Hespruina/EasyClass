/* ==========================================================================
 * 易排座 · 入口：事件绑定与启动
 * 拆分自原 index.html 内联脚本，逻辑逐字保留。
 * ========================================================================== */

import {
  MAX_SCALE, MIN_SCALE, SAVE_LABEL, SEAT, allowEmptyBtn, allowEmptySeats, arrangeBtn, backBtn,
  bootToastShown, cancelBtn, canvas, chart, chartList, chartSelect, clamp, clearNamesBtn,
  cloudLoaded, currentMenu, editMode, exportBtn, fillSeatsBtn, finishBtn, gridAlign,
  gridSwitchWrap, groupOverviewBtn, groupPanel, groupPanelBody, groupPanelClose, groups,
  initChartId, listItems, manualGroupBtn, manualGrouping, manualSeating, manualSelected, marquee,
  namePickerClose, noticeGoBtn, noticeReloadBtn, npBody, npCurrent, npSearch, offsetX, offsetY,
  pickerSeat, pinch, reloadBtn, saveBtn, scale, seatSource, seats, seatsFit, setBootToastShown,
  setChart, setChartList, setListItems, setMarquee, setOffsetX, setOffsetY, setPinch, setSaveLabel,
  setScale, setTwoFinger, tabLayout, tabSeat, touchPan, twoFinger
} from './state.js';
import {
  abortSingleTouch, applyTransform, onTouchEnd, pinchAnchor, screenToWorld, startTouchPan, zoomAt
} from './viewport.js';
import { addSeat, updateEmpty, updateSeatCountHint } from './seat.js';
import {
  closeGroupPanel, createGroupFromSeats, dissolveGroup, endManualGrouping, highlightGroupId,
  openGroupPanel, renderGroupPanel, startInlineRename, startManualGrouping
} from './group.js';
import { closeMenu, showMenu } from './menu.js';
import { createMarquee } from './marquee.js';
import {
  clearLayout, collectLayout, fillSeatsToMatchList, refreshAllowEmptyBtn, setGridAlign
} from './layout.js';
import { apiPost, apiPut, loadChart, loadChartList, renderChartSelect } from './api.js';
import { busyToast, escapeHtml, hideLoading, hideNotice, showLoading, showNotice, toast } from './ui.js';
import { arrangeAndSave } from './arrange.js';
import {
  assignNameToSeat, cancelSwap, clearAllNames, closeNamePicker, renderNamePicker, setPickedSeat
} from './swap.js';
import { exportSeatImage } from './export.js';
import { applyModeUI, goConsole, markLayoutSaved, reloadChart, switchMode } from './mode.js';
  setSaveLabel(saveBtn.innerHTML);

  /* ================================================================
   *  屏蔽浏览器手势（左键 / 右键 / 中键一视同仁）
   * ================================================================ */

  ['dragstart', 'drag', 'selectstart', 'contextmenu', 'auxclick',
   'gesturestart', 'gesturechange', 'gestureend'].forEach(ev => {
    document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  });

  document.addEventListener('mousedown', e => {
    const t = e.target;
    if (t instanceof Element && t.closest('input, textarea, select, [contenteditable], button, a')) return;
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('wheel', e => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });

  window.addEventListener('keydown', e => {
    if (e.ctrlKey && ['+', '-', '=', '_', '0'].indexOf(e.key) >= 0) e.preventDefault();
  }, { passive: false });

  /* ================================================================
   *  缩放交互
   * ================================================================ */

  // 滚轮直接缩放：不用按 Ctrl（触控板双指滑动 / 捏合同样走这里）
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    // deltaMode: 1 = 按行（Firefox 等），2 = 按页；统一折算成像素，避免灵敏度差几十倍
    const unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? canvas.clientHeight : 1);
    const factor = Math.exp(-e.deltaY * unit * 0.0015);
    zoomAt(e.clientX, e.clientY, scale * factor);
  }, { passive: false });

  canvas.addEventListener('touchstart', e => {
    const n = e.touches.length;

    // ---- 双指：接手平移 / 缩放 ----
    if (n >= 2) {
      e.preventDefault();
      abortSingleTouch();
      setTwoFinger(true);
      setPinch(pinchAnchor(e.touches));
      return;
    }

    // 双指之后剩下的单指不接管，等全部抬起（否则一松手就变成框选）
    if (twoFinger) return;
    if (n !== 1) return;

    const t = e.changedTouches[0];
    if (!t || t.target !== canvas) return;   // 落在座位 / 底栏上：不在这里处理

    // 吃掉默认行为，浏览器就不会再合成 mouse 事件，一次触摸只走一套逻辑
    e.preventDefault();
    closeMenu();

    if (editMode) {
      setMarquee(createMarquee(t.clientX, t.clientY));
    } else {
      startTouchPan(t.clientX, t.clientY);
      canvas.classList.add('panning');
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    const n = e.touches.length;

    // ---- 双指：平移 + 缩放 ----
    if (n >= 2) {
      e.preventDefault();
      if (!pinch) setPinch(pinchAnchor(e.touches));

      const a = e.touches[0], b = e.touches[1];
      const dist = Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY));
      const midX = (a.clientX + b.clientX) / 2;
      const midY = (a.clientY + b.clientY) / 2;

      const r  = canvas.getBoundingClientRect();
      const px = midX - r.left;
      const py = midY - r.top;
      // 起始中点在「当时的缩放 / 偏移」下对应的世界坐标，捏合全程钉住它
      const wx = (pinch.midX - r.left - pinch.ox) / pinch.scale;
      const wy = (pinch.midY - r.top  - pinch.oy) / pinch.scale;

      setScale(clamp(pinch.scale * (dist / pinch.dist), MIN_SCALE, MAX_SCALE));
      setOffsetX(px - wx * scale);
      setOffsetY(py - wy * scale);

      applyTransform();
      return;
    }

    // ---- 单指：框选 / 平移 ----
    if (n === 1 && marquee) {
      const t = e.touches[0];
      marquee.moveTo(t.clientX, t.clientY);
      if (marquee.moved) e.preventDefault();
    } else if (n === 1 && touchPan) {
      const t = e.touches[0];
      e.preventDefault();
      touchPan.moveTo(t.clientX, t.clientY);
    }
  }, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);
  canvas.addEventListener('touchcancel', onTouchEnd);

  /* ================================================================
   *  从底栏拖出新座位（仅编辑模式）
   * ================================================================ */

  seatSource.addEventListener('mousedown', e => {
    if (!editMode) return;
    if (e.button !== 0) return;
    e.preventDefault();

    const ghost = document.createElement('div');
    ghost.className = 'ghost';
    ghost.textContent = '座位';
    document.body.appendChild(ghost);

    function place(ev) {
      ghost.style.left = (ev.clientX - SEAT / 2) + 'px';
      ghost.style.top  = (ev.clientY - SEAT / 2) + 'px';
    }
    place(e);

    function onMove(ev) { place(ev); }

    function onUp(ev) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      ghost.remove();

      const r = canvas.getBoundingClientRect();
      if (ev.clientX >= r.left && ev.clientX <= r.right &&
          ev.clientY >= r.top  && ev.clientY <= r.bottom) {
        const w = screenToWorld(ev.clientX, ev.clientY);
        addSeat(w.x - SEAT / 2, w.y - SEAT / 2);
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  seatSource.addEventListener('touchstart', e => {
    if (!editMode) return;
    if (e.touches.length !== 1) return;
    e.preventDefault();

    const ghost = document.createElement('div');
    ghost.className = 'ghost';
    ghost.textContent = '座位';
    document.body.appendChild(ghost);

    function place(t) {
      ghost.style.left = (t.clientX - SEAT / 2) + 'px';
      ghost.style.top  = (t.clientY - SEAT / 2) + 'px';
    }
    place(e.changedTouches[0]);

    function onMove(ev) {
      if (ev.touches.length !== 1) return;
      ev.preventDefault();
      place(ev.changedTouches[0]);
    }

    function onEnd(ev) {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      ghost.remove();

      const t = ev.changedTouches[0];
      if (!t) return;
      const r = canvas.getBoundingClientRect();
      if (t.clientX >= r.left && t.clientX <= r.right &&
          t.clientY >= r.top  && t.clientY <= r.bottom) {
        const w = screenToWorld(t.clientX, t.clientY);
        addSeat(w.x - SEAT / 2, w.y - SEAT / 2);
      }
    }

    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
  }, { passive: false });

  groupOverviewBtn.addEventListener('click', () => {
    if (groupPanel.classList.contains('show')) closeGroupPanel();
    else openGroupPanel();
  });
  groupPanelClose.addEventListener('click', closeGroupPanel);

  // 面板内交互（事件委托）：点行高亮 / 改名 / 删除
  groupPanelBody.addEventListener('click', e => {
    const row = e.target.closest('.gp-row');
    if (!row) return;
    const gid = parseInt(row.dataset.gid, 10);
    const act = e.target.dataset ? e.target.dataset.act : null;

    if (act === 'del') {
      const g = groups.find(x => x.id === gid);
      if (g) dissolveGroup(g);
      return;
    }
    if (act === 'rename') {
      const g = groups.find(x => x.id === gid);
      if (g) startInlineRename(row, g);
      return;
    }
    if (gid === 0) return;   // 「未分组」不参与高亮
    highlightGroupId(gid);
  });

  document.addEventListener('mousedown', e => {
    if (currentMenu && !currentMenu.contains(e.target)) closeMenu();
  }, true);

  /* ================================================================
   *  画布鼠标交互
   *   编辑模式：右键建座、Ctrl+左键平移、左键框选
   *   排座模式：左键 / 中键拖动 = 平移画布（不修改布局）
   * ================================================================ */

  canvas.addEventListener('mousedown', e => {
    // ---- 排座模式：任何按键都只做平移（布局只能在编辑模式里改） ----
    if (!editMode) {
      if (e.button !== 0 && e.button !== 1) return;
      const t = e.target;
      const onSeat = t instanceof Element && t.classList.contains('seat');
      if (t !== canvas && !onSeat) return;   // 底栏 / 面板等不参与平移
      e.preventDefault();
      closeMenu();
      // 手动排座下点空白处：取消进行中的换座 / 关掉选人面板
      if (manualSeating && !onSeat) {
        cancelSwap(true);
        closeNamePicker();
        setPickedSeat(null);
      }
      const startX = e.clientX, startY = e.clientY;
      const ox = offsetX, oy = offsetY;
      canvas.classList.add('panning');

      function onPanMove(ev) {
        setOffsetX(ox + (ev.clientX - startX));
        setOffsetY(oy + (ev.clientY - startY));
        applyTransform();
      }
      function onPanUp() {
        document.removeEventListener('mousemove', onPanMove);
        document.removeEventListener('mouseup', onPanUp);
        canvas.classList.remove('panning');
      }
      document.addEventListener('mousemove', onPanMove);
      document.addEventListener('mouseup', onPanUp);
      return;
    }

    if (e.target !== canvas) return;

    // ---- 右键：快速新建座位 ----
    if (e.button === 2) {
      e.preventDefault();
      closeMenu();
      const w = screenToWorld(e.clientX, e.clientY);
      addSeat(w.x - SEAT / 2, w.y - SEAT / 2);
      return;
    }

    if (e.button !== 0) return;

    // ---- Ctrl + 左键：平移画布 ----
    if (e.ctrlKey) {
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      const ox = offsetX, oy = offsetY;

      function onMove(ev) {
        setOffsetX(ox + (ev.clientX - startX));
        setOffsetY(oy + (ev.clientY - startY));
        applyTransform();
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        canvas.style.cursor = 'crosshair';
      }
      canvas.style.cursor = 'grabbing';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      return;
    }

    // ---- 普通左键：框选 ----
    e.preventDefault();
    closeMenu();

    const mq = createMarquee(e.clientX, e.clientY);

    function onMove(ev) { mq.moveTo(ev.clientX, ev.clientY); }

    function onUp(ev) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      mq.finish(ev.clientX, ev.clientY);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  manualGroupBtn.addEventListener('click', () => {
    if (manualGrouping) endManualGrouping();
    else startManualGrouping();
  });

  finishBtn.addEventListener('click', () => {
    const sel = seats.filter(s => manualSelected.has(s.id));
    if (sel.length) createGroupFromSeats(sel);
    endManualGrouping();
  });

  cancelBtn.addEventListener('click', endManualGrouping);

  gridSwitchWrap.addEventListener('click', () => {
    if (!editMode) return;
    setGridAlign(!gridAlign);
  });

  allowEmptyBtn.addEventListener('click', async () => {
    if (!chart) { toast('请先选择一个座位表', true); return; }
    const next = !allowEmptySeats();
    allowEmptyBtn.disabled = true;
    try {
      const data = await apiPut('/seat-charts/' + chart.chart_id, { allow_empty: next });
      chart.allow_empty = (data && data.seat_chart) ? (data.seat_chart.allow_empty !== false) : next;
      const item = chartList.find(c => c.chart_id === chart.chart_id);
      if (item) item.allow_empty = chart.allow_empty;
      renderChartSelect(chart.chart_id);
      toast(next ? '已允许空座：座位数可以多于名单人数'
                 : '已改为「仅满座」：座位数必须正好等于名单人数');
      if (!next && seats.length !== listItems.length) {
        toast('当前座位 ' + seats.length + ' / 名单 ' + listItems.length
              + '，需要删掉多余的座位才能保存格局', true);
      }
    } catch (err) {
      toast(err.message || '切换失败', true);
    } finally {
      refreshAllowEmptyBtn();
      updateSeatCountHint();
    }
  });

  fillSeatsBtn.addEventListener('click', fillSeatsToMatchList);

  arrangeBtn.addEventListener('click', () => {
    const r = arrangeBtn.getBoundingClientRect();
    showMenu(r.left, r.bottom + 6, [
      { label: '全班随机排座', onClick: () => arrangeAndSave('all') },
      { label: '组内随机排座', onClick: () => arrangeAndSave('group') },
      { label: '共 ' + seats.length + ' 个座位 / ' + listItems.length + ' 人', note: true }
    ]);
  });

  npBody.addEventListener('click', e => {
    const item = e.target && e.target.closest ? e.target.closest('.np-item') : null;
    if (!item || !pickerSeat) return;
    const seat = pickerSeat;
    const name = npCurrent[parseInt(item.dataset.idx, 10)];
    closeNamePicker();
    if (name) assignNameToSeat(seat, name);
  });
  npSearch.addEventListener('input', renderNamePicker);
  namePickerClose.addEventListener('click', closeNamePicker);

  tabSeat.addEventListener('click', () => { if (!tabSeat.disabled) switchMode(false); });
  tabLayout.addEventListener('click', () => { if (!tabLayout.disabled) switchMode(true); });

  clearNamesBtn.addEventListener('click', clearAllNames);
  exportBtn.addEventListener('click', exportSeatImage);

  reloadBtn.addEventListener('click', () => {
    if (chart) reloadChart(chart.chart_id);
    else boot();
  });

  chartSelect.addEventListener('change', () => {
    const id = parseInt(chartSelect.value, 10);
    if (id) reloadChart(id);
  });

  /* ================================================================
   *  格局编辑：保存（留在原地，方便直接切去排座位）
   * ================================================================ */

  saveBtn.addEventListener('click', async () => {
    if (!chart) { toast('没有可保存的座位表', true); return; }
    if (!seatsFit(seats.length, listItems.length)) {
      toast(allowEmptySeats()
        ? '座位数量（' + seats.length + '）不能少于名单人数（' + listItems.length + '）'
        : '该座位表设为「仅满座」，座位数量（' + seats.length + '）必须等于名单人数（' + listItems.length + '）',
        true);
      return;
    }
    if (!seats.length) { toast('请先摆放座位', true); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = '保存中…';
    busyToast('正在保存格局…');
    try {
      const layout = collectLayout();
      await apiPost('/seat-charts/' + chart.chart_id + '/layout', { layout: layout });
      chart.layout = layout;
      chart.has_layout = true;
      chart.seat_count = seats.length;
      markLayoutSaved();
      toast(seatsFit(seats.length, listItems.length)
        ? '格局已保存，点顶部「排座位」就能开始排座'
        : '已保存');
    } catch (err) {
      toast(err.message || '保存失败，请重试', true);
      if (err.payload && err.payload.list_item_count !== undefined) {
        setListItems(listItems.slice(0, err.payload.list_item_count));
      }
    } finally {
      saveBtn.innerHTML = SAVE_LABEL;
      updateSeatCountHint();
    }
  });

  backBtn.addEventListener('click', goConsole);

  // 统一入口：拉座位表列表 → 加载 → 按 editMode 组装界面
  export async function boot() {
    showLoading('加载座位表…');
    try {
      const pick = await loadChartList(initChartId);
      hideLoading();
      if (!pick) {
        setChart(null);
        setChartList([]);
        clearLayout();
        applyModeUI();
        showNotice('还没有座位表',
          '请先到 EasyCore 控制台的「座位表」页创建一个座位表（创建时要选择它使用的名单），'
          + '再点该座位表的「编辑」进来摆座位。', true, '返回控制台');
        return;
      }
      await loadChart(pick);
      applyModeUI();
      if (!editMode && cloudLoaded && !bootToastShown) {
        setBootToastShown(true);
        toast('已在手动排座模式：点座位可以选择名字，或与其他同学换座');
      }
    } catch (err) {
      hideLoading();
      applyModeUI();
      showNotice('加载失败', escapeHtml(err.message || '请稍后重试'), false);
    }
  }

  noticeGoBtn.addEventListener('click', () => {
    hideNotice();
    if (chart) switchMode(true);                       // 有座位表：原地切到格局编辑
    else goConsole();                                  // 没有座位表：走同一条「先保存再返回」的出口
  });
  noticeReloadBtn.addEventListener('click', () => {
    hideNotice();
    if (chart) reloadChart(chart.chart_id);
    else boot();
  });

  /* ================================================================
   *  窗口尺寸变化
   * ================================================================ */

  window.addEventListener('resize', () => {
    applyTransform();
  });

  /* ================================================================
   *  初始化
   * ================================================================ */

  if (!editMode) {
    // 排座模式：空白处单指/拖动平移，需要抓手光标
    canvas.classList.add('view-mode', 'pannable');
  }
  setGridAlign(true);
  applyTransform();
  applyModeUI();
  updateEmpty();
  updateSeatCountHint();
  renderGroupPanel();

  boot();
