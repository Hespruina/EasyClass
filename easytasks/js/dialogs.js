// 通用提示弹窗函数
function showCustomAlert(message, title = '提示') {
  customAlertTitle.textContent = title;
  customAlertText.textContent = message;
  customAlertModal.classList.add('show');
}

function closeCustomAlert() {
  const promptPanel = customAlertModal.querySelector('.prompt-panel');
  promptPanel.style.animation = 'slideOut 0.3s ease-out forwards';
  customAlertModal.classList.add('hiding');
  setTimeout(() => {
    customAlertModal.classList.remove('show');
    customAlertModal.classList.remove('hiding');
    promptPanel.style.animation = '';
  }, 300);
}

// 通用确认弹窗函数
let customConfirmCallback = null;

function showCustomConfirm(message, callback, title = '确认') {
  customConfirmTitle.textContent = title;
  // 使用 innerHTML 以支持 HTML 内容
  customConfirmText.innerHTML = message;
  customConfirmCallback = callback;
  customConfirmModal.classList.add('show');
}

function closeCustomConfirm() {
  const promptPanel = customConfirmModal.querySelector('.prompt-panel');
  promptPanel.style.animation = 'slideOut 0.3s ease-out forwards';
  customConfirmModal.classList.add('hiding');
  setTimeout(() => {
    customConfirmModal.classList.remove('show');
    customConfirmModal.classList.remove('hiding');
    promptPanel.style.animation = '';
  }, 300);
}

function handleCustomConfirmOk() {
  closeCustomConfirm();
  if (customConfirmCallback) {
    customConfirmCallback(true);
    customConfirmCallback = null;
  }
}

function handleCustomConfirmCancel() {
  closeCustomConfirm();
  if (customConfirmCallback) {
    customConfirmCallback(false);
    customConfirmCallback = null;
  }
}

// 名单对比函数 - 比较两个名单是否完全相同
function compareNamesList(savedNames, newNames) {
  if (!savedNames || !newNames) return false;
  if (savedNames.length !== newNames.length) return false;

  const savedSet = new Set(savedNames.map(n => n.name || n));
  const newSet = new Set(newNames);

  if (savedSet.size !== newSet.size) return false;

  for (const name of savedSet) {
    if (!newSet.has(name)) return false;
  }
  return true;
}
