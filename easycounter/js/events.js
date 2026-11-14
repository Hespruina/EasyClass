
// 事件监听
// 名单输入页已改为「任务列表 + 新建弹窗」，uploadBtn / importBtn / cloudImportBtn
// 的绑定随旧页面一起移除（新入口在 tasks.js::initTaskUI 里）。
searchBtn.addEventListener('click', openLetterSearch);
settingsBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', closeSettings);
resetDataBtn.addEventListener('click', resetData);
finishBtn.addEventListener('click', openExportModal);

// 通用弹窗事件监听
customAlertBtn.addEventListener('click', closeCustomAlert);
customAlertModal.addEventListener('click', (e) => {
  if (e.target === customAlertModal) {
    closeCustomAlert();
  }
});
customConfirmOkBtn.addEventListener('click', handleCustomConfirmOk);
customConfirmCancelBtn.addEventListener('click', handleCustomConfirmCancel);
customConfirmModal.addEventListener('click', (e) => {
  if (e.target === customConfirmModal) {
    handleCustomConfirmCancel();
  }
});

// 重名处理弹窗事件监听
const duplicateHandleModal = document.getElementById('duplicateHandleModal');
const duplicateKeepAllBtn = document.getElementById('duplicateKeepAllBtn');
const duplicateDedupBtn = document.getElementById('duplicateDedupBtn');
duplicateKeepAllBtn.addEventListener('click', handleDuplicateKeepAll);
duplicateDedupBtn.addEventListener('click', handleDuplicateDedup);
duplicateHandleModal.addEventListener('click', (e) => {
  if (e.target === duplicateHandleModal) {
    handleDuplicateDedup();
  }
});

// 导出方式选择弹窗事件监听
exportExcelOption.addEventListener('click', handleExportExcel);
exportPosterOption.addEventListener('click', handleExportPoster);
exportBothOption.addEventListener('click', handleExportBoth);
cancelExportBtn.addEventListener('click', closeExportModal);
exportModal.addEventListener('click', (e) => {
	if (e.target === exportModal) {
		closeExportModal();
	}
});

// 海报编辑页面事件监听
closePosterEditBtn.addEventListener('click', closePosterEdit);
regeneratePosterBtn.addEventListener('click', updatePosterPreview);
downloadPosterBtn.addEventListener('click', downloadPoster);
posterEditModal.addEventListener('click', (e) => {
	if (e.target === posterEditModal) {
		closePosterEdit();
	}
});

// 海报配置输入事件 - 自动刷新海报
let posterUpdateTimeout = null;

function schedulePosterUpdate() {
if (posterUpdateTimeout) {
clearTimeout(posterUpdateTimeout);
}
posterUpdateTimeout = setTimeout(() => {
updatePosterPreview();
}, 300);
}

// 自定义主题下拉菜单事件处理
const posterThemeSelectWrapper = document.getElementById('posterThemeSelectWrapper');
const posterThemeTrigger = document.getElementById('posterThemeSelect');
const posterThemeDropdown = document.getElementById('posterThemeDropdown');
const posterThemeTriggerIcon = posterThemeTrigger?.querySelector('.custom-select-theme-icon');
const posterThemeTriggerText = posterThemeTrigger?.querySelector('.custom-select-text');

