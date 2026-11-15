// 易积分 · 操作模态框（加分/扣分、分值、理由、草稿保留）
import { state } from './state.js';
import { apiPost, apiGet } from './api.js';
import { toast } from './ui.js';

let overlay, modalTitle, kindAdd, kindDeduct, valInput, valMinus, valPlus,
    quickBtns, reasonInput, reasonHistory, modalCancel, modalSave, modalClose;

let currentItems = [];   // [{item_id, name, ...}]
let currentKind = 'add';
let refreshFn = null;
let reasonsLoaded = false;

export function initModal(refs, refresh) {
  overlay = refs.overlay;
  modalTitle = refs.modalTitle;
  kindAdd = refs.kindAdd;
  kindDeduct = refs.kindDeduct;
  valInput = refs.valInput;
  valMinus = refs.valMinus;
  valPlus = refs.valPlus;
  quickBtns = refs.quickBtns;
  reasonInput = refs.reasonInput;
  reasonHistory = refs.reasonHistory;
  modalCancel = refs.modalCancel;
  modalSave = refs.modalSave;
  modalClose = refs.modalClose;
  refreshFn = refresh;

  // 加分/扣分二选一
  kindAdd.addEventListener('click', () => setKind('add'));
  kindDeduct.addEventListener('click', () => setKind('deduct'));
  // 加减按钮
  valMinus.addEventListener('click', () => stepValue(-1));
  valPlus.addEventListener('click', () => stepValue(1));
  // 1-10 快捷
  for (let i = 1; i <= 10; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'quick-btn';
    b.textContent = String(i);
    b.addEventListener('click', () => { valInput.value = String(i); });
    quickBtns.appendChild(b);
  }
  // 理由历史：聚焦显示，点击填充
  reasonInput.addEventListener('focus', () => {
    reasonHistory.classList.add('show');
    if (!reasonsLoaded) loadReasons();
  });
  // 关闭
  modalClose.addEventListener('click', () => closeModal(true));
  modalCancel.addEventListener('click', () => closeModal(true));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(true); });
  modalSave.addEventListener('click', save);
}

function setKind(kind) {
  currentKind = kind;
  kindAdd.classList.toggle('on', kind === 'add');
  kindDeduct.classList.toggle('on', kind === 'deduct');
}

function stepValue(delta) {
  let v = parseInt(valInput.value, 10);
  if (isNaN(v)) v = 0;
  v = Math.max(1, v + delta);
  valInput.value = String(v);
}

export function openModal(items) {
  currentItems = items;
  currentKind = 'add';
  setKind('add');

  if (items.length === 1) {
    const b = items[0];
    modalTitle.textContent = b.name;
    const draft = state.drafts.get(b.item_id);
    if (draft) {
      setKind(draft.kind);
      valInput.value = String(draft.value || 1);
      reasonInput.value = draft.reason || '';
    } else {
      valInput.value = '1';
      reasonInput.value = '';
    }
  } else {
    modalTitle.textContent = '已选 ' + items.length + ' 人';
    valInput.value = '1';
    reasonInput.value = '';
  }
  reasonHistory.classList.remove('show');
  overlay.classList.add('show');
  setTimeout(() => valInput.focus(), 30);
}

export function closeModal(saveDraft) {
  if (saveDraft && currentItems.length === 1) {
    const itemId = currentItems[0].item_id;
    state.drafts.set(itemId, {
      kind: currentKind,
      value: parseInt(valInput.value, 10) || 1,
      reason: reasonInput.value.trim(),
    });
  }
  overlay.classList.remove('show');
  currentItems = [];
  resetSaveBtn();
}

function resetSaveBtn() {
  modalSave.disabled = false;
  modalSave.textContent = '保存';
}

async function save() {
  const value = parseInt(valInput.value, 10);
  if (isNaN(value) || value < 1) { toast('请输入有效分值', true); return; }
  const reason = reasonInput.value.trim() || null;

  modalSave.disabled = true;
  modalSave.innerHTML = '<span class="spin"></span>保存中…';
  try {
    const body = {
      op: currentKind,
      items: currentItems.map(i => i.item_id),
      value,
      reason,
    };
    if (state.connId) body.conn_id = state.connId;
    await apiPost('/easycore/api/score/tables/' + state.tableId + '/ops', body);
    if (currentItems.length === 1) state.drafts.delete(currentItems[0].item_id);
    closeModal(false);
    if (refreshFn) await refreshFn();
  } catch (e) {
    toast(e.message, true);
    resetSaveBtn();
  }
}

async function loadReasons() {
  try {
    const data = await apiGet('/api/score/reasons');
    reasonsLoaded = true;
    reasonHistory.innerHTML = '';
    const list = data.reasons || [];
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'reason-item';
      empty.textContent = '暂无历史理由';
      reasonHistory.appendChild(empty);
      return;
    }
    list.forEach(r => {
      const item = document.createElement('div');
      item.className = 'reason-item';
      item.textContent = r.text;
      item.addEventListener('click', () => {
        reasonInput.value = r.text;
        reasonHistory.classList.remove('show');
        reasonInput.focus();
      });
      reasonHistory.appendChild(item);
    });
  } catch (e) {
    /* 理由历史加载失败静默忽略 */
  }
}
