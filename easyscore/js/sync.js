// 易积分 · WebSocket 实时同步
import { state } from './state.js';

export function connectWS(onState, onTablesChanged) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(proto + '//' + location.host + '/easycore/api/score/ws?table_id=' + state.tableId);

  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch (err) { return; }
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'hello':
        state.connId = msg.conn_id || null;
        if (msg.heartbeat) {
          setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
            }
          }, msg.heartbeat * 1000);
        }
        break;
      case 'state':
        onState(msg.table);
        break;
      case 'tables_changed':
      case 'table_deleted':
        onTablesChanged();
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', ts: msg.ts }));
        break;
    }
  };
  return ws;
}
