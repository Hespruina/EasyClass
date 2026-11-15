// 易积分 · 入口
import { state } from './state.js';
import { apiGet, CONSOLE_URL } from './api.js';
import { initCards, renderCards, setBatchMode, getSelectedItemIds } from './cards.js';
import { initModal, openModal } from './modal.js';
import { initOverview, renderOverview } from './overview.js';
import { initLedger, renderLedger } from './ledger.js';
import { connectWS } from './sync.js';
import { toast, showLoading, hideLoading } from './ui.js';

const $ = (id) => document.getElementById(id);

function applyTable(table) {
  state.table = table;
  state.balances = table.balances || [];
  const hint = $('tableHint');
  hint.textContent = (table.name || '') + ' · ' + state.balances.length + ' 人';
}

async function refresh() {
  try {
    const data = await apiGet('/easycore/api/score/tables/' + state.tableId);
    applyTable(data.table);
    renderCards();
    await loadTableList();
  } catch (e) { /* 静默 */ }
}

async function loadTable() {
  showLoading('加载中…');
  try {
    const data = await apiGet('/easycore/api/score/tables/' + state.tableId);
    applyTable(data.table);
    renderCards();
    await loadTableList();
  } catch (e) {
    toast(e.message, true);
  } finally {
    hideLoading();
  }
}

async function loadTableList() {
  try {
    const data = await apiGet('/easycore/api/score/tables');
    const active = data.tables || [];
    const sel = $('scoreSelect');
    sel.innerHTML = '';
    active.forEach(t => {
      const opt = document.createElement('option');
      opt.value = String(t.id);
      opt.textContent = t.name;
      sel.appendChild(opt);
    });
    sel.value = String(state.tableId);
    sel.style.display = active.length > 1 ? '' : 'none';
    $('reloadBtn').style.display = '';
  } catch (e) { /* 静默 */ }
}

function switchTab(tab) {
  state.activeTab = tab;
  const map = { overview: 'tabOverview', operate: 'tabOperate', ledger: 'tabLedger' };
  document.querySelectorAll('.rb-tab').forEach(b => {
    b.classList.toggle('active', b.id === map[tab]);
  });
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  $(tab + '-panel').classList.add('active');
  document.querySelectorAll('#ribbon [data-tab-group]').forEach(g => {
    g.style.display = g.dataset.tabGroup === tab ? '' : 'none';
  });
  if (tab === 'overview') renderOverview();
  else if (tab === 'ledger') renderLedger();
}

function boot() {
  const params = new URLSearchParams(location.search);
  state.tableId = parseInt(params.get('score_id'), 10);
  if (!state.tableId) {
    // 未携带积分表参数：直接跳转到 EasyCore 的「积分表」页
    window.location.replace(CONSOLE_URL);
    return;
  }

  initCards({
    cardsContainer: $('cardsContainer'),
    alphaIndex: $('alphaIndex'),
    searchInput: $('searchInput'),
    operateBody: $('operateBody'),
  });
  initModal({
    overlay: $('scoreModal'),
    modalTitle: $('modalTitle'),
    kindAdd: $('kindAdd'),
    kindDeduct: $('kindDeduct'),
    valInput: $('valInput'),
    valMinus: $('valMinus'),
    valPlus: $('valPlus'),
    quickBtns: $('quickBtns'),
    reasonInput: $('reasonInput'),
    reasonHistory: $('reasonHistory'),
    modalCancel: $('modalCancel'),
    modalSave: $('modalSave'),
    modalClose: $('modalClose'),
  }, refresh);
  initOverview({
    ovFilter: $('ovFilter'),
    ovCards: $('ovCards'),
    ovTableWrap: $('ovTableWrap'),
    ovFrom: $('ovFrom'),
    ovTo: $('ovTo'),
  });
  initLedger({ ledgerList: $('ledgerList') });

  // tab 切换
  $('tabOverview').addEventListener('click', () => switchTab('overview'));
  $('tabOperate').addEventListener('click', () => switchTab('operate'));
  $('tabLedger').addEventListener('click', () => switchTab('ledger'));

  // 返回控制台
  $('backBtn').addEventListener('click', () => { window.location.href = CONSOLE_URL; });
  $('reloadBtn').addEventListener('click', () => loadTable());
  $('scoreSelect').addEventListener('change', () => {
    const id = parseInt($('scoreSelect').value, 10);
    if (id && id !== state.tableId) {
      state.tableId = id;
      history.replaceState(null, '', '?score_id=' + id);
      loadTable();
    }
  });

  // 批量操作
  $('batchBtn').addEventListener('click', () => {
    setBatchMode(true);
    $('batchToast').classList.add('show');
  });
  $('btCancel').addEventListener('click', () => {
    setBatchMode(false);
    $('batchToast').classList.remove('show');
  });
  $('btConfirm').addEventListener('click', () => {
    const ids = getSelectedItemIds();
    if (!ids.length) { toast('请先选择要操作的学生', true); return; }
    const items = state.balances.filter(b => ids.includes(b.item_id));
    setBatchMode(false);
    $('batchToast').classList.remove('show');
    openModal(items);
  });

  loadTable().then(() => {
    connectWS(
      (table) => { applyTable(table); renderCards(); },
      () => { loadTableList(); },
    );
  });
}

boot();
