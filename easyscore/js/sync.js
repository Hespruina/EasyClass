/* 易积分 · WebSocket 实时同步
 *
 * 与 EasyCore 的 /api/score/ws 配套，约定同易计票 / 易排座：
 *   - 按「账号 + 积分表」建一条 WebSocket，断线指数退避重连（1.5s → 15s 封顶）；
 *   - 服务端 hello 下发 conn_id，本机操作时随请求带回，广播据此跳过本机（REST 响应即权威）；
 *   - 建连 / 重连 / 页面重新可见时都发一次 state_request 对账 —— 断开期间别的设备
 *     改过的分数，靠这一帧补回来，不需要用户刷新页面。
 *
 * 注意：onclose 必须自己接管重连。浏览器节流后台标签页、手机锁屏、服务器重启
 * 都会让 socket 静默死掉，不重连的话页面看起来正常但再也收不到推送。
 */
import { state } from './state.js';

/* 断线重连节奏（易积分 / 易排座 / 易计票 / 易任务 / 易点名统一）：
 *   掉线后第 1 次立刻重连（0ms）；之后 1s 起、翻倍但封顶 2s；
 *   连续失败超过 10 次还没连上，就固定每 1s 试一次 —— 网络一恢复就能马上接上。 */
const RETRY_BURST = 10;
const RETRY_STEP = 1000;
const RETRY_CAP = 2000;
const RETRY_STEADY = 1000;
const PING_FALLBACK = 5000;   // 服务端未下发 heartbeat 时的兜底

let socket = null;
let pingTimer = null;
let pingInterval = PING_FALLBACK;
let reconnectTimer = null;
let dropFails = 0;            // 连续失败次数，连上即清零
let closedByUs = false;
let offlineNotified = false;

/* 第 n 次重试前该等多久 */
function nextRetryDelay() {
  dropFails += 1;
  if (dropFails === 1) return 0;
  if (dropFails > RETRY_BURST) return RETRY_STEADY;
  return Math.min(RETRY_STEP * Math.pow(2, dropFails - 2), RETRY_CAP);
}

let onState = null;      // (table) => void     权威数据推送
let onTables = null;     // (msg)   => void     列表变化 / 整表被删
let onStatus = null;     // (online) => void    连接状态变化

function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return proto + '//' + location.host + '/easycore/api/score/ws?table_id=' + state.tableId;
}

function send(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  try {
    socket.send(JSON.stringify(payload));
    return true;
  } catch (e) {
    return false;
  }
}

function stopPing() {
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
}

function startPing(intervalMs) {
  stopPing();
  if (intervalMs > 0) pingInterval = intervalMs;
  pingTimer = setInterval(() => send({ type: 'ping', ts: Date.now() }), pingInterval);
}

/* 断线 / 恢复各只通知一次，别每次重连尝试都刷提示 */
function setOnline(online) {
  if (online) {
    if (!offlineNotified) return;   // 首次连接成功不打扰
    offlineNotified = false;
  } else {
    if (offlineNotified) return;
    offlineNotified = true;
  }
  if (onStatus) onStatus(online);
}

function scheduleReconnect() {
  if (closedByUs || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    open();
  }, nextRetryDelay());
}

function open() {
  if (closedByUs || !state.tableId) return;

  let ws;
  try {
    ws = new WebSocket(wsUrl());
  } catch (e) {
    setOnline(false);
    scheduleReconnect();
    return;
  }
  socket = ws;

  ws.onopen = () => {
    dropFails = 0;
    setOnline(true);
    // 建连即对账（服务端也会主动推一帧，双保险；重连场景尤其重要）
    send({ type: 'state_request' });
    startPing();
  };

  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch (err) { return; }
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'hello':
        state.connId = msg.conn_id || null;
        if (msg.heartbeat) startPing(msg.heartbeat * 1000);
        break;
      case 'state':
        if (onState) onState(msg.table);
        break;
      case 'tables_changed':
      case 'table_deleted':
        if (onTables) onTables(msg);
        break;
      case 'ping':
        send({ type: 'pong', ts: msg.ts });
        break;
      case 'error':
        break;
    }
  };

  ws.onclose = () => {
    stopPing();
    if (socket === ws) socket = null;
    if (closedByUs) return;
    setOnline(false);
    scheduleReconnect();
  };

  ws.onerror = () => { /* onclose 负责重连 */ };
}

export function connectWS(handlers) {
  onState = handlers && handlers.onState;
  onTables = handlers && handlers.onTables;
  onStatus = handlers && handlers.onStatus;

  closedByUs = false;
  offlineNotified = false;
  dropFails = 0;
  open();
}

export function disconnectWS() {
  closedByUs = true;
  stopPing();
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (socket) {
    try { socket.onclose = null; socket.close(); } catch (e) { /* 忽略 */ }
    socket = null;
  }
  state.connId = null;
}

/* 后台标签页 / 手机锁屏期间推送会被错过，回到前台补一次对账；
   socket 已被系统掐掉（readyState 既非 OPEN 也非 CONNECTING）时当场重连，不等退避定时器 */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || closedByUs) return;
  if (socket && socket.readyState === WebSocket.OPEN) { send({ type: 'state_request' }); return; }
  if (socket && socket.readyState === WebSocket.CONNECTING) return;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  open();   // 回到前台当场重连，不等退避
});

/* 从往返缓存恢复（bfcache）时连接多半已经没了 */
window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  closedByUs = false;
  if (!socket || socket.readyState > WebSocket.OPEN) open();
  else send({ type: 'state_request' });
});
