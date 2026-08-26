
// 事件监听
uploadBtn.addEventListener('click', uploadNames);
importBtn.addEventListener('click', importFromRandamer);
cloudImportBtn.addEventListener('click', importFromCloudList);
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

// 继续计票弹窗事件监听
continueVoteModal.addEventListener('click', (e) => {
  if (e.target === continueVoteModal) {
    // 点击背景不关闭，必须做出选择
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
modeMouseBtn.addEventListener('click', () => setTouchMode('mouse'));
modeTouchBtn.addEventListener('click', () => setTouchMode('touch'));
searchPermanentBtn.addEventListener('click', () => setSearchMode('permanent'));
searchModalBtn.addEventListener('click', () => setSearchMode('modal'));
themeSystemBtn.addEventListener('click', () => setThemeOption('system'));
themeLightBtn.addEventListener('click', () => setThemeOption('light'));
themeDarkBtn.addEventListener('click', () => setThemeOption('dark'));
// 操作方式选择事件

keepCurrentModeBtn.addEventListener('click', closeModeMismatchPrompt);
switchModeBtn.addEventListener('click', switchModeAndClose);
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
inputModeModal.addEventListener('click', (e) => {
if (e.target === inputModeModal) {
// 点击背景不关闭，必须选择一种方式
}
});
modeMismatchModal.addEventListener('click', (e) => {
if (e.target === modeMismatchModal && !sessionState.modalJustOpened) {
closeModeMismatchPrompt();
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
if (e.key === 'Escape') {
if (exportModal.classList.contains('show')) {
closeExportModal();
} else if (posterEditModal.classList.contains('show')) {
closePosterEdit();
} else if (editNamesModal.classList.contains('show')) {
closeEditNamesModal();
} else if (letterSearchModal.classList.contains('show')) {
closeLetterSearch();
} else if (settingsModal.classList.contains('show')) {
closeSettings();
} else if (modeMismatchModal.classList.contains('show')) {
closeModeMismatchPrompt();
}
// 操作方式选择弹窗和继续计票弹窗不能用 ESC 关闭
}
// 键盘快速搜索：按下 A-Z 字母键触发搜索
const key = e.key.toUpperCase();
if (/^[A-Z]$/.test(key) && appState.namesData.length > 0) {
const hasAnyModal = exportModal.classList.contains('show')
|| posterEditModal.classList.contains('show')
|| editNamesModal.classList.contains('show')
|| letterSearchModal.classList.contains('show')
|| settingsModal.classList.contains('show')
|| modeMismatchModal.classList.contains('show')
|| inputModeModal.classList.contains('show')
|| customAlertModal.classList.contains('show')
|| duplicateHandleModal.classList.contains('show')
|| customConfirmModal.classList.contains('show')
|| continueVoteModal.classList.contains('show');
if (!hasAnyModal) {
e.preventDefault();
handleLetterClick(key);
}
}
});
// 页面加载时检查是否从易点名返回
window.addEventListener('load', async () => {
    const hasCloudToken = await checkCloudListTokenAndImport();
    if (!hasCloudToken) {
        checkTokenAndImport();
    }
});