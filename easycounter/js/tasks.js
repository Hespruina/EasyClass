/*
 * EasyCounter 多任务计票：任务列表 / 新建 / 编辑信息 / 导出 / 删除 / 进入计票
 *
 * 进入页面看到的就是任务列表（默认为空）。所有数据来自云端，本文件只负责 UI，
 * 网络与实时同步在 cloud.js。
 */
let taskListCache = [];
let createTaskSource = 'manual';   // 'manual' | 'cloud'
// 新建时若名单来自云名单，记下它的 id：建任务时一起提交，让这次计票**跟随**那份名单
// （名单增删人后台同步，票数按姓名保留）。手动输入时为 null。
let createTaskListId = null;

function pad2(n) { return String(n).padStart(2, '0'); }

function formatTaskTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
           ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function defaultTaskName() {
    const now = new Date();
    const label = (now.getMonth() + 1) + '月' + now.getDate() + '日';
    const sameDay = taskListCache.filter(function (t) {
        const d = new Date(t.created_at);
        return !isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() &&
               d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    }).length;
    return label + ' 计票' + (sameDay + 1);
}

// ==================== 任务列表 ====================

async function bootstrapTasks() {
    // 第一个云端请求必须单独先跑完：/api/counter/tasks 会在无会话时开游客账号
    // 并下发 Cookie。等它回来再发其它请求，避免并发各建一个游客导致数据错号。
    await refreshTaskList();
    if (typeof fetchUserInfo === 'function') fetchUserInfo();
    CloudSync.connect(null);        // 任务列表页订阅「任务变化」
}

async function refreshTaskList() {
    const empty = document.getElementById('taskEmpty');
    const error = document.getElementById('taskListError');
    try {
        const data = await CloudSync.listTasks();
        taskListCache = Array.isArray(data.tasks) ? data.tasks : [];
        error.classList.add('hidden');
        renderTaskList(taskListCache);
    } catch (e) {
        empty.classList.add('hidden');
        const text = document.getElementById('taskListErrorText');
        if (text) text.textContent = '加载失败：' + e.message;
        error.classList.remove('hidden');
    }
}

function renderTaskList(tasks) {
    const list = document.getElementById('taskList');
    const empty = document.getElementById('taskEmpty');
    list.innerHTML = '';
    if (!tasks || tasks.length === 0) {
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    tasks.forEach(function (task, index) {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.dataset.id = task.id;
        card.style.animationDelay = Math.min(index, 8) * 0.04 + 's';

        const main = document.createElement('div');
        main.className = 'task-card-main';

        const name = document.createElement('div');
        name.className = 'task-card-name';
        name.textContent = task.name || '未命名计票';

        const meta = document.createElement('div');
        meta.className = 'task-card-meta';
        const voted = document.createElement('span');
        voted.className = 'task-votes';
        voted.textContent = '已投票 ';
        const votedNum = document.createElement('b');
        votedNum.textContent = Number(task.total_votes) || 0;
        voted.appendChild(votedNum);
        const people = document.createElement('span');
        people.className = 'task-people';
        people.textContent = (Number(task.item_count) || 0) + ' 人';
        meta.appendChild(voted);
        meta.appendChild(people);

        const times = document.createElement('div');
        times.className = 'task-card-times';
        times.textContent = '创建 ' + formatTaskTime(task.created_at) +
                            ' · 修改 ' + formatTaskTime(task.updated_at);

        main.appendChild(name);
        main.appendChild(meta);
        main.appendChild(times);

        const actions = document.createElement('div');
        actions.className = 'task-card-actions';
        [['edit', '编辑信息'], ['export', '导出结果'], ['delete', '删除']].forEach(function (pair) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'task-action-btn' + (pair[0] === 'delete' ? ' is-danger' : '');
            btn.dataset.act = pair[0];
            btn.textContent = pair[1];
            btn.addEventListener('click', function (ev) {
                ev.stopPropagation();
                if (pair[0] === 'edit') openEditTaskModal(task);
                else if (pair[0] === 'export') exportTask(task.id);
                else deleteTaskFromList(task);
            });
            actions.appendChild(btn);
        });

        card.appendChild(main);
        card.appendChild(actions);
        card.addEventListener('click', function () { enterTask(task.id); });
        list.appendChild(card);
    });
}

// ==================== 新建计票 ====================

function openCreateTaskModal(prefillNames) {
    const nameEl = document.getElementById('createTaskName');
    nameEl.value = '';
    nameEl.placeholder = defaultTaskName();
    createTaskListId = null;
    document.getElementById('createTaskNames').value =
        Array.isArray(prefillNames) ? prefillNames.join('\n') : '';
    switchCreateSource('manual');
    loadCloudListsForCreate();
    document.getElementById('createTaskModal').classList.add('show');
}

function closeCreateTaskModal() {
    const modal = document.getElementById('createTaskModal');
    modal.classList.add('hiding');
    setTimeout(function () {
        modal.classList.remove('show');
        modal.classList.remove('hiding');
    }, 300);
}

