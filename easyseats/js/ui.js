/* ==========================================================================
 * 易排座 · 通用 UI：加载遮罩、Toast、提示浮层
 * 拆分自原 index.html 内联脚本，逻辑逐字保留。
 * ========================================================================== */

import {
  chart, loadingEl, loadingText, notice, noticeGoBtn, noticeText, noticeTitle, setToastTimer,
  toastEl, toastText, toastTimer
} from './state.js';
import { updateEmpty } from './seat.js';

  export function showLoading(text) {
    loadingText.textContent = text || '加载中…';
    loadingEl.classList.add('show');
  }
  export function hideLoading() {
    loadingEl.classList.remove('show');
  }
  export function toast(msg, isError, ms) {
    toastText.textContent = msg;
    toastEl.classList.toggle('error', !!isError);
    toastEl.classList.remove('busy');   // 普通提示一定不带转圈
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    setToastTimer(setTimeout(() => toastEl.classList.remove('show'), ms || 2600));
  }

  // 「保存中」提示：转圈 + 文案，不自动收回，直到 toast() / busyDone() 接手
  export function busyToast(msg) {
    if (toastTimer) { clearTimeout(toastTimer); setToastTimer(null); }
    toastText.textContent = msg || '正在保存修改…';
    toastEl.classList.remove('error');
    toastEl.classList.add('busy', 'show');
  }

  export function showNotice(title, text, showGo, goLabel) {
    noticeTitle.textContent = title;
    noticeText.innerHTML = text;
    noticeGoBtn.style.display = showGo ? '' : 'none';
    // 有座位表就能原地切到「格局编辑」，没座位表才需要回控制台
    if (showGo) noticeGoBtn.textContent = goLabel || (chart ? '切到「格局编辑」摆座位' : '去 EasyCore 设定座位格局');
    notice.classList.add('show');
    updateEmpty();
  }
  export function hideNotice() {
    notice.classList.remove('show');
    updateEmpty();
  }

  /* ================================================================
   *  模式初始化
   * ================================================================ */

  export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML.replace(/'/g, '&#39;');
  }
