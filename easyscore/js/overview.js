// 易积分 · 数据总览页
import { state } from './state.js';
import { apiGet } from './api.js';
import { toast, escapeHtml } from './ui.js';
import { cmpName } from './pinyin.js';

let ovFilter, ovCards, ovTableWrap, ovFrom, ovTo, ovRangeHint;
let currentDays = 30;   // 默认 30 天

export function initOverview(refs) {
  ovFilter = refs.ovFilter;
  ovCards = refs.ovCards;
  ovTableWrap = refs.ovTableWrap;
  ovFrom = refs.ovFrom;
  ovTo = refs.ovTo;
  ovRangeHint = document.getElementById('ovRangeHint');

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

  paintRangeHint();
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

/* 筛选条右侧的时间范围提示：让「现在看的是哪一段」一目了然 */
function paintRangeHint() {
  if (!ovRangeHint) return;
  let text;
  if (currentDays > 0) {
    text = '近 ' + currentDays + ' 天';
  } else if (ovFrom.value && ovTo.value) {
    text = ovFrom.value + ' 至 ' + ovTo.value;
  } else if (ovFrom.value) {
    text = ovFrom.value + ' 起';
  } else if (ovTo.value) {
    text = '截至 ' + ovTo.value;
  } else {
    text = '全部记录';
  }
  ovRangeHint.textContent = text;
}

export function renderOverview() {
  paintRangeHint();
  const r = range();
  const params = new URLSearchParams();
  if (r.from) params.set('from', r.from);
  if (r.to) params.set('to', r.to);
  apiGet('/easycore/api/score/tables/' + state.tableId + '/overview?' + params.toString())
    .then(data => draw(data.overview))
    .catch(e => toast(e.message, true));
}

function draw(ov) {
  const rows = ov.rows || [];
  drawStats(ov, rows);
  drawBoards(rows);
}

/* 顶部四格：人数 / 人均加分 / 人均扣分 / 人均净分 */
function drawStats(ov, rows) {
  const net = Math.round((ov.avg_add - ov.avg_deduct) * 100) / 100;
  const netCls = net > 0 ? 'pos' : (net < 0 ? 'neg' : 'zero');
  const items = [
    { num: String(ov.student_count != null ? ov.student_count : rows.length), label: '学生人数', cls: 'zero' },
    { num: '+' + ov.avg_add, label: '人均加分', cls: 'pos' },
    { num: '−' + ov.avg_deduct, label: '人均扣分', cls: 'neg' },
    { num: (net > 0 ? '+' : (net < 0 ? '−' : '')) + Math.abs(net), label: '人均净分', cls: netCls },
  ];
  ovCards.innerHTML = items.map(it =>
    '<div class="ov-stat">' +
      '<span class="ov-num ' + it.cls + '">' + it.num + '</span>' +
      '<span class="ov-label">' + it.label + '</span>' +
    '</div>',
  ).join('');
}

/* 学生总排名：
 * - 默认两竖列 —— 正分榜（加分降序）/ 负分榜（扣分降序）；
 * - 「加分直接抵消扣分」模式下两池不会同时非零（每笔落库立刻对冲），
 *   拆成两张榜没有意义，合并成一条总分榜，按净分（加分 − 扣分）降序。 */
function drawBoards(rows) {
  const direct = state.directOffset;
  const inner = ovTableWrap.closest('.ov-inner');
  // 单榜再铺满 980px 就又是一条「名字与分数隔一屏」，整列一起收窄
  if (inner) inner.classList.toggle('narrow', direct);

  if (direct) {
    const total = rows
      .map(r => ({ name: r.name, v: r.add - r.deduct }))
      .filter(r => r.v !== 0)
      .sort((a, b) => (b.v - a.v) || cmpName(a.name, b.name));
    ovTableWrap.classList.add('single');
    ovTableWrap.innerHTML = board({
      title: '总分榜', kind: 'total', list: total,
      value: r => r.v, empty: '本时间段暂无积分记录',
    });
    return;
  }

  ovTableWrap.classList.remove('single');
  const pos = rows.filter(r => r.add > 0)
    .sort((a, b) => (b.add - a.add) || cmpName(a.name, b.name));
  const neg = rows.filter(r => r.deduct > 0)
    .sort((a, b) => (b.deduct - a.deduct) || cmpName(a.name, b.name));

  ovTableWrap.innerHTML =
    board({ title: '正分榜', kind: 'pos', list: pos, value: r => r.add, empty: '本时间段暂无加分记录' }) +
    board({ title: '负分榜', kind: 'neg', list: neg, value: r => r.deduct, empty: '本时间段暂无扣分记录' });
}

/* 分值文本：正分榜恒带 +，负分榜恒带 −，总分榜按正负号 */
function signed(v, kind) {
  if (kind === 'pos') return '+' + v;
  if (kind === 'neg') return '−' + v;
  if (v > 0) return '+' + v;
  if (v < 0) return '−' + (-v);
  return '0';
}

function board(cfg) {
  const { title, kind, list, value, empty } = cfg;
  const peak = list.reduce((m, r) => Math.max(m, Math.abs(value(r))), 0);
  const sum = list.reduce((s, r) => s + value(r), 0);

  let meta = '';
  if (list.length) meta = list.length + ' 人 · 合计 ' + signed(sum, kind);

  let html = '<section class="ov-board ' + kind + '">' +
    '<header class="ob-head">' +
      '<span class="ob-title">' + title + '</span>' +
      '<span class="ob-meta">' + meta + '</span>' +
    '</header>';

  if (!list.length) {
    return html + '<div class="ob-empty">' + empty + '</div></section>';
  }

  html += '<ol class="ob-list">';
  list.forEach((r, i) => {
    const v = value(r);
    // 总分榜每行各自定色（同一条榜里既有正也有负），两榜模式用榜的 kind
    const cls = kind === 'total' ? (v > 0 ? 'pos' : 'neg') : kind;
    const pct = peak > 0 ? Math.round((Math.abs(v) / peak) * 100) : 0;
    html += '<li class="ob-row ' + cls + '" style="--p:' + pct + '">' +
      '<span class="ob-rank' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</span>' +
      '<span class="ob-name">' + escapeHtml(r.name) + '</span>' +
      '<span class="ob-val">' + signed(v, kind) + '</span>' +
    '</li>';
  });
  html += '</ol></section>';
  return html;
}