function switchCreateSource(mode) {
    createTaskSource = mode;
    const manualBtn = document.getElementById('createSourceManual');
    const cloudBtn = document.getElementById('createSourceCloud');
    manualBtn.classList.toggle('active', mode === 'manual');
    cloudBtn.classList.toggle('active', mode === 'cloud');
    document.getElementById('createManualArea').classList.toggle('hidden', mode !== 'manual');
    document.getElementById('createCloudArea').classList.toggle('hidden', mode !== 'cloud');
}

async function loadCloudListsForCreate() {
    const select = document.getElementById('createTaskCloudList');
    select.innerHTML = '';
    const loading = document.createElement('option');
    loading.value = '';
    loading.textContent = '加载中…';
    select.appendChild(loading);
    try {
        const data = await CloudSync.api('api/cloud-lists/list');
        const lists = Array.isArray(data.lists) ? data.lists : [];
        select.innerHTML = '';
        if (lists.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = '暂无云名单，请先到控制台创建';
            select.appendChild(opt);
            return;
        }
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '请选择一份云名单';
        select.appendChild(placeholder);
        lists.forEach(function (l) {
            const opt = document.createElement('option');
            opt.value = l.list_id;
            opt.textContent = l.name + '（' + (Number(l.item_count) || 0) + ' 人）';
            select.appendChild(opt);
        });
    } catch (e) {
        select.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '云名单加载失败：' + e.message;
        select.appendChild(opt);
    }
}

// 异步按钮加载态：保留原内容，显示转圈，完成后还原
function setButtonBusy(btn, busy, busyText) {
    if (!btn) return;
    if (busy) {
        if (btn.dataset.idleHtml === undefined) btn.dataset.idleHtml = btn.innerHTML;
        btn.disabled = true;
        btn.classList.add('is-busy');
        btn.innerHTML = '<span class="btn-spinner"></span>' + (busyText || '处理中…');
    } else if (btn.dataset.idleHtml !== undefined) {
        btn.disabled = false;
        btn.classList.remove('is-busy');
        btn.innerHTML = btn.dataset.idleHtml;
        delete btn.dataset.idleHtml;
    }
}

async function createTaskFromNames(names) {
    const btn = document.getElementById('confirmCreateTaskBtn');
    const nameEl = document.getElementById('createTaskName');
    const name = (nameEl.value || '').trim() || defaultTaskName();
    if (!Array.isArray(names) || names.length === 0) {
        showCustomAlert('请至少输入一个姓名');
        return;
    }
    setButtonBusy(btn, true, '创建中…');
    try {
        const data = await CloudSync.createTask(name, names, createTaskListId);
        createTaskListId = null;
        closeCreateTaskModal();
        await refreshTaskList();
        const id = data.task && data.task.id;
        showCustomConfirm(
            '计票任务「' + escapeHtml(name) + '」已创建。<br><br>是否立即进入计票？',
            function (ok) { if (ok && id) enterTask(id); },
            '创建成功');
    } catch (e) {
        showCustomAlert('创建失败：' + e.message);
    } finally {
        setButtonBusy(btn, false);
    }
}

// ==================== 进入 / 返回 ====================

let taskLoading = false;       // 进入计票期间的防重复点击锁

// URL 与当前计票任务同步：带 ?task_id=<id> 时刷新页面能直接回到这次计票，
// 控制台「计票进程」页的「打开」也是靠这个参数直达。
function syncTaskUrl(id) {
    try {
        const url = new URL(location.href);
        if (id) url.searchParams.set('task_id', id);
        else url.searchParams.delete('task_id');
        history.replaceState(null, '', url.toString());
    } catch (e) { /* 老浏览器不支持 URL 对象时忽略，不影响主流程 */ }
}

// 从控制台「计票进程」点「打开」进来时 URL 带着 ?task_id=，直接进入对应任务
async function enterTaskFromUrl() {
    const id = parseInt(new URLSearchParams(location.search).get('task_id'), 10);
    if (!id) return false;
    await enterTask(id);
    // 任务已被删除 / 无权访问：enterTask 会提示并停在列表页，这里顺手清掉失效参数
    if (!currentTaskId) syncTaskUrl(null);
    return true;
}

function showTaskLoading(show, taskName) {
    const overlay = document.getElementById('taskLoadingOverlay');
    if (!overlay) return;
    const text = document.getElementById('taskLoadingText');
    if (text) {
        text.textContent = taskName
            ? '正在加载「' + taskName + '」…'
            : '正在加载计票数据…';
    }
    overlay.classList.toggle('show', !!show);
}

async function enterTask(id) {
    if (taskLoading) return;   // 加载期间忽略重复点击
    taskLoading = true;
    const known = taskListCache.find(function (t) { return Number(t.id) === Number(id); });
    showTaskLoading(true, known ? (known.name || '未命名计票') : '');
    try {
        let task;
        try {
            const data = await CloudSync.getTask(id);
            task = data.task;
        } catch (e) {
            showCustomAlert('打开计票失败：' + e.message);
            return;
        }
        currentTaskId = Number(task.id);
        CloudSync.resetRevision(task.revision || 0);
        CloudSync.acceptTask(task, true);
        const label = document.getElementById('countingTaskName');
        if (label) label.textContent = task.name || '未命名计票';
        document.getElementById('taskListScreen').classList.add('hidden');
        mainApp.classList.add('visible');
        CloudSync.connect(currentTaskId);
        initMainApp();                 // 操作方式自动检测（无弹窗），直接初始化主界面
        syncTaskUrl(currentTaskId);
    } finally {
        showTaskLoading(false);
        taskLoading = false;
    }
}

