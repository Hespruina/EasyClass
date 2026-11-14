/* ==========================================================================
 * 易排座 · 模式与生命周期：排座位 ⇄ 格局编辑切换、脏检查、保存与离开
 * 拆分自原 index.html 内联脚本，逻辑逐字保留。
 * ========================================================================== */

import {
  CONSOLE_URL, allowEmptySeats, arrangeBtn, backBtn, bottomBar, canvas, chart, chartList,
  chartSelect, cloudLoaded, dragSwap, editMode, gridAlign, groups, leavingForConsole, listItems,
  manualGrouping, nameBySeatId, opHintMouse, opHintTouch, reloadBtn, ribbon, savedLayoutSignature,
  seatCountHint, seats, seatsFit, setChart, setCloudLoaded, setEditMode, setLeavingForConsole,
  setManualSeating, setNameBySeatId, setSavedLayoutSignature, tabLayout, tabSeat
} from './state.js';
import { paintSeat, updateEmpty, updateSeatCountHint } from './seat.js';
import { closeGroupPanel, endManualGrouping, renderGroupPanel } from './group.js';
import { closeMenu } from './menu.js';
import { applyLayout, collectArrangement, collectLayout, refreshAllowEmptyBtn } from './layout.js';
import { apiPost, loadChart } from './api.js';
import { hideLoading, hideNotice, showLoading, toast } from './ui.js';
import { cancelSwap, clearSwapHint, closeNamePicker, setPickedSeat } from './swap.js';
import { endSeatDrag } from './drag.js';

  // 格局指纹：只比座位、分组、吸附，不含缩放平移（否则拖一下画布就算被改过）
  export function layoutSignature() {
    const l = collectLayout();
    return JSON.stringify({ g: l.gridAlign, gr: l.groups, s: l.seats });
  }

  export function markLayoutSaved() { setSavedLayoutSignature(layoutSignature()); }

  export function layoutDirty() { return layoutSignature() !== savedLayoutSignature; }

  // 切模式时保留已排好的姓名（座位 id 来自 layout，映射关系不变）
  export function reapplyKeepNames(layout) {
    const keepNames = nameBySeatId;
    applyLayout(layout);
    setNameBySeatId(keepNames);
    seats.forEach(paintSeat);
    updateSeatCountHint();
  }

  // 收起排座态的临时选中态 / 菜单 / 选人面板
  export function clearSeatingSelection() {
    if (dragSwap) endSeatDrag(false);   // 拖动中途被打断（切模式 / 换表）：影子要收掉
    cancelSwap(true);
    clearSwapHint();
    closeNamePicker();
    closeMenu();
    setPickedSeat(null);
  }

  // 选项卡可用状态：座位坐得下名单人数才允许排座（允许空座时座位可以多于人数）
  export function syncTabState() {
    const hasChart = !!chart;
    tabLayout.disabled = !hasChart;
    tabSeat.disabled = !hasChart || !listItems.length || !seatsFit(seats.length, listItems.length);
  }

  // 刷新 / 分享时停在同一个选项卡
  export function syncUrlMode() {
    const url = new URL(window.location.href);
    if (editMode) url.searchParams.set('mode', 'edit_cloud_seats_set');
    else url.searchParams.delete('mode');
    history.replaceState(null, '', url.toString());
  }

  // 返回 false 表示这次切换没做成（界面已复位到原模式）
  export function switchMode(nextEdit, opts) {
    const silent = !!(opts && opts.silent);
    if (!!nextEdit === editMode) { applyModeUI(); return true; }

    if (nextEdit) {
      // ---- 切到格局编辑 ----
      clearSeatingSelection();
      closeGroupPanel();
      setEditMode(true);

      if (!chart) { applyModeUI(); return true; }

      // 格局还没设定 / 人数不一致也要能进来摆座位，不能把人拦在提示页
      reapplyKeepNames(chart.has_layout ? chart.layout : null);
      hideNotice();
      setCloudLoaded(true);
      applyModeUI();
      syncUrlMode();

      if (!chart.has_layout) {
        toast('请摆放' + (allowEmptySeats() ? '至少 ' : '正好 ') + listItems.length
              + ' 个座位，点「保存格局」后即可排座');
      } else if (!seatsFit(seats.length, listItems.length)) {
        toast('座位 ' + seats.length + ' / 名单 ' + listItems.length + '，'
              + (allowEmptySeats() ? '座位不够，需要补座位' : '该表设为「仅满座」，数量必须一致'), true);
      } else if (!silent) {
        toast('已进入格局编辑：拖动座位调整位置，改完点「保存格局」');
      }
      return true;
    }

    // ---- 切到排座位 ----
    if (!chart) { toast('请先选择一个座位表', true); applyModeUI(); return false; }
    if (!listItems.length) { toast('这个座位表绑定的名单里还没有学生', true); applyModeUI(); return false; }
    if (!seats.length || !seatsFit(seats.length, listItems.length)) {
      toast('座位 ' + seats.length + ' / 名单 ' + listItems.length + '，'
            + (allowEmptySeats() ? '座位不够，先去「格局编辑」补座位'
                                 : '该表设为「仅满座」，先去「格局编辑」调成一致'), true);
      applyModeUI();
      return false;
    }
    if (layoutDirty()) {
      const ok = window.confirm('格局还有未保存的改动。\n\n切到「排座位」会丢弃这些改动，要保留请先点「保存格局」。\n\n确定继续吗？');
      if (!ok) { applyModeUI(); return false; }
      reapplyKeepNames(chart.layout);
    }

    if (manualGrouping) endManualGrouping();
    clearSeatingSelection();
    setEditMode(false);
    hideNotice();
    setCloudLoaded(true);
    applyModeUI();
    syncUrlMode();
    if (!silent) toast('已切到手动排座：点座位可以选名字，或与同学换座');
    return true;
  }

  export function reloadChart(chartId) {
    setChart(null);
    setCloudLoaded(false);
    return loadChart(chartId);
  }

  // 返回 true = 可以离开，false = 用户选择留下
  export async function saveBeforeLeave() {
    if (!chart || !cloudLoaded) return true;   // 提示页 / 没加载成功：没有可保存的内容

    if (editMode) {
      if (!seats.length) return true;          // 空画布没有格局可存
      if (!seatsFit(seats.length, listItems.length)) {
        return window.confirm('当前格局不满足保存条件（座位 ' + seats.length
          + ' / 名单 ' + listItems.length + '），无法保存。\n\n仍要返回控制台吗？'
          + '未保存的格局改动会丢失。');
      }
      showLoading('正在保存格局…');
      try {
        const layout = collectLayout();
        await apiPost('/seat-charts/' + chart.chart_id + '/layout', { layout: layout });
        chart.layout = layout;
        chart.has_layout = true;
        chart.seat_count = seats.length;
        markLayoutSaved();
        return true;
      } catch (err) {
        hideLoading();
        return window.confirm('格局保存失败：' + ((err && err.message) || '网络异常')
          + '\n\n仍要返回控制台吗？未保存的格局改动会丢失。');
      }
    }

    showLoading('正在保存排座结果…');
    try {
      await apiPost('/seat-charts/' + chart.chart_id + '/arrangement',
                    { arrangement: collectArrangement() });
      return true;
    } catch (err) {
      hideLoading();
      return window.confirm('排座结果保存失败：' + ((err && err.message) || '网络异常')
        + '\n\n仍要返回控制台吗？');
    }
  }

  export async function goConsole() {
    if (leavingForConsole) return;
    setLeavingForConsole(true);
    backBtn.disabled = true;
    let ok = true;
    try {
      ok = await saveBeforeLeave();
    } catch (err) {
      ok = window.confirm('离开前保存失败：' + ((err && err.message) || '未知错误')
        + '\n\n仍要返回控制台吗？');
    } finally {
      hideLoading();
      setLeavingForConsole(false);
      backBtn.disabled = false;
    }
    if (ok) window.location.href = CONSOLE_URL;
  }

  // 当前模式的界面状态：选项卡、画布语义、状态栏提示
  export function applyModeUI() {
    const isLayout = editMode;
    setManualSeating(!isLayout);

    ribbon.dataset.mode = isLayout ? 'layout' : 'seat';
    tabSeat.classList.toggle('active', !isLayout);
    tabLayout.classList.toggle('active', isLayout);
    syncTabState();

    canvas.classList.toggle('view-mode', !isLayout);
    canvas.classList.toggle('pannable', !isLayout);
    canvas.classList.toggle('manual-seating', !isLayout);
    bottomBar.classList.toggle('view-mode', !isLayout);

    const hasChart = !!chart;
    reloadBtn.style.display = hasChart ? '' : 'none';
    backBtn.style.display = '';
    chartSelect.style.display = chartList.length ? '' : 'none';
    arrangeBtn.style.display = (!isLayout && hasChart) ? '' : 'none';
    seatCountHint.style.display = '';
    refreshAllowEmptyBtn();

    document.title = isLayout ? '易排座 · 格局编辑' : '易排座 · 手动排座';

    if (isLayout) {
      canvas.dataset.empty = '从「新座位」拖到画布，或点「一键铺座」按名单人数铺满';
      opHintMouse.innerHTML = '鼠标：<b>右键</b>空白 = 建座，<b>右键</b>座位 = 删除；<b>左键框选</b> = 建组 / 批量操作；<b>Ctrl+拖动</b> = 平移画布；<b>滚轮</b> = 缩放';
      opHintTouch.innerHTML = '触屏：单指拖座位 = 移动；空白单指拖 = 框选；双指拖动 = 平移，双指捏合 = 缩放';
      clearSeatingSelection();
    } else {
      canvas.dataset.empty = '该座位表还没有设定座位格局';
      opHintMouse.innerHTML = '鼠标：<b>点座位</b> = 选名字 / 换座；<b>拖动座位</b> = 互换（拖到空座 = 移过去）；拖动空白 = 平移；<b>滚轮</b> = 缩放';
      opHintTouch.innerHTML = '触屏：<b>轻点座位</b> = 选名字 / 换座；<b>单指拖座位</b> = 互换；单指拖空白 = 平移；双指捏合 = 缩放';
    }

    // 换模式必须重画所有座位文字：格局编辑态显示「座位」，排座态显示姓名 / 空座。
    // 少了这一句就会出现「切到格局编辑再切回来，座位上的名字全没了」的假象 ——
    // 数据一直在 nameBySeatId 里，只是文字没跟着模式刷新。
    seats.forEach(paintSeat);

    renderGroupPanel();   // 面板里的「改名 / 删除」按钮跟着模式走
    updateEmpty();
    updateSeatCountHint();
  }
