// 易积分 · 历史记录页
import { state } from './state.js';
import { apiGet } from './api.js';
import { toast, escapeHtml } from './ui.js';

let ledgerList;

export function initLedger(refs) {
  ledgerList = refs.ledgerList;
}

export function renderLedger() {
  apiGet('/easycore/api/score/tables/' + state.tableId + '/ledger?limit=1000')
    .then(data => draw(data.ledger))
    .catch(e => toast(e.message, true));
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function draw(ledger) {
  ledgerList.innerHTML = '';
  if (!ledger || !ledger.length) {
    ledgerList.innerHTML = '<div class="empty-tip">暂无历史记录</div>';
    return;
  }
  ledger.forEach(l => {
    const item = document.createElement('div');
    item.className = 'ledger-item';

    const badge = document.createElement('div');
    badge.className = 'lg-badge ' + l.kind;
    badge.textContent = l.kind === 'add' ? '+' : (l.kind === 'deduct' ? '−' : '抵');

    const body = document.createElement('div');
    body.className = 'lg-body';
    const name = document.createElement('div');
    name.className = 'lg-name';
    name.textContent = l.name || ('学生#' + l.item_id);
    body.appendChild(name);
    const reason = document.createElement('div');
    reason.className = 'lg-reason';
    reason.textContent = reasonText(l);
    body.appendChild(reason);

    const value = document.createElement('div');
    value.className = 'lg-value ' + (l.kind === 'add' ? 'pos' : (l.kind === 'deduct' ? 'neg' : 'off'));
    value.textContent = l.kind === 'add' ? ('+' + l.value) : (l.kind === 'deduct' ? ('−' + l.value) : ('抵' + l.value));

    const time = document.createElement('div');
    time.className = 'lg-time';
    time.textContent = fmtTime(l.created_at);

    item.appendChild(badge);
    item.appendChild(body);
    item.appendChild(value);
    item.appendChild(time);
    ledgerList.appendChild(item);
  });
}

function reasonText(l) {
  if (l.kind === 'offset') {
    const add = (l.extra && l.extra.add) || l.value;
    const ded = (l.extra && l.extra.deduct) || l.value;
    return '加分抵扣：' + add + ' 分加分抵消 ' + ded + ' 分扣分';
  }
  return l.reason || '（无理由）';
}
