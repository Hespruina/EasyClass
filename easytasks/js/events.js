
// 事件监听
//
// 结构说明：绑定逻辑按功能块拆进 safeBlock。
// 上游脚本若加载失败（CDN 返回 522/525 之类），对应块会抛 ReferenceError；
// 以前这会中断本文件后续全部绑定，导致页面看着正常但所有按钮失灵。
// 现在 safeBlock 只记录该块失败，其它块照常绑定。
(function () {
    'use strict';

    function safeBlock(label, fn) {
        try {
            fn();
        } catch (err) {
            console.error('[events] 事件绑定失败：' + label, err);
        }
    }

    // 被多个块引用，取值本身不会抛错，故提到块外
    var duplicateHandleModal = document.getElementById('duplicateHandleModal');

    // ==================== 主界面按钮 ====================
    safeBlock('主界面按钮', function () {
        searchBtn.addEventListener('click', openLetterSearch);
        settingsBtn.addEventListener('click', openSettings);
        closeSettingsBtn.addEventListener('click', closeSettings);
        resetDataBtn.addEventListener('click', resetData);
        finishBtn.addEventListener('click', function () { exportToExcel(currentTaskName); });
    });

    // ==================== 学生进度 / 星级弹窗 ====================
    safeBlock('学生进度弹窗', function () {
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
    });

    // ==================== 通用弹窗 ====================
    safeBlock('通用弹窗', function () {
        customAlertBtn.addEventListener('click', closeCustomAlert);
        customAlertModal.addEventListener('click', function (e) {
            if (e.target === customAlertModal) closeCustomAlert();
        });
        customConfirmOkBtn.addEventListener('click', handleCustomConfirmOk);
        customConfirmCancelBtn.addEventListener('click', handleCustomConfirmCancel);
        customConfirmModal.addEventListener('click', function (e) {
            if (e.target === customConfirmModal) handleCustomConfirmCancel();
        });
    });

    // ==================== 重名处理弹窗 ====================
    safeBlock('重名处理弹窗', function () {
        var duplicateKeepAllBtn = document.getElementById('duplicateKeepAllBtn');
        var duplicateDedupBtn = document.getElementById('duplicateDedupBtn');
        if (duplicateKeepAllBtn) {
            duplicateKeepAllBtn.addEventListener('click', handleDuplicateKeepAll);
        }
        if (duplicateDedupBtn) {
            duplicateDedupBtn.addEventListener('click', handleDuplicateDedup);
        }
        if (duplicateHandleModal) {
            duplicateHandleModal.addEventListener('click', function (e) {
                if (e.target === duplicateHandleModal) handleDuplicateDedup();
            });
        }
    });

    // ==================== 设置 / 查找 ====================
    safeBlock('设置 / 查找 / 主题 / 布局', function () {
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
    });

    // ==================== 编辑名单 ====================
    safeBlock('编辑名单', function () {
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
    });

    // ==================== 保存到云名单 ====================
    safeBlock('保存到云名单', function () {
        var saveCloudNamesBtn = document.getElementById('saveCloudNamesBtn');
        if (saveCloudNamesBtn) saveCloudNamesBtn.addEventListener('click', openSaveCloudNamesModal);
        var createNewListOption = document.getElementById('createNewListOption');
        var overwriteListOption = document.getElementById('overwriteListOption');
        if (createNewListOption) createNewListOption.addEventListener('click', handleSelectNewListMode);
        if (overwriteListOption) overwriteListOption.addEventListener('click', handleSelectOverwriteMode);
        var newListNameInput = document.getElementById('newListNameInput');
        if (newListNameInput) newListNameInput.addEventListener('input', updateSaveCloudConfirmButton);
        var cancelSaveCloudBtn = document.getElementById('cancelSaveCloudBtn');
        var confirmSaveCloudBtn = document.getElementById('confirmSaveCloudBtn');
        var saveCloudNamesModal = document.getElementById('saveCloudNamesModal');
        if (cancelSaveCloudBtn) cancelSaveCloudBtn.addEventListener('click', closeSaveCloudNamesModal);
        if (confirmSaveCloudBtn) confirmSaveCloudBtn.addEventListener('click', handleConfirmSaveCloud);
        if (saveCloudNamesModal) {
            saveCloudNamesModal.addEventListener('click', function (e) {
                if (e.target === saveCloudNamesModal) closeSaveCloudNamesModal();
            });
        }
    });

    // ==================== 全局行为 ====================
    safeBlock('禁用右键', function () {
        document.addEventListener('contextmenu', function (e) {
            // 不禁用输入框的右键菜单
            var target = e.target;
            if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;
            e.preventDefault();
        });
    });

    safeBlock('键盘快捷键', function () {
        document.addEventListener('keydown', function (e) {
            if (['F12', 'U', 'I', 'J'].includes(e.key.toUpperCase()) && (e.ctrlKey || e.shiftKey || e.key === 'F12')) e.preventDefault();
            if (e.ctrlKey && ['+', '-', '0', 'r'].includes(e.key)) e.preventDefault();

            var createTaskModal = document.getElementById('createTaskModal');
            var editTaskModal = document.getElementById('editTaskModal');
            if (e.key === 'Escape') {
                if (createTaskModal && createTaskModal.classList.contains('show')) {
                    closeCreateTaskModal();
                } else if (editTaskModal && editTaskModal.classList.contains('show')) {
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
            var key = e.key.toUpperCase();
            if (/^[A-Z]$/.test(key) && currentTaskId && appState.namesData.length > 0) {
                var target = e.target;
                if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
                var hasAnyModal = (createTaskModal && createTaskModal.classList.contains('show')) ||
                    (editTaskModal && editTaskModal.classList.contains('show')) ||
                    studentModal.classList.contains('show') ||
                    editNamesModal.classList.contains('show') ||
                    letterSearchModal.classList.contains('show') ||
                    settingsModal.classList.contains('show') ||
                    customAlertModal.classList.contains('show') ||
                    (duplicateHandleModal && duplicateHandleModal.classList.contains('show')) ||
                    customConfirmModal.classList.contains('show');
                if (!hasAnyModal) {
                    e.preventDefault();
                    handleLetterClick(key);
                }
            }
        });
    });

    // 页面加载：先拉云端任务列表，再处理从易点名 / 云名单带回来的名单 token
    window.addEventListener('load', function () {
        (async function () {
            ensureStarButtons();
            await bootstrapTasks();
            // 控制台「教学任务」点「打开」会带 ?task_id=，直接进入那个任务
            if (await enterTaskFromUrl()) return;
            await checkImportTokenAndOpenCreate();
        })().catch(function (err) {
            console.error('[events] 页面初始化失败', err);
        });
    });
})();