if (posterThemeSelectWrapper && posterThemeTrigger && posterThemeDropdown) {
  // 点击触发下拉
  posterThemeTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = posterThemeDropdown.classList.contains('open');
    
    if (isOpen) {
      posterThemeDropdown.classList.remove('open');
      posterThemeTrigger.classList.remove('open');
    } else {
      posterThemeDropdown.classList.add('open');
      posterThemeTrigger.classList.add('open');
    }
  });
  
  // 点击选项
  posterThemeDropdown.addEventListener('click', (e) => {
    const option = e.target.closest('.custom-select-option');
    if (!option) return;
    
    const themeId = option.value;
    const themeConfig = getThemeConfig(themeId);
    currentPosterConfig.themeId = themeId;
    
    if (themeConfig.defaultColors) {
      currentPosterConfig.titleColor = themeConfig.defaultColors.titleColor;
      currentPosterConfig.bgColor = themeConfig.defaultColors.bgColor;
      currentPosterConfig.rankColor = themeConfig.defaultColors.rankColor;
      currentPosterConfig.scoreColor = themeConfig.defaultColors.scoreColor;
    }
    
    posterTitleInput.value = '易计票 结果';
    posterTitleColor.value = currentPosterConfig.titleColor;
    posterTitleColorValue.textContent = currentPosterConfig.titleColor;
    
    const bgValue = currentPosterConfig.bgColor;
    posterBgColor.value = bgValue;
    posterBgColorValue.textContent = bgValue;
    
    posterRankColor.value = currentPosterConfig.rankColor;
    posterRankColorValue.textContent = currentPosterConfig.rankColor;
    posterScoreColor.value = currentPosterConfig.scoreColor;
    posterScoreColorValue.textContent = currentPosterConfig.scoreColor;
    
    const themeName = option.querySelector('.custom-select-option-name').textContent;
    const gradient = option.querySelector('.custom-select-option-icon').style.background;
    posterThemeTriggerText.textContent = themeName;
    posterThemeTriggerIcon.style.background = gradient;
    
    document.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    
    posterThemeDropdown.classList.remove('open');
    posterThemeTrigger.classList.remove('open');
    
    schedulePosterUpdate();
  });
  
  // 点击外部关闭下拉菜单
  document.addEventListener('click', (e) => {
    if (!posterThemeSelectWrapper.contains(e.target)) {
      posterThemeDropdown.classList.remove('open');
      posterThemeTrigger.classList.remove('open');
    }
  });
}

posterTitleInput.addEventListener('input', (e) => {
currentPosterConfig.title = e.target.value || '易计票 结果';
schedulePosterUpdate();
});

posterTitleColor.addEventListener('input', (e) => {
currentPosterConfig.titleColor = e.target.value;
posterTitleColorValue.textContent = e.target.value;
schedulePosterUpdate();
});

posterBgColor.addEventListener('input', (e) => {
currentPosterConfig.bgColor = e.target.value;
posterBgColorValue.textContent = e.target.value;
schedulePosterUpdate();
});

posterRankColor.addEventListener('input', (e) => {
currentPosterConfig.rankColor = e.target.value;
posterRankColorValue.textContent = e.target.value;
schedulePosterUpdate();
});

posterScoreColor.addEventListener('input', (e) => {
currentPosterConfig.scoreColor = e.target.value;
posterScoreColorValue.textContent = e.target.value;
schedulePosterUpdate();
});

posterTopCount.addEventListener('input', (e) => {
currentPosterConfig.topCount = parseInt(e.target.value);
posterTopCountValue.textContent = e.target.value;
schedulePosterUpdate();
});

