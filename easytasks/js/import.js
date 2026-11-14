/*
 * 名单导入 / 新建任务的名单准备
 *
 * 这里是「手动输入 / 云名单 / 易点名 token」到姓名数组的收集层：
 * 处理重名后交给 tasks.js::createTaskFromNames() 去云端建任务。
 * 拼音排序由后端 tasks_state.build_state() 统一完成，前端不再重复实现。
 */

function getApiBasePath() {
    const pathname = window.location.pathname;
    return pathname.substring(0, pathname.lastIndexOf('/') + 1);
}

function getCurrentUrl() {
    return window.location.origin + window.location.pathname;
}

// 从易点名导入：跳到 randamer 的分享页，回来时 URL 带 names_get_token
function importFromRandamer() {
    const randamerApiUrl = 'https://easyclass.zhrhello.top/randamer/api.html';
    window.location.href = randamerApiUrl + '?url=' + encodeURIComponent(getCurrentUrl());
}

// 从云名单导入（设置面板里的旧入口）：直接打开新建弹窗并切到云名单来源
function importFromCloudList() {
    if (typeof openCreateTaskModal === 'function') openCreateTaskModal();
    if (typeof switchCreateSource === 'function') switchCreateSource('cloud');
}

function clearImportTokenFromUrl() {
    window.history.replaceState({}, document.title,
        window.location.origin + window.location.pathname);
}

async function fetchNamesByToken(url) {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error('获取名单失败 (HTTP ' + response.status + ')');
    const data = await response.json();
    if (!data || !Array.isArray(data.names)) throw new Error('名单数据格式错误');
    if (data.names.length === 0) throw new Error('名单为空');
    return data.names;
}

// 页面加载时检查 URL 里的导入 token；命中则带着名单打开新建弹窗
async function checkImportTokenAndOpenCreate() {
    const params = new URLSearchParams(window.location.search);
    const cloudToken = params.get('cloud_list_token');
    const randamerToken = params.get('names_get_token');
    if (!cloudToken && !randamerToken) return false;

    clearImportTokenFromUrl();
    try {
        const url = cloudToken
            ? CloudSync.apiBaseForImport('api/cloud-lists/get_names?token=' + encodeURIComponent(cloudToken))
            : CloudSync.apiBaseForImport('api/randamer/get_names?token=' + encodeURIComponent(randamerToken));
        const names = await fetchNamesByToken(url);
        openCreateTaskModal(names);
        switchCreateSource('manual');
        showCustomAlert('已导入 ' + names.length + ' 人，请确认后创建任务', '导入成功');
        return true;
    } catch (e) {
        showCustomAlert('导入失败：' + e.message);
        return false;
    }
}

// 兼容旧调用点（events.js 已改为直接调 bootstrapTasks）
async function checkCloudListTokenAndImport() { return false; }
async function checkTokenAndImport() { return false; }

// ==================== 新建任务的名单收集 ====================

async function readCreateTaskNames() {
    if (createTaskSource === 'cloud') {
        const select = document.getElementById('createTaskCloudList');
        const listId = select ? select.value : '';
        if (!listId) { showCustomAlert('请选择一份云名单'); return null; }
        let data;
        try {
            data = await CloudSync.api('api/lists/' + encodeURIComponent(listId));
        } catch (e) {
            showCustomAlert('读取云名单失败：' + e.message);
            return null;
        }
        const items = Array.isArray(data.items) ? data.items : [];
        const names = items.map(i => i.name).filter(Boolean);
        if (names.length === 0) { showCustomAlert('该名单还没有名字'); return null; }
        return names;
    }
    const textarea = document.getElementById('createTaskNames');
    const text = textarea ? textarea.value.trim() : '';
    const names = text.split('\n').map(n => n.trim()).filter(Boolean);
    if (names.length === 0) { showCustomAlert('请输入至少一个姓名'); return null; }
    return names;
}

// 「创建任务」按钮入口：收集名单 → 重名检测 → 建任务
async function uploadNames() {
    const btn = document.getElementById('confirmCreateTaskBtn');
    if (btn && btn.disabled) return;
    const names = await readCreateTaskNames();
    if (!names) return;

    const nameCount = {};
    const duplicates = [];
    names.forEach(function (name) {
        nameCount[name] = (nameCount[name] || 0) + 1;
        if (nameCount[name] === 2) duplicates.push(name);
    });
    if (duplicates.length > 0) {
        const info = duplicates.map(n => n + '（出现' + nameCount[n] + '次）').join('\n');
        showDuplicateHandleModal(info, names, nameCount);
    } else {
        processAndUploadNames(names, 'dedup');
    }
}

function showDuplicateHandleModal(duplicateInfo, names, nameCount) {
    const modal = document.getElementById('duplicateHandleModal');
    document.getElementById('duplicateList').innerHTML =
        duplicateInfo.split('\n').map(escapeHtml).join('<br>');
    modal.classList.add('show');
    modal.dataset.names = JSON.stringify(names);
    modal.dataset.nameCount = JSON.stringify(nameCount);
}

function handleDuplicateKeepAll() {
    const modal = document.getElementById('duplicateHandleModal');
    const names = JSON.parse(modal.dataset.names);
    const nameCount = JSON.parse(modal.dataset.nameCount);
    const occurrence = {};
    const numbered = names.map(function (name) {
        occurrence[name] = (occurrence[name] || 0) + 1;
        return nameCount[name] > 1 ? name + '-' + occurrence[name] : name;
    });
    closeDuplicateHandleModal();
    showCustomAlert('已为重复姓名添加编号，共 ' + numbered.length + ' 人');
    processAndUploadNames(numbered, 'keepAll');
}

function handleDuplicateDedup() {
    const modal = document.getElementById('duplicateHandleModal');
    const names = JSON.parse(modal.dataset.names);
    closeDuplicateHandleModal();
    processAndUploadNames(names, 'dedup');
}

function closeDuplicateHandleModal() {
    const modal = document.getElementById('duplicateHandleModal');
    const panel = modal.querySelector('.prompt-panel');
    panel.style.animation = 'slideOut 0.3s ease-out forwards';
    modal.classList.add('hiding');
    setTimeout(function () {
        modal.classList.remove('show');
        modal.classList.remove('hiding');
        panel.style.animation = '';
    }, 300);
}

async function processAndUploadNames(names, mode) {
    let processed = names;
    if (mode === 'dedup') {
        const seen = new Set();
        processed = names.filter(function (n) {
            if (seen.has(n)) return false;
            seen.add(n);
            return true;
        });
        const removed = names.length - processed.length;
        if (removed > 0) showCustomAlert('已过滤 ' + removed + ' 个重复姓名，剩余 ' + processed.length + ' 人');
    }
    await createTaskFromNames(processed);
}
