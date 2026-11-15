/* ==========================================================================
 * 易排座 · 实时同步 + 相机位置持久化
 *
 * 一、多端同步（与 EasyCore 的 /api/seat-charts/ws 配套，模式同易计票）
 *   - 打开座位表后按 (账号 + chart_id) 建立一条 WebSocket，5s 心跳，断线指数退避重连；
 *   - 服务端 hello 下发 conn_id，本机写格局 / 排座结果时随请求带回，
 *     广播据此跳过本机连接（REST 响应即权威数据），不回声；
 *   - 收到其它设备的 layout_saved / arrangement_saved / chart_updated /
 *     chart_deleted 就地应用，无需整页刷新；
 *   - snapshot（连接建立 / 重连 / 页面重新可见时主动要）用于对账：
 *     格局只比「座位 + 分组」（不含视角），排座结果整份比对。
 *
 * 二、相机位置（layout.view = scale / offsetX / offsetY）云同步
 *   - 平移缩放防抖 1.2s 后 view-only 保存（POST /layout + view_only:true），
 *     服务端跳过埋点 / 裁剪 / 广播 —— 视角只落库不广播，多台设备互不拽镜头；
 *   - 只用「已保存的格局」换 view，未保存的座位编辑不会被顺手写进云端；
 *   - 页面卸载（pagehide）时用 keepalive fetch 兜底 flush；
 *   - 下次打开时 applyLayout 按 layout.view 还原视角。
 * ========================================================================== */

