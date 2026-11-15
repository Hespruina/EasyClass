// 易积分 · 数据总览页
import { state } from './state.js';
import { apiGet } from './api.js';
import { toast } from './ui.js';
import { escapeHtml } from './ui.js';

let ovFilter, ovCards, ovTableWrap, ovFrom, ovTo;
let currentDays = 30;   // 默认 30 天

export function initOverview(refs) {
  ovFilter = refs.ovFilter;
  ovCards = refs.ovCards;
  ovTableWrap = refs.ovTableWrap;
  ovFrom = refs.ovFrom;
  ovTo = refs.ovTo;

  ovFilter.querySelectorAll('.qbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentDays = parseInt(btn.dataset.days, 10);
      ovFilter.querySelectorAll('.qbtn').forEach(b => b.classList.toggle('on', b === btn));
      ovFrom.value = '';
      ovTo.value = '';
      renderOverview();
    });
  });
  ovFilter.querySelectorAll('.qbtn[data-days="30"]').forEach(b => b.classList.add('on'));
  ovFrom.addEventListener('change', () => { currentDays = 0; ovFilter.querySelectorAll('.qbtn').forEach(b => b.classList.remove('on')); renderOverview(); });
  ovTo.addEventListener('change', () => { currentDays = 0; ovFilter.querySelectorAll('.qbtn').forEach(b => b.classList.remove('on')); renderOverview(); });
}

function range() {
  const now = new Date();
  if (currentDays > 0) {
    const from = new Date(now.getTime() - currentDays * 86400000);
    return { from: from.toISOString(), to: now.toISOString() };
  }
  let from = ovFrom.value ? new Date(ovFrom.value + 'T00:00:00') : null;
  let to = ovTo.value ? new Date(ovTo.value + 'T23:59:59') : null;
  return { from: from ? from.toISOString() : null, to: to ? to.toISOString() : null };
}

export function renderOverview() {
  const r = range();
  const params = new URLSearchParams();
  if (r.from) params.set('from', r.from);
  if (r.to) params.set('to', r.to);
  apiGet('/easycore/api/score/tables/' + state.tableId + '/overview?' + params.toString())
    .then(data => draw(data.overview))
    .catch(e => toast(e.message, true));
}

function draw(ov) {
  ovCards.innerHTML = '';

  const statPos = document.createElement('div');
  statPos.className = 'ov-stat';
  statPos.innerHTML = '<div class="ov-num pos">' + ov.avg_add + '</div><div class="ov-label">全班人均加分</div>';
  ovCards.appendChild(statPos);

  const statNeg = document.createElement('div');
  statNeg.className = 'ov-stat';
  statNeg.innerHTML = '<div class="ov-num neg">' + ov.avg_deduct + '</div><div class="ov-label">全班人均扣分</div>';
  ovCards.appendChild(statNeg);

  ovCards.appendChild(rankCard('加分最多 Top10', ov.top_add, false));
  ovCards.appendChild(rankCard('扣分最多 Top10', ov.top_deduct, true));

  drawTable(ov.rows);
}

function rankCard(title, list, isNeg) {
  const card = document.createElement('div');
  card.className = 'ov-rank';
  const h = document.createElement('h3');
  h.textContent = title;
  card.appendChild(h);
  const wrap = document.createElement('div');
  wrap.className = 'rk-list';
  if (!list || !list.length) {
    const empty = document.createElement('div');
    empty.className = 'rk-row';
    empty.innerHTML = '<span class="rk-no"></span><span class="rk-name" style="color:var(--muted)">本时间段暂无记录</span>';
    wrap.appendChild(empty);
  } else {
    list.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'rk-row';
      row.innerHTML = '<span class="rk-no">' + (i + 1) + '</span>' +
        '<span class="rk-name">' + escapeHtml(r.name) + '</span>' +
        '<span class="rk-val' + (isNeg ? ' neg' : '') + '">' + (isNeg ? r.deduct : r.add) + '</span>';
      wrap.appendChild(row);
    });
  }
  card.appendChild(wrap);
  return card;
}

function drawTable(rows) {
  let html = '<table class="ov-table"><thead><tr><th>学生</th><th>累计加分</th><th>累计扣分</th></tr></thead><tbody>';
  (rows || []).forEach(r => {
    html += '<tr><td class="name">' + escapeHtml(r.name) + '</td>' +
      '<td class="pos">+' + r.add + '</td><td class="neg">−' + r.deduct + '</td></tr>';
  });
  html += '</tbody></table>';
  ovTableWrap.innerHTML = html;
}