function backToTaskList() {
    CloudSync.disconnect();
    currentTaskId = null;
    mainApp.classList.remove('visible');
    document.getElementById('taskListScreen').classList.remove('hidden');
    syncTaskUrl(null);
    refreshTaskList();
    CloudSync.connect(null);
}

function backToTools() {
    window.location.href = '/';
}

// ==================== 编辑信息 / 导出 / 删除 ====================

function openEditTaskModal(task) {
    document.getElementById('editTaskId').value = task.id;
    document.getElementById('editTaskName').value = task.name || '';
    document.getElementById('editTaskModal').classList.add('show');
}

function closeEditTaskModal() {
    const modal = document.getElementById('editTaskModal');
    modal.classList.add('hiding');
    setTimeout(function () {
        modal.classList.remove('show');
        modal.classList.remove('hiding');
    }, 300);
}

async function confirmEditTask() {
    const id = document.getElementById('editTaskId').value;
    const name = (document.getElementById('editTaskName').value || '').trim();
    if (!name) { showCustomAlert('请输入计票名称'); return; }
    const btn = document.getElementById('confirmEditTaskBtn');
    setButtonBusy(btn, true, '保存中…');
    try {
        await CloudSync.renameTask(id, name);
        closeEditTaskModal();
        await refreshTaskList();
    } catch (e) {
        showCustomAlert('保存失败：' + e.message);
    } finally {
        setButtonBusy(btn, false);
    }
}

async function exportTask(id) {
    try {
        const data = await CloudSync.getTask(id);
        // 复用现有导出 / 海报模块：它们读的是全局 appState，先把该任务的状态装进去。
        // 列表页没有 currentTaskId，键盘快捷键已被拦住，不会误触发。
        CloudSync.paint(data.task.state, true);
        openExportModal();
    } catch (e) {
        showCustomAlert('读取计票数据失败：' + e.message);
    }
}

function deleteTaskFromList(task) {
    showCustomConfirm(
        '确定删除「' + escapeHtml(task.name || '未命名计票') +
        '」吗？<br>名单与票数将永久删除，其它设备上打开的同一次计票也会关闭。',
        async function (ok) {
            if (!ok) return;
            try {
                await CloudSync.deleteTask(task.id);
                await refreshTaskList();
            } catch (e) {
                showCustomAlert('删除失败：' + e.message);
            }
        },
        '删除计票');
}

// ==================== 云端回调 ====================

// 服务端轻量通知（votes_changed）：某任务的已投票数变了，卡片就地更新，
// 不再整列表重拉。只可能在任务列表页收到（进计票页后订阅的是 state）。
function onCloudVotesChanged(taskId, totalVotes) {
    if (taskId === undefined || taskId === null) return;
    const num = document.querySelector(
        '.task-card[data-id="' + taskId + '"] .task-votes b');
    if (num) num.textContent = Number(totalVotes) || 0;
}

function onCloudTaskUpdated(task) {
    if (!currentTaskId || Number(task.id) !== Number(currentTaskId)) return;
    const label = document.getElementById('countingTaskName');
    if (label && task.name) label.textContent = task.name;
}

function onCloudTaskDeleted() {
    showCustomAlert('该计票任务已在其它设备上删除', '提示');
    backToTaskList();
}

// ==================== 事件绑定 ====================

function initTaskUI() {
    const $ = function (id) { return document.getElementById(id); };
    $('startTaskBtn').addEventListener('click', function () { openCreateTaskModal(); });
    $('emptyStartBtn').addEventListener('click', function () { openCreateTaskModal(); });
    $('createSourceManual').addEventListener('click', function () { switchCreateSource('manual'); });
    $('createSourceCloud').addEventListener('click', function () { switchCreateSource('cloud'); });
    $('confirmCreateTaskBtn').addEventListener('click', function () { uploadNames(); });
    $('cancelCreateTaskBtn').addEventListener('click', closeCreateTaskModal);
    $('createRandamerImportBtn').addEventListener('click', importFromRandamer);
    $('confirmEditTaskBtn').addEventListener('click', confirmEditTask);
    $('cancelEditTaskBtn').addEventListener('click', closeEditTaskModal);
    $('backToTasksBtn').addEventListener('click', function (e) {
        e.preventDefault();
        backToTaskList();
    });

    $('createTaskModal').addEventListener('click', function (e) {
        if (e.target === this) closeCreateTaskModal();
    });
    $('editTaskModal').addEventListener('click', function (e) {
        if (e.target === this) closeEditTaskModal();
    });
    $('taskListRetryBtn').addEventListener('click', refreshTaskList);
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTaskUI);
} else {
    initTaskUI();
}
