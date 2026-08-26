// 显示操作方式不匹配提醒
function showModeMismatchPrompt(detectedMode) {
// 只有勾选了"不再提示"才不显示
if (sessionState.suppressMismatchPrompt) return;
// 如果检测到的模式与当前模式相同，不需要提示
if (appState.touchMode === detectedMode) return;
const currentModeText = appState.touchMode === 'touch' ? '触屏模式' : '鼠标模式';
const detectedModeText = detectedMode === 'touch' ? '触屏操作' : '鼠标操作';
const suggestedModeText = detectedMode === 'touch' ? '触屏模式' : '鼠标模式';
modeMismatchText.innerHTML = `
当前为<span style="color: var(--primary);">${currentModeText}</span>，
但检测到您使用了<span style="color: var(--primary);">${detectedModeText}</span>。<br><br>
是否切换到<span style="color: var(--gold);">${suggestedModeText}</span>以获得更好的体验？
`;
modeMismatchModal.classList.add('show');
// 标记弹窗刚打开，防止触摸生成的 click 事件立即关闭弹窗
sessionState.modalJustOpened = true;
setTimeout(() => {
sessionState.modalJustOpened = false;
}, 300);
}
// 关闭操作方式不匹配提醒
function closeModeMismatchPrompt() {
sessionState.suppressMismatchPrompt = suppressMismatchPromptCheckbox.checked;
const promptPanel = modeMismatchModal.querySelector('.prompt-panel');
promptPanel.style.animation = 'slideOut 0.3s ease-out forwards';
modeMismatchModal.classList.add('hiding');
setTimeout(() => {
modeMismatchModal.classList.remove('show');
modeMismatchModal.classList.remove('hiding');
promptPanel.style.animation = '';
}, 300);
}
// 切换操作模式并关闭弹窗
function switchModeAndClose() {
sessionState.suppressMismatchPrompt = suppressMismatchPromptCheckbox.checked;
const newMode = appState.touchMode === 'touch' ? 'mouse' : 'touch';
setTouchMode(newMode);
closeModeMismatchPrompt();
}
// 显示操作方式选择弹窗
function showInputModeModal() {
inputModeModal.classList.add('show');
}
// 关闭操作方式选择弹窗
function closeInputModeModal() {
const promptPanel = inputModeModal.querySelector('.prompt-panel');
promptPanel.style.animation = 'slideOut 0.3s ease-out forwards';
inputModeModal.classList.add('hiding');
setTimeout(() => {
inputModeModal.classList.remove('show');
inputModeModal.classList.remove('hiding');
promptPanel.style.animation = '';
}, 300);
}
// 检测操作方式（简单粗暴：检测 touch 事件）
function detectInputMode() {
const detectBall = document.getElementById('detectModeBall');
let hasTouch = false;
let hasClick = false;
let detected = false;

// 添加触摸事件监听
detectBall.addEventListener('touchstart', function onTouchStart(e) {
if (detected) return;
e.preventDefault(); // 防止触发 click
hasTouch = true;
detected = true;

// 显示检测动画
detectBall.classList.add('detecting');
detectBall.textContent = '触屏';

// 延迟一下设置模式并关闭
setTimeout(() => {
appState.touchMode = 'touch';
detectBall.classList.remove('detecting');
detectBall.classList.add('touch-mode');
setTimeout(() => {
closeInputModeModal();
initMainAppUI();
}, 500);
}, 300);
}, { once: true });

// 添加点击事件监听
detectBall.addEventListener('click', function onClick(e) {
if (detected) return;
hasClick = true;
detected = true;

// 显示检测动画
detectBall.classList.add('detecting');
detectBall.textContent = '鼠标';

// 延迟一下设置模式并关闭
setTimeout(() => {
appState.touchMode = 'mouse';
detectBall.classList.remove('detecting');
detectBall.classList.add('mouse-mode');
setTimeout(() => {
closeInputModeModal();
initMainAppUI();
}, 500);
}, 300);
}, { once: true });
}
// 初始化主应用 UI（在操作方式确定后调用）
function initMainAppUI() {
renderGrid();
updateRankList(true);
updateTotal();
setupResize();
updateTouchModeUI();
initLetterGrid();
initQuickSearchGrid();
updateSearchModeUI();
updateQuickSearchGrid();
populateThemeSelect();
}
// 初始化主应用
function initMainApp() {
// 显示操作方式选择弹窗
showInputModeModal();
// 绑定检测事件
detectInputMode();
}