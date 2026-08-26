// 获取基础路径（支持反向代理子目录）
function getApiBasePath() {
const pathname = window.location.pathname;
const lastSlash = pathname.lastIndexOf('/');
return pathname.substring(0, lastSlash + 1);
}
// 获取当前页面的完整 URL（用于回调）
function getCurrentUrl() {
return window.location.origin + window.location.pathname;
}
// 从易点名导入名单
function importFromRandamer() {
const currentUrl = getCurrentUrl();
const randamerApiUrl = 'https://easyclass.zhrhello.top/randamer/api.html';
const callbackUrl = encodeURIComponent(currentUrl);
window.location.href = `${randamerApiUrl}?url=${callbackUrl}`;
}

// 从云名单导入名单
function importFromCloudList() {
    const currentUrl = getCurrentUrl();
    const pickerUrl = `https://easyclass.zhrhello.top/easycore/api/list_picker?callback_url=${encodeURIComponent(currentUrl)}`;
    window.location.href = pickerUrl;
}

// 检查URL中的cloud_list_token参数并获取名单
async function checkCloudListTokenAndImport() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('cloud_list_token');
    
    if (!token) {
        return false;
    }
    
    // 清除URL中的token
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
    
    try {
        const response = await fetch(`https://easyclass.zhrhello.top/easycore/api/cloud-lists/get_names?token=${token}`);
        if (!response.ok) {
            throw new Error('获取名单失败');
        }
        
        const data = await response.json();
        if (!data.names || !Array.isArray(data.names)) {
            showCustomAlert('获取名单失败：数据格式错误');
            return false;
        }
        
        if (data.names.length === 0) {
            showCustomAlert('获取的名单为空');
            return false;
        }
        
        // 填入名单到输入框
        nameInput.value = data.names.join('\n');
        return true;
    } catch (error) {
        showCustomAlert('导入失败：' + error.message);
        return false;
    }
}

// 检查 URL 中的 token 参数并获取名单
async function checkTokenAndImport() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('names_get_token');

  if (!token) {
    // 无token，检查是否有缓存的计票数据
    checkForSavedSession();
    return;
  }

  // 有 token，先获取新名单
  try {
    const response = await fetch(`https://easyclass.zhrhello.top/easycore/api/randamer/get_names?token=${token}`);
    if (!response.ok) {
      throw new Error('获取名单失败');
    }

    const data = await response.json();
    if (!data.names || !Array.isArray(data.names)) {
      showCustomAlert('获取名单失败：数据格式错误');
      checkForSavedSession();
      return;
    }

    if (data.names.length === 0) {
      showCustomAlert('获取的名单为空');
      checkForSavedSession();
      return;
    }

    // 清除URL中的token
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);

    // 检查是否有缓存的计票数据
    if (Storage.hasActiveSession()) {
      const savedData = Storage.loadVoteProgress();
      const savedNames = savedData.namesData.map(item => item.name);

      if (compareNamesList(savedNames, data.names)) {
        // 名单相同，询问是否继续
        showContinueVoteModal(savedData, data.names, true);
      } else {
        // 名单不同，直接使用新名单
        Storage.clearVoteData();
        nameInput.value = data.names.join('\n');
        await uploadNames();
      }
    } else {
      // 无缓存，直接使用新名单
      nameInput.value = data.names.join('\n');
      await uploadNames();
    }
  } catch (error) {
    showCustomAlert('导入失败：' + error.message);
    // 出错时检查是否有缓存可恢复
    checkForSavedSession();
  }
}
// 上传名单到后端
async function uploadNames() {
const text = nameInput.value.trim();
if (!text) {
showCustomAlert('请输入至少一个姓名');
return;
}
const names = text.split('\n').map(n => n.trim()).filter(n => n);
if (names.length === 0) {
showCustomAlert('请输入至少一个有效的姓名');
return;
}

// 检测重名
const nameCount = {};
const duplicates = [];
names.forEach(name => {
  nameCount[name] = (nameCount[name] || 0) + 1;
  if (nameCount[name] === 2) {
    duplicates.push(name);
  }
});

if (duplicates.length > 0) {
  const duplicateInfo = duplicates.map(name => `${name}（出现${nameCount[name]}次）`).join('\n');
  showDuplicateHandleModal(duplicateInfo, names, nameCount);
} else {
  processAndUploadNames(names, 'dedup');
}
}

