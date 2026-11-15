// 易积分 · 通用 UI：toast / loading / 转义
let toastTimer = null;

export function toast(msg, isError, ms) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('error', !!isError);
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2600);
}

export function showLoading(text) {
  const el = document.getElementById('loading');
  const t = document.getElementById('loadingText');
  if (t) t.textContent = text || '加载中…';
  if (el) el.classList.add('show');
}

export function hideLoading() {
  const el = document.getElementById('loading');
  if (el) el.classList.remove('show');
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}