import {
  API_BASE, chart, chartList, cloudLoaded, editMode, offsetX, offsetY, scale,
  seatFlying, setWsConnId, syncStatus, wsConnId
} from './state.js';
import {
  applyArrangement, applyLayout, collectArrangement, refreshAllowEmptyBtn
} from './layout.js';
import { apiPost, loadChart, renderChartSelect } from './api.js';
import { reapplyKeepNames, syncTabState, layoutDirty } from './mode.js';
import { toast } from './ui.js';

  const HEARTBEAT_INTERVAL = 5000;   // 与后端 seats_hub 一致
  // 断线重连节奏（与易积分 / 易计票 / 易任务 / 易点名一致）：
  // 第 1 次立刻重连，之后 1s 起翻倍封顶 2s，连续失败超 10 次则固定每 1s 试一次
  const RETRY_BURST = 10;
  const RETRY_STEP = 1000;
  const RETRY_CAP = 2000;
  const RETRY_STEADY = 1000;
  const VIEW_SAVE_DEBOUNCE = 1200;   // 视角稳定 1.2s 后才保存，拖动画布不刷接口

  /* ================================================================
   *  同步状态提示（底栏）
   * ================================================================ */

  function setSyncStatus(text, kind) {
    if (!syncStatus) return;
    syncStatus.textContent = text || '';
    syncStatus.dataset.kind = kind || 'ok';
  }

  /* ================================================================
   *  WebSocket 连接
   * ================================================================ */

  let socket = null;
  let activeChartId = null;          // 当前订阅的座位表
  let pingTimer = null;
  let reconnectTimer = null;
  let dropFails = 0;                 // 连续失败次数，连上即清零
  let closedByUs = false;

  /* 第 n 次重试前该等多久：首次 0ms（掉线立刻重连） */
  function nextRetryDelay() {
    dropFails += 1;
    if (dropFails === 1) return 0;
    if (dropFails > RETRY_BURST) return RETRY_STEADY;
    return Math.min(RETRY_STEP * Math.pow(2, dropFails - 2), RETRY_CAP);
  }

  function wsUrl(chartId) {
    const base = new URL('/easycore/', window.location.origin);
    const url = new URL('api/seat-charts/ws', base);
    url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('chart_id', String(chartId));
    return url.href;
  }

  function send(payload) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try { socket.send(JSON.stringify(payload)); } catch (e) { /* 忽略 */ }
    }
  }

  function stopPing() {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  }

  function startPing() {
    stopPing();
    pingTimer = setInterval(() => send({ type: 'ping', ts: Date.now() }),
                            HEARTBEAT_INTERVAL);
  }

  function stopReconnect() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  }

  function scheduleReconnect() {
    if (closedByUs || reconnectTimer || activeChartId === null) return;
    setSyncStatus('连接已断开，正在重连…', 'warn');
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      openSocket();
    }, nextRetryDelay());
  }

  function openSocket() {
    closedByUs = false;
    if (activeChartId === null) return;

    let ws;
    try { ws = new WebSocket(wsUrl(activeChartId)); }
    catch (e) {
      setSyncStatus('无法建立实时连接', 'warn');
      scheduleReconnect();
      return;
    }
    socket = ws;

    ws.onopen = () => {
      dropFails = 0;
      setSyncStatus('实时同步已连接', 'ok');
      send({ type: 'state_request' });   // 立刻对账一次（重连场景尤其重要）
      startPing();
    };
    ws.onmessage = event => {
      let msg;
      try { msg = JSON.parse(event.data); } catch (e) { return; }
      if (!msg || typeof msg !== 'object') return;
      switch (msg.type) {
        case 'ping': send({ type: 'pong', ts: msg.ts }); break;
        case 'pong': break;
        case 'hello':
          // 记下本机连接 id：写格局 / 排座结果时带给服务端，广播据此跳过本机
          if (msg.conn_id) setWsConnId(msg.conn_id);
          break;
        case 'snapshot': onSnapshot(msg); break;
        case 'layout_saved': applyRemoteLayout(msg.layout, msg.arrangement); break;
        case 'arrangement_saved': applyRemoteArrangement(msg.arrangement); break;
        case 'chart_updated': onChartUpdated(msg.chart); break;
        case 'chart_deleted': onChartDeleted(); break;
        case 'error': setSyncStatus(msg.message || '同步连接异常', 'warn'); break;
        default: break;
      }
    };
    ws.onclose = () => {
      stopPing();
      if (socket === ws) socket = null;
      if (!closedByUs) scheduleReconnect();
    };
    ws.onerror = () => { /* onclose 会负责重连 */ };
  }

  // 打开 / 切换座位表后调用；同一张表且连接健在时直接复用（reloadChart 不重连）
  export function connect(chartId) {
    if (!chartId) { disconnect(); return; }
    if (chartId === activeChartId && socket &&
        (socket.readyState === WebSocket.OPEN ||
         socket.readyState === WebSocket.CONNECTING)) return;
    disconnect();               // 换表：先关掉旧连接
    activeChartId = chartId;
    openSocket();
  }

  export function disconnect() {
    closedByUs = true;
    activeChartId = null;
    stopPing();
    stopReconnect();
    if (socket) {
      try { socket.onclose = null; socket.close(); } catch (e) { /* 忽略 */ }
      socket = null;
    }
    setWsConnId(null);
    setSyncStatus('', 'ok');
  }

  /* ================================================================
   *  远端变更的应用
   * ================================================================ */

  // 格局指纹：只比座位 / 分组 / 网格开关，不含视角（视角是每台设备自己的）
  function layoutCore(layout) {
    if (!layout) return '';
    return JSON.stringify({ g: layout.gridAlign, gr: layout.groups, s: layout.seats });
  }

  function onSnapshot(msg) {
    if (!chart || Number(chart.chart_id) !== activeChartId) return;

    const remoteCore = layoutCore(msg.layout);
    if (remoteCore && remoteCore !== layoutCore(chart.layout)) {
      applyRemoteLayout(msg.layout, msg.arrangement);   // 离线期间格局变了
      return;
    }
    // 格局没变：只对账排座结果
    const remoteSeats = (msg.arrangement && msg.arrangement.seats) || {};
    if (JSON.stringify(remoteSeats) !== JSON.stringify(collectArrangement().seats)) {
      applyRemoteArrangement(msg.arrangement);
    }
  }

  async function applyRemoteLayout(layout, arrangement) {
    if (!chart || !layout) return;
    if (editMode && layoutDirty()) {
      const ok = window.confirm('其他设备刚保存了新格局。\n\n确定加载吗？'
        + '（取消将保留当前未保存的编辑，之后可点顶部「刷新」再同步）');
      if (!ok) return;
    }
    // 视角保留本机的：镜头不该被其它设备的保存拽走
    const localView = { scale, offsetX, offsetY };
    reapplyKeepNames(Object.assign({}, layout, { view: localView }));
    applyArrangement(arrangement);          // 远端是权威数据，覆盖本地姓名
    syncTabState();                         // 座位数变化可能影响「排座位」选项卡可用性
    toast('已同步其他设备更新的座位格局');
  }

  function applyRemoteArrangement(arrangement) {
    if (!chart) return;
    if (seatFlying) {
      // 换座飞行动画进行中：落完这批再应用，避免座位文字在半路被改掉
      setTimeout(() => applyRemoteArrangement(arrangement), 520);
      return;
    }
    applyArrangement(arrangement);
  }

  function onChartUpdated(info) {
    if (!chart || !info) return;
    if (info.name !== undefined) chart.name = info.name;
    if (info.allow_empty !== undefined) chart.allow_empty = info.allow_empty;
    const item = chartList.find(c => c.chart_id === chart.chart_id);
    if (item) {
      if (info.name !== undefined) item.name = info.name;
      if (info.allow_empty !== undefined) item.allow_empty = info.allow_empty;
    }
    refreshAllowEmptyBtn();
    renderChartSelect(chart.chart_id);
    syncTabState();
  }

  function onChartDeleted() {
    toast('该座位表已被其他设备删除', true);
    if (chart) loadChart(chart.chart_id);   // 404 → 走统一的「加载失败」提示
  }

  // 页面重新可见时补一次对账：后台标签页可能错过推送
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && activeChartId !== null) {
      send({ type: 'state_request' });
    }
  });

  /* ================================================================
   *  相机位置（视角）持久化
   * ================================================================ */

  let viewSaveTimer = null;

  // applyTransform 每次平移 / 缩放都会调这里（viewport.js），防抖落盘
  export function noteViewChanged() {
    if (!chart || !cloudLoaded || !chart.has_layout) return;
    if (viewSaveTimer) clearTimeout(viewSaveTimer);
    viewSaveTimer = setTimeout(() => {
      viewSaveTimer = null;
      saveViewNow(false);
    }, VIEW_SAVE_DEBOUNCE);
  }

  // 离开页面前（返回控制台）主动 flush；没有在途的视角改动则返回 null
  export function flushViewSave() {
    if (!viewSaveTimer) return null;
    clearTimeout(viewSaveTimer);
    viewSaveTimer = null;
    saveViewNow(false);
    return Promise.resolve();
  }

  function saveViewNow(keepalive) {
    if (!chart || !chart.has_layout || !chart.chart_id || !cloudLoaded) return;

    const saved = (chart.layout && chart.layout.view) || {};
    if (saved.scale === scale && saved.offsetX === offsetX
        && saved.offsetY === offsetY) return;          // 视角没动，不用存

    // 关键：座位 / 分组取「已保存的格局」，只有 view 换成本机当前值 ——
    // 格局编辑里未保存的座位改动绝不会被视角保存顺手写进云端。
    const layout = Object.assign({}, chart.layout,
                                 { view: { scale, offsetX, offsetY } });
    const path = API_BASE + '/seat-charts/' + chart.chart_id + '/layout';

    if (keepalive) {
      // 页面正在卸载：keepalive fetch 尽力而为，失败不重试（下次还会防抖再存）
      try {
        fetch(path, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout, view_only: true, conn_id: wsConnId || undefined }),
          keepalive: true,
        });
      } catch (e) { /* 忽略 */ }
      return;
    }

    apiPost('/seat-charts/' + chart.chart_id + '/layout',
            { layout, view_only: true, conn_id: wsConnId || undefined })
      .then(() => { if (!viewSaveTimer && chart.layout) chart.layout.view = { scale, offsetX, offsetY }; })
      .catch(() => { /* 视角保存失败静默：不影响任何座位数据 */ });
  }

  // 关标签页 / 刷新 / 跳转时兜底 flush，保证下次打开视角正确
  window.addEventListener('pagehide', () => {
    if (!viewSaveTimer) return;
    clearTimeout(viewSaveTimer);
    viewSaveTimer = null;
    saveViewNow(true);
  });
