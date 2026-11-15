
// 事件监听
// 名单输入页已改为「任务列表 + 新建弹窗」，uploadBtn / importBtn / cloudImportBtn
// 的绑定随旧页面一起移除（新入口在 tasks.js::initTaskUI 里）。
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

  // 以下两项被多个块引用，且取值本身不会抛错，故提到块外
  var duplicateHandleModal = document.getElementById('duplicateHandleModal');
  var posterUpdateTimeout = null;

  // 海报配置输入事件 - 自动刷新海报
  function schedulePosterUpdate() {
    if (posterUpdateTimeout) {
      clearTimeout(posterUpdateTimeout);
    }
    posterUpdateTimeout = setTimeout(function () {
      try {
        updatePosterPreview();
      } catch (err) {
        console.error('[events] 海报预览刷新失败', err);
      }
    }, 300);
  }

  safeBlock('主界面按钮', function () {
    searchBtn.addEventListener('click', openLetterSearch);
    settingsBtn.addEventListener('click', openSettings);
    closeSettingsBtn.addEventListener('click', closeSettings);
    resetDataBtn.addEventListener('click', resetData);
    finishBtn.addEventListener('click', openExportModal);
  });

  safeBlock('通用弹窗', function () {
    customAlertBtn.addEventListener('click', closeCustomAlert);
    customAlertModal.addEventListener('click', function (e) {
      if (e.target === customAlertModal) {
        closeCustomAlert();
      }
    });
    customConfirmOkBtn.addEventListener('click', handleCustomConfirmOk);
    customConfirmCancelBtn.addEventListener('click', handleCustomConfirmCancel);
    customConfirmModal.addEventListener('click', function (e) {
      if (e.target === customConfirmModal) {
        handleCustomConfirmCancel();
      }
    });
  });

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
        if (e.target === duplicateHandleModal) {
          handleDuplicateDedup();
        }
      });
    }
  });

  safeBlock('导出方式选择弹窗', function () {
    exportExcelOption.addEventListener('click', handleExportExcel);
    exportPosterOption.addEventListener('click', handleExportPoster);
    exportBothOption.addEventListener('click', handleExportBoth);
    cancelExportBtn.addEventListener('click', closeExportModal);
    exportModal.addEventListener('click', function (e) {
      if (e.target === exportModal) {
        closeExportModal();
      }
    });
  });

  safeBlock('海报编辑弹窗', function () {
    closePosterEditBtn.addEventListener('click', closePosterEdit);
    regeneratePosterBtn.addEventListener('click', updatePosterPreview);
    downloadPosterBtn.addEventListener('click', downloadPoster);
    posterEditModal.addEventListener('click', function (e) {
      if (e.target === posterEditModal) {
        closePosterEdit();
      }
    });
  });

  safeBlock('海报主题下拉', function () {
    var posterThemeSelectWrapper = document.getElementById('posterThemeSelectWrapper');
    var posterThemeTrigger = document.getElementById('posterThemeSelect');
    var posterThemeDropdown = document.getElementById('posterThemeDropdown');
    var posterThemeTriggerIcon = posterThemeTrigger ? posterThemeTrigger.querySelector('.custom-select-theme-icon') : null;
    var posterThemeTriggerText = posterThemeTrigger ? posterThemeTrigger.querySelector('.custom-select-text') : null;

    if (posterThemeSelectWrapper && posterThemeTrigger && posterThemeDropdown) {
      // 点击触发下拉
      posterThemeTrigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = posterThemeDropdown.classList.contains('open');

        if (isOpen) {
          posterThemeDropdown.classList.remove('open');
          posterThemeTrigger.classList.remove('open');
        } else {
          posterThemeDropdown.classList.add('open');
          posterThemeTrigger.classList.add('open');
        }
      });

      // 点击选项
      posterThemeDropdown.addEventListener('click', function (e) {
        var option = e.target.closest('.custom-select-option');
        if (!option) return;

        var themeId = option.value;
        var themeConfig = getThemeConfig(themeId);
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

        var bgValue = currentPosterConfig.bgColor;
        posterBgColor.value = bgValue;
        posterBgColorValue.textContent = bgValue;

        posterRankColor.value = currentPosterConfig.rankColor;
        posterRankColorValue.textContent = currentPosterConfig.rankColor;
        posterScoreColor.value = currentPosterConfig.scoreColor;
        posterScoreColorValue.textContent = currentPosterConfig.scoreColor;

        var themeName = option.querySelector('.custom-select-option-name').textContent;
        var gradient = option.querySelector('.custom-select-option-icon').style.background;
        if (posterThemeTriggerText) posterThemeTriggerText.textContent = themeName;
        if (posterThemeTriggerIcon) posterThemeTriggerIcon.style.background = gradient;

        document.querySelectorAll('.custom-select-option').forEach(function (opt) {
          opt.classList.remove('selected');
        });
        option.classList.add('selected');

        posterThemeDropdown.classList.remove('open');
        posterThemeTrigger.classList.remove('open');

        schedulePosterUpdate();
      });

      // 点击外部关闭下拉菜单
      document.addEventListener('click', function (e) {
        if (!posterThemeSelectWrapper.contains(e.target)) {
          posterThemeDropdown.classList.remove('open');
          posterThemeTrigger.classList.remove('open');
        }
      });
    }
  });

  safeBlock('海报配置输入', function () {
    posterTitleInput.addEventListener('input', function (e) {
      currentPosterConfig.title = e.target.value || '易计票 结果';
      schedulePosterUpdate();
    });

    posterTitleColor.addEventListener('input', function (e) {
      currentPosterConfig.titleColor = e.target.value;
      posterTitleColorValue.textContent = e.target.value;
      schedulePosterUpdate();
    });

    posterBgColor.addEventListener('input', function (e) {
      currentPosterConfig.bgColor = e.target.value;
      posterBgColorValue.textContent = e.target.value;
      schedulePosterUpdate();
    });

    posterRankColor.addEventListener('input', function (e) {
      currentPosterConfig.rankColor = e.target.value;
      posterRankColorValue.textContent = e.target.value;
      schedulePosterUpdate();
    });

    posterScoreColor.addEventListener('input', function (e) {
      currentPosterConfig.scoreColor = e.target.value;
      posterScoreColorValue.textContent = e.target.value;
      schedulePosterUpdate();
    });

    posterTopCount.addEventListener('input', function (e) {
      currentPosterConfig.topCount = parseInt(e.target.value);
      posterTopCountValue.textContent = e.target.value;
      schedulePosterUpdate();
    });
  });

  safeBlock('设置 / 查找 / 主题 / 布局', function () {
    settingsModal.addEventListener('click', function (e) {
      if (e.target === settingsModal) {
        closeSettings();
      }
    });
    letterSearchModal.addEventListener('click', function (e) {
      if (e.target === letterSearchModal) {
        closeLetterSearch();
      }
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
      if (e.target === editNamesModal) {
        closeEditNamesModal();
      }
    });
  });

  safeBlock('保存到云名单', function () {
    var saveCloudNamesBtn = document.getElementById('saveCloudNamesBtn');
    if (saveCloudNamesBtn) {
      saveCloudNamesBtn.addEventListener('click', openSaveCloudNamesModal);
    }
    var createNewListOption = document.getElementById('createNewListOption');
    var overwriteListOption = document.getElementById('overwriteListOption');
    if (createNewListOption) {
      createNewListOption.addEventListener('click', handleSelectNewListMode);
    }
    if (overwriteListOption) {
      overwriteListOption.addEventListener('click', handleSelectOverwriteMode);
    }
    var newListNameInput = document.getElementById('newListNameInput');
    if (newListNameInput) {
      newListNameInput.addEventListener('input', updateSaveCloudConfirmButton);
    }
    var cancelSaveCloudBtn = document.getElementById('cancelSaveCloudBtn');
    var confirmSaveCloudBtn = document.getElementById('confirmSaveCloudBtn');
    var saveCloudNamesModal = document.getElementById('saveCloudNamesModal');
    if (cancelSaveCloudBtn) {
      cancelSaveCloudBtn.addEventListener('click', closeSaveCloudNamesModal);
    }
    if (confirmSaveCloudBtn) {
      confirmSaveCloudBtn.addEventListener('click', handleConfirmSaveCloud);
    }
    if (saveCloudNamesModal) {
      saveCloudNamesModal.addEventListener('click', function (e) {
        if (e.target === saveCloudNamesModal) {
          closeSaveCloudNamesModal();
        }
      });
    }
  });

  safeBlock('触摸手势', function () {
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
  });

  safeBlock('禁用右键', function () {
    document.addEventListener('contextmenu', function (e) {
      // 不禁用输入框的右键菜单
      var target = e.target;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        return;
      }
      e.preventDefault();
    });
  });

  safeBlock('键盘快捷键', function () {
    document.addEventListener('keydown', function (e) {
      if (['F12', 'U', 'I', 'J'].includes(e.key.toUpperCase()) && (e.ctrlKey || e.shiftKey || e.key === 'F12')) e.preventDefault();
      if (e.ctrlKey && ['+', '-', '0', 'r'].includes(e.key)) e.preventDefault();
      // ESC 键关闭弹窗
      var createTaskModal = document.getElementById('createTaskModal');
      var editTaskModal = document.getElementById('editTaskModal');
      if (e.key === 'Escape') {
        if (createTaskModal && createTaskModal.classList.contains('show')) {
          closeCreateTaskModal();
        } else if (editTaskModal && editTaskModal.classList.contains('show')) {
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
      var key = e.key.toUpperCase();
      if (/^[A-Z]$/.test(key) && currentTaskId && appState.namesData.length > 0) {
        var hasAnyModal = (createTaskModal && createTaskModal.classList.contains('show'))
          || (editTaskModal && editTaskModal.classList.contains('show'))
          || exportModal.classList.contains('show')
          || posterEditModal.classList.contains('show')
          || editNamesModal.classList.contains('show')
          || letterSearchModal.classList.contains('show')
          || settingsModal.classList.contains('show')
          || customAlertModal.classList.contains('show')
          || (duplicateHandleModal && duplicateHandleModal.classList.contains('show'))
          || customConfirmModal.classList.contains('show');
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
      await bootstrapTasks();
      // 控制台「计票进程」点「打开」会带 ?task_id=，直接进入那次计票
      if (await enterTaskFromUrl()) return;
      await checkImportTokenAndOpenCreate();
    })().catch(function (err) {
      console.error('[events] 页面初始化失败', err);
    });
  });
})();