settingsModal.addEventListener('click', (e) => {
if (e.target === settingsModal) {
closeSettings();
}
});
letterSearchModal.addEventListener('click', (e) => {
if (e.target === letterSearchModal) {
closeLetterSearch();
}
});
searchPermanentBtn.addEventListener('click', () => setSearchMode('permanent'));
searchModalBtn.addEventListener('click', () => setSearchMode('modal'));
themeSystemBtn.addEventListener('click', () => setThemeOption('system'));
themeLightBtn.addEventListener('click', () => setThemeOption('light'));
themeDarkBtn.addEventListener('click', () => setThemeOption('dark'));
// 编辑名单事件
editNamesBtn.addEventListener('click', openEditNamesModal);
saveNamesBtn.addEventListener('click', saveEditedNames);
cancelEditNamesBtn.addEventListener('click', closeEditNamesModal);
addNameBtn.addEventListener('click', handleAddName);
closeEditNamesBtn.addEventListener('click', closeEditNamesModal);
batchSelectBtn.addEventListener('click', toggleBatchSelectMode);
batchDeleteBtn.addEventListener('click', batchDeleteSelected);
cancelBatchBtn.addEventListener('click', cancelBatchMode);
clearAllNamesBtn.addEventListener('click', clearAllNames);
const saveCloudNamesBtn = document.getElementById('saveCloudNamesBtn');
if (saveCloudNamesBtn) {
    saveCloudNamesBtn.addEventListener('click', openSaveCloudNamesModal);
}
const createNewListOption = document.getElementById('createNewListOption');
const overwriteListOption = document.getElementById('overwriteListOption');
if (createNewListOption) {
    createNewListOption.addEventListener('click', handleSelectNewListMode);
}
if (overwriteListOption) {
    overwriteListOption.addEventListener('click', handleSelectOverwriteMode);
}
const newListNameInput = document.getElementById('newListNameInput');
if (newListNameInput) {
    newListNameInput.addEventListener('input', updateSaveCloudConfirmButton);
}
const cancelSaveCloudBtn = document.getElementById('cancelSaveCloudBtn');
const confirmSaveCloudBtn = document.getElementById('confirmSaveCloudBtn');
const saveCloudNamesModal = document.getElementById('saveCloudNamesModal');
if (cancelSaveCloudBtn) {
    cancelSaveCloudBtn.addEventListener('click', closeSaveCloudNamesModal);
}
if (confirmSaveCloudBtn) {
    confirmSaveCloudBtn.addEventListener('click', handleConfirmSaveCloud);
}
if (saveCloudNamesModal) {
    saveCloudNamesModal.addEventListener('click', (e) => {
        if (e.target === saveCloudNamesModal) {
            closeSaveCloudNamesModal();
        }
    });
}
editNamesModal.addEventListener('click', (e) => {
if (e.target === editNamesModal) {
closeEditNamesModal();
}
});
window.addEventListener('touchmove', handleTouchMove, {passive: false});
document.addEventListener('contextmenu', e => {
    // 不禁用输入框的右键菜单
    const target = e.target;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        return;
    }
    e.preventDefault();
});
document.addEventListener('keydown', e => {
if (['F12', 'U', 'I', 'J'].includes(e.key.toUpperCase()) && (e.ctrlKey || e.shiftKey || e.key === 'F12')) e.preventDefault();
if (e.ctrlKey && ['+', '-', '0', 'r'].includes(e.key)) e.preventDefault();
// ESC 键关闭弹窗
const createTaskModal = document.getElementById('createTaskModal');
const editTaskModal = document.getElementById('editTaskModal');
if (e.key === 'Escape') {
if (createTaskModal.classList.contains('show')) {
closeCreateTaskModal();
} else if (editTaskModal.classList.contains('show')) {
closeEditTaskModal();
} else if (exportModal.classList.contains('show')) {
closeExportModal();
} else if (posterEditModal.classList.contains('show')) {
closePosterEdit();
} else if (editNamesModal.classList.contains('show')) {
closeEditNamesModal();
} else if (letterSearchModal.classList.contains('show')) {
closeLetterSearch();
} else if (settingsModal.classList.contains('show')) {
closeSettings();
}
// 操作方式检测已改为全自动，无需弹窗交互
}
// 键盘快速搜索：按下 A-Z 字母键触发搜索（只在计票页生效）
const key = e.key.toUpperCase();
if (/^[A-Z]$/.test(key) && currentTaskId && appState.namesData.length > 0) {
const hasAnyModal = createTaskModal.classList.contains('show')
|| editTaskModal.classList.contains('show')
|| exportModal.classList.contains('show')
|| posterEditModal.classList.contains('show')
|| editNamesModal.classList.contains('show')
|| letterSearchModal.classList.contains('show')
|| settingsModal.classList.contains('show')
|| customAlertModal.classList.contains('show')
|| duplicateHandleModal.classList.contains('show')
|| customConfirmModal.classList.contains('show');
if (!hasAnyModal) {
e.preventDefault();
handleLetterClick(key);
}
}
});
// 页面加载：先拉云端任务列表，再处理从易点名 / 云名单带回来的名单 token
window.addEventListener('load', async () => {
    await bootstrapTasks();
    await checkImportTokenAndOpenCreate();
});