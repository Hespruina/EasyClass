// 初始化主应用 UI：渲染学生卡片 + 完成情况总览 + 快速查找
function initMainAppUI() {
    renderGrid();
    renderOverview();
    initLetterGrid();
    initQuickSearchGrid();
    updateSearchModeUI();
    updateQuickSearchGrid();
    updateCardLayoutUI();
}

// 初始化主应用
function initMainApp() {
    initMainAppUI();
}