// 显示重名处理弹窗
function showDuplicateHandleModal(duplicateInfo, names, nameCount) {
  const modal = document.getElementById('duplicateHandleModal');
  const duplicateList = document.getElementById('duplicateList');
  duplicateList.textContent = duplicateInfo.replace(/\n/g, '\n');
  duplicateList.innerHTML = duplicateInfo.replace(/\n/g, '<br>');
  modal.classList.add('show');
  // 存储待处理数据
  modal.dataset.names = JSON.stringify(names);
  modal.dataset.nameCount = JSON.stringify(nameCount);
}

// 处理重名 - 全部保留并编号
function handleDuplicateKeepAll() {
  const modal = document.getElementById('duplicateHandleModal');
  const names = JSON.parse(modal.dataset.names);
  const nameCount = JSON.parse(modal.dataset.nameCount);

  // 为重复姓名添加编号
  const nameOccurrence = {};
  const numberedNames = names.map(name => {
    nameOccurrence[name] = (nameOccurrence[name] || 0) + 1;
    const count = nameOccurrence[name];
    // 只有出现次数大于1的才编号
    if (nameCount[name] > 1) {
      return `${name}-${count}`;
    }
    return name;
  });

  closeDuplicateHandleModal();
  processAndUploadNames(numberedNames, 'keepAll');
}

// 处理重名 - 去重处理
function handleDuplicateDedup() {
  const modal = document.getElementById('duplicateHandleModal');
  const names = JSON.parse(modal.dataset.names);
  closeDuplicateHandleModal();
  processAndUploadNames(names, 'dedup');
}

// 关闭重名处理弹窗
function closeDuplicateHandleModal() {
  const modal = document.getElementById('duplicateHandleModal');
  const promptPanel = modal.querySelector('.prompt-panel');
  promptPanel.style.animation = 'slideOut 0.3s ease-out forwards';
  modal.classList.add('hiding');
  setTimeout(() => {
    modal.classList.remove('show');
    modal.classList.remove('hiding');
    promptPanel.style.animation = '';
  }, 300);
}

// 处理并上传名单
async function processAndUploadNames(names, mode) {
let processedNames = names;

if (mode === 'dedup') {
  // 去重：保留每个姓名的第一次出现
  const uniqueNames = [];
  const seenNames = new Set();
  names.forEach(name => {
    if (!seenNames.has(name)) {
      uniqueNames.push(name);
      seenNames.add(name);
    }
  });
  processedNames = uniqueNames;

  const removedCount = names.length - uniqueNames.length;
  if (removedCount > 0) {
    showCustomAlert(`已过滤 ${removedCount} 个重复姓名，剩余 ${uniqueNames.length} 人`);
  }
} else if (mode === 'keepAll') {
  // 全部保留（已编号），只需提示
  showCustomAlert(`已为重复姓名添加编号，共 ${names.length} 人`);
}

uploadBtn.disabled = true;
uploadBtn.textContent = '处理中...';
try {
const apiPath = 'https://easyclass.zhrhello.top/easycore/api/pinyin';
const response = await fetch(apiPath, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ names: processedNames })
});
if (!response.ok) {
throw new Error('服务器处理失败');
}
const data = await response.json();
appState.namesData = data.sortedNames;
appState.groupedByLetter = data.groupedByLetter;
appState.availableLetters = data.availableLetters;
// 初始化投票数据
appState.namesData.forEach(item => {
appState.votes[item.name] = 0;
});
appState.totalVotes = 0;
// 保存初始状态
Storage.saveVoteProgress(appState);
// 更新字母按钮状态
updateLetterGrid();
updateQuickSearchGrid();
// 切换到主界面
nameInputScreen.classList.add('hidden');
mainApp.classList.add('visible');
// 初始化界面
initMainApp();
} catch (error) {
showCustomAlert('处理失败：' + error.message);
uploadBtn.disabled = false;
uploadBtn.textContent = '开始计票';
}
}