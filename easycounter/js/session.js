// 检查是否有保存的计票会话
function checkForSavedSession() {
  if (!Storage.hasActiveSession()) return;

  const savedData = Storage.loadVoteProgress();
  // 验证数据完整性
  if (!savedData.namesData || savedData.namesData.length === 0) {
    Storage.clearVoteData();
    return;
  }
  showContinueVoteModal(savedData, null, false);
}

// 显示继续计票弹窗
function showContinueVoteModal(savedData, newNames = null, hasNewNames = false) {
  // 格式化时间
  const date = new Date(savedData.lastUpdated);
  const timeStr = `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;

  lastVoteTime.textContent = timeStr;
  lastVoteCount.textContent = savedData.namesData.length;
  lastTotalVotes.textContent = savedData.totalVotes;

  // 如果有新名单，显示提示
  if (hasNewNames) {
    continueVoteText.innerHTML = `检测到从易点名导入的名单与上次计票名单相同<br><br>上次更新时间: <span id="lastVoteTime">${timeStr}</span><br>参与人数: <span id="lastVoteCount">${savedData.namesData.length}</span>人<br>当前总票数: <span id="lastTotalVotes">${savedData.totalVotes}</span>票`;
  } else {
    continueVoteText.innerHTML = `检测到未完成的计票<br>上次更新时间: <span id="lastVoteTime">${timeStr}</span><br>参与人数: <span id="lastVoteCount">${savedData.namesData.length}</span>人<br>当前总票数: <span id="lastTotalVotes">${savedData.totalVotes}</span>票`;
  }

  // 绑定按钮事件（先移除旧事件）
  continueVoteBtn.onclick = () => {
    continueVoteModal.classList.remove('show');
    restoreVoteSession(savedData);
  };

  newVoteBtn.onclick = () => {
    continueVoteModal.classList.remove('show');
    Storage.clearVoteData();
    if (hasNewNames && newNames) {
      nameInput.value = newNames.join('\n');
      uploadNames();
    }
  };

  continueVoteModal.classList.add('show');
}

// 恢复计票会话
function restoreVoteSession(savedData) {
  // 恢复appState
  appState.votes = savedData.votes;
  appState.totalVotes = savedData.totalVotes;
  appState.namesData = savedData.namesData;
  appState.groupedByLetter = savedData.groupedByLetter;
  appState.availableLetters = savedData.availableLetters;

  // 切换到主界面
  nameInputScreen.classList.add('hidden');
  mainApp.classList.add('visible');

  // 初始化UI
  initMainAppUI();
}
