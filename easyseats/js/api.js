/* ==========================================================================
 * 易排座 · 云端接口：请求封装、座位表列表 / 加载、呈现
 * 拆分自原 index.html 内联脚本，逻辑逐字保留。
 * ========================================================================== */

import {
  API_BASE, allowEmptySeats, chart, chartList, chartSelect, editMode, listItems, seatsFit,
  seatsFitFor, setChart, setChartList, setCloudLoaded, setListItems
} from './state.js';
import { applyArrangement, applyLayout, clearLayout } from './layout.js';
import { escapeHtml, hideLoading, hideNotice, showLoading, showNotice, toast } from './ui.js';
import { applyModeUI, clearSeatingSelection } from './mode.js';

  /* ================================================================
   *  云端接口
   * ================================================================ */

  export async function apiGet(path) {
    const res = await fetch(API_BASE + path, { credentials: 'same-origin' });
    if (!res.ok) {
      let msg = '请求失败（' + res.status + '）';
      try { const d = await res.json(); if (d.error) msg = d.error; } catch (e) { /* ignore */ }
      throw new Error(msg);
    }
    return res.json();
  }

  export async function apiSend(method, path, body) {
    const res = await fetch(API_BASE + path, {
      method: method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      let msg = '保存失败（' + res.status + '）';
      try { const d = await res.json(); if (d.error) msg = d.error; } catch (e) { /* ignore */ }
      const err = new Error(msg);
      err.status = res.status;
      err.payload = null;
      try { err.payload = await res.clone().json(); } catch (e) { /* ignore */ }
      throw err;
    }
    return res.json();
  }

  export function apiPost(path, body) { return apiSend('POST', path, body); }
  export function apiPut(path, body) { return apiSend('PUT', path, body); }

  /* ================================================================
   *  排座模式：座位表选择与加载
   * ================================================================ */

  export function renderChartSelect(selectedId) {
    if (!chartList.length) {
      chartSelect.innerHTML = '<option value="">（还没有座位表）</option>';
      chartSelect.disabled = true;
      return;
    }
    chartSelect.disabled = false;
    chartSelect.innerHTML = chartList.map(c => {
      const fits = seatsFitFor(c.allow_empty !== false, c.seat_count || 0, c.list_item_count || 0);
      const state = !c.has_layout ? '未设定格局' : (fits ? '已就绪' : '格局待更新');
      return '<option value="' + c.chart_id + '"' + (c.chart_id === selectedId ? ' selected' : '') + '>'
        + escapeHtml(c.name) + '｜' + escapeHtml(c.list_name || '名单已失效') + '（' + state + '）</option>';
    }).join('');
  }

  export async function loadChartList(preferId) {
    const data = await apiGet('/seat-charts');
    setChartList(data.seat_charts || []);
    const pick = preferId && chartList.some(c => c.chart_id === preferId)
      ? preferId
      : (chartList.length ? chartList[0].chart_id : 0);
    renderChartSelect(pick);
    return pick;
  }

  export async function loadChart(chartId) {
    clearSeatingSelection();   // 换表 / 重新加载时清掉旧的选中态（模式本身不变）
    // URL 同步：直接分享 / 刷新都能回到同一个座位表
    const url = new URL(window.location.href);
    url.searchParams.set('cloud_seats_id', String(chartId));
    history.replaceState(null, '', url.toString());

    showLoading('加载座位表…');
    try {
      const data = await apiGet('/seat-charts/' + chartId);
      setChart(data.seat_chart);
      setListItems(data.items || []);
      const ok = presentChart();
      applyModeUI();
      return ok;
    } catch (err) {
      clearLayout();
      showNotice('加载失败', escapeHtml(err.message || '请稍后重试'), false);
      setCloudLoaded(false);
      applyModeUI();
      return false;
    } finally {
      hideLoading();
    }
  }

  // 按已取回的 chart / listItems 决定：渲染画布，还是弹「去控制台设格局」的提示
  export function presentChart() {
    const needed = listItems.length;
    const have = chart.seat_count || 0;

    // 名单为空 / 格局未设定 / 格局与名单人数不一致 —— 都要请老师回控制台设定
    if (!chart.has_layout) {
      if (editMode) {
        // 编辑模式本来就是来「设格局」的：直接给空画布开编，不能拦在这里
        applyLayout(null);
        hideNotice();
        setCloudLoaded(true);
        toast('这个座位表还没有格局：请摆放'
              + (allowEmptySeats() ? '至少 ' : '正好 ') + needed + ' 个座位后保存'
              + (needed ? '（可用「一键铺座」快速铺满）' : ''));
        return true;
      }
      clearLayout();
      showNotice('还没有设定座位格局',
        '座位表「<b>' + escapeHtml(chart.name) + '</b>」绑定的名单有 <b>' + needed + '</b> 人，但还没有摆放座位。'
        + '<br>点下面的按钮切到「格局编辑」，摆好 <b>' + needed + '</b> 个座位并保存，就能回来排座。',
        true);
      setCloudLoaded(false);
      return false;
    }
    if (!seatsFit(have, needed)) {
      if (editMode) {
        // 编辑模式：允许继续编辑参数好把座位数改对
        applyLayout(chart.layout);
        hideNotice();
        setCloudLoaded(true);
        toast('名单人数已变化：当前座位 ' + have + ' / 名单 ' + needed + '，请调整后再保存', true);
        return true;
      }
      clearLayout();
      showNotice('座位格局与名单人数不一致',
        '座位表「<b>' + escapeHtml(chart.name) + '</b>」摆了 <b>' + have + '</b> 个座位，'
        + '但名单现在有 <b>' + needed + '</b> 人。'
        + (allowEmptySeats() ? '<br>点下面的按钮切到「格局编辑」，把座位补到不少于名单人数并保存。'
                             : '<br>该座位表设为「仅满座」，点下面的按钮切到「格局编辑」把座位数调成一致并保存。'),
        true);
      setCloudLoaded(false);
      return false;
    }

    hideNotice();
    applyLayout(chart.layout);
    applyArrangement(chart.arrangement);
    setCloudLoaded(true);
    return true;
  }
