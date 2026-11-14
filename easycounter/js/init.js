// 初始化主应用 UI（操作方式不再弹窗确认：初始按设备指针自动判定，
// 运行中由 setupGridMismatchDetection 检测到不同输入时静默自动切换）
function initMainAppUI() {
renderGrid();
updateRankList(true);
updateTotal();
setupResize();
initLetterGrid();
initQuickSearchGrid();
updateSearchModeUI();
updateQuickSearchGrid();
populateThemeSelect();
}
// 初始化主应用
function initMainApp() {
initMainAppUI();
}
