
// ==================== 主界面按钮 ====================
searchBtn.addEventListener('click', openLetterSearch);
settingsBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', closeSettings);
resetDataBtn.addEventListener('click', resetData);
finishBtn.addEventListener('click', function () { exportToExcel(currentTaskName); });

// ==================== 学生进度 / 星级弹窗 ====================
closeStudentModalBtn.addEventListener('click', closeStudentModal);
studentModal.addEventListener('click', function (e) {
    if (e.target === studentModal) closeStudentModal();
});
studentProgressRange.addEventListener('input', function (e) {
    previewStudentProgress(e.target.value);
});
studentProgressRange.addEventListener('change', function (e) {
    commitStudentProgress(e.target.value);
});
// 一次完成：勾选 = 已完成，取消勾选 = 未完成
studentOnceCheckbox.addEventListener('change', function () {
    commitStudentProgress(studentOnceCheckbox.checked ? 100 : 0);
});

// ==================== 通用弹窗 ====================
customAlertBtn.addEventListener('click', closeCustomAlert);
customAlertModal.addEventListener('click', function (e) {
    if (e.target === customAlertModal) closeCustomAlert();
});
customConfirmOkBtn.addEventListener('click', handleCustomConfirmOk);
customConfirmCancelBtn.addEventListener('click', handleCustomConfirmCancel);
customConfirmModal.addEventListener('click', function (e) {
    if (e.target === customConfirmModal) handleCustomConfirmCancel();
});

// 重名处理弹窗
const duplicateHandleModal = document.getElementById('duplicateHandleModal');
const duplicateKeepAllBtn = document.getElementById('duplicateKeepAllBtn');
const duplicateDedupBtn = document.getElementById('duplicateDedupBtn');
duplicateKeepAllBtn.addEventListener('click', handleDuplicateKeepAll);
duplicateDedupBtn.addEventListener('click', handleDuplicateDedup);
duplicateHandleModal.addEventListener('click', function (e) {
    if (e.target === duplicateHandleModal) handleDuplicateDedup();
});

// ==================== 设置 / 查找 ====================
settingsModal.addEventListener('click', function (e) {
    if (e.target === settingsModal) closeSettings();
});
letterSearchModal.addEventListener('click', function (e) {
    if (e.target === letterSearchModal) closeLetterSearch();
});
searchPermanentBtn.addEventListener('click', function () { setSearchMode('permanent'); });
searchModalBtn.addEventListener('click', function () { setSearchMode('modal'); });
themeSystemBtn.addEventListener('click', function () { setThemeOption('system'); });
themeLightBtn.addEventListener('click', function () { setThemeOption('light'); });
themeDarkBtn.addEventListener('click', function () { setThemeOption('dark'); });
// 名字卡片布局：混排 / 按拼音分行
if (layoutMixedBtn) layoutMixedBtn.addEventListener('click', function () { setCardLayout('mixed'); });
if (layoutPinyinBtn) layoutPinyinBtn.addEventListener('click', function () { setCardLayout('pinyin'); });

// ==================== 编辑名单 ====================
editNamesBtn.addEventListener('click', openEditNamesModal);
saveNamesBtn.addEventListener('click', saveEditedNames);
cancelEditNamesBtn.addEventListener('click', closeEditNamesModal);
addNameBtn.addEventListener('click', handleAddName);
closeEditNamesBtn.addEventListener('click', closeEditNamesModal);
batchSelectBtn.addEventListener('click', toggleBatchSelectMode);
batchDeleteBtn.addEventListener('click', batchDeleteSelected);
cancelBatchBtn.addEventListener('click', cancelBatchMode);
clearAllNamesBtn.addEventListener('click', clearAllNames);
editNamesModal.addEventListener('click', function (e) {
    if (e.target === editNamesModal) closeEditNamesModal();
});

// 保存到云名单
const saveCloudNamesBtn = document.getElementById('saveCloudNamesBtn');
if (saveCloudNamesBtn) saveCloudNamesBtn.addEventListener('click', openSaveCloudNamesModal);
const createNewListOption = document.getElementById('createNewListOption');
const overwriteListOption = document.getElementById('overwriteListOption');
if (createNewListOption) createNewListOption.addEventListener('click', handleSelectNewListMode);
if (overwriteListOption) overwriteListOption.addEventListener('click', handleSelectOverwriteMode);
const newListNameInput = document.getElementById('newListNameInput');
if (newListNameInput) newListNameInput.addEventListener('input', updateSaveCloudConfirmButton);
const cancelSaveCloudBtn = document.getElementById('cancelSaveCloudBtn');
const confirmSaveCloudBtn = document.getElementById('confirmSaveCloudBtn');
const saveCloudNamesModal = document.getElementById('saveCloudNamesModal');
if (cancelSaveCloudBtn) cancelSaveCloudBtn.addEventListener('click', closeSaveCloudNamesModal);
if (confirmSaveCloudBtn) confirmSaveCloudBtn.addEventListener('click', handleConfirmSaveCloud);
if (saveCloudNamesModal) {
    saveCloudNamesModal.addEventListener('click', function (e) {
        if (e.target === saveCloudNamesModal) closeSaveCloudNamesModal();
    });
}

// ==================== 全局行为 ====================
document.addEventListener('contextmenu', function (e) {
    // 不禁用输入框的右键菜单
    const target = e.target;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;
    e.preventDefault();
});

document.addEventListener('keydown', function (e) {
    if (['F12', 'U', 'I', 'J'].includes(e.key.toUpperCase()) && (e.ctrlKey || e.shiftKey || e.key === 'F12')) e.preventDefault();
    if (e.ctrlKey && ['+', '-', '0', 'r'].includes(e.key)) e.preventDefault();

    const createTaskModal = document.getElementById('createTaskModal');
    const editTaskModal = document.getElementById('editTaskModal');
    if (e.key === 'Escape') {
        if (createTaskModal.classList.contains('show')) {
            closeCreateTaskModal();
        } else if (editTaskModal.classList.contains('show')) {
            closeEditTaskModal();
        } else if (studentModal.classList.contains('show')) {
            closeStudentModal();
        } else if (editNamesModal.classList.contains('show')) {
            closeEditNamesModal();
        } else if (letterSearchModal.classList.contains('show')) {
            closeLetterSearch();
        } else if (settingsModal.classList.contains('show')) {
            closeSettings();
        }
    }

    // 键盘快速搜索：按下 A-Z 字母键触发搜索（只在任务详情页生效）
    const key = e.key.toUpperCase();
    if (/^[A-Z]$/.test(key) && currentTaskId && appState.namesData.length > 0) {
        const target = e.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        const hasAnyModal = createTaskModal.classList.contains('show') ||
            editTaskModal.classList.contains('show') ||
            studentModal.classList.contains('show') ||
            editNamesModal.classList.contains('show') ||
            letterSearchModal.classList.contains('show') ||
            settingsModal.classList.contains('show') ||
            customAlertModal.classList.contains('show') ||
            duplicateHandleModal.classList.contains('show') ||
            customConfirmModal.classList.contains('show');
        if (!hasAnyModal) {
            e.preventDefault();
            handleLetterClick(key);
        }
    }
});

// 页面加载：先拉云端任务列表，再处理从易点名 / 云名单带回来的名单 token
window.addEventListener('load', async function () {
    ensureStarButtons();
    await bootstrapTasks();
    // 控制台「教学任务」点「打开」会带 ?task_id=，直接进入那个任务
    if (await enterTaskFromUrl()) return;
    await checkImportTokenAndOpenCreate();
});
