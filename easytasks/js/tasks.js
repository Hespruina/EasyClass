/*
 * EasyTasks 多任务：任务列表 / 新建 / 编辑信息 / 导出 / 删除 / 进入任务
 *
 * 进入页面看到的就是任务列表（默认为空）。所有数据来自云端，本文件只负责 UI，
 * 网络与实时同步在 cloud.js。
 */
let taskListCache = [];
let createTaskSource = 'manual';   // 'manual' | 'cloud'
let currentTaskName = '';
let taskListRefreshTimer = null;

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
    return label + ' 任务' + (sameDay + 1);
}

// ==================== 任务列表 ====================

async function bootstrapTasks() {
    // 第一个云端请求必须单独先跑完：/api/tasks 会在无会话时开游客账号
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
        renderTaskOverview(data);
        renderTaskList(taskListCache);
    } catch (e) {
        empty.classList.add('hidden');
        const text = document.getElementById('taskListErrorText');
        if (text) text.textContent = '加载失败：' + e.message;
        error.classList.remove('hidden');
    }
}

// 任务列表页收到 WS 通知后防抖刷新：一次操作可能同时触发多条消息
function scheduleTaskListRefresh() {
    if (currentTaskId) return;
    if (taskListRefreshTimer) clearTimeout(taskListRefreshTimer);
    taskListRefreshTimer = setTimeout(function () {
        taskListRefreshTimer = null;
        refreshTaskList();
    }, 200);
}

function renderTaskOverview(data) {
    const el = document.getElementById('taskOverview');
    if (!el) return;
    const summary = data.summary || {};
    if (!data.tasks || data.tasks.length === 0) {
        el.classList.add('hidden');
        el.innerHTML = '';
        return;
    }
    el.classList.remove('hidden');

    const stats = [
        { value: summary.task_count || 0, label: '任务总量', kind: 'total' },
        { value: summary.fully_completed_tasks || 0, label: '全部完成任务数', kind: 'done' },
        { value: summary.students_all_completed || 0, label: '完成所有任务学生数', kind: 'doing' },
        { value: summary.students_none || 0, label: '未完成任何任务学生数', kind: 'todo' }
    ];
    let statsHtml = '<div class="task-stats-grid">';
    stats.forEach(function (item) {
        statsHtml += '<div class="task-stat-card task-stat-' + item.kind + '">' +
                     '<b class="task-stat-value">' + item.value + '</b>' +
                     '<span class="task-stat-label">' + item.label + '</span>' +
                     '</div>';
    });
    statsHtml += '</div>';

    el.innerHTML = statsHtml +
        '<div class="task-top5-grid">' +
        renderTop5('进度最快 Top5', data.fastest, 'fast') +
        renderTop5('进度最慢 Top5', data.slowest, 'slow') +
        '</div>';
}

function renderTop5(title, list, kind) {
    let html = '<div class="task-top5-card ' + (kind === 'fast' ? 'is-fast' : 'is-slow') + '">' +
               '<h3 class="task-top5-title">' + title + '</h3>';
    if (!Array.isArray(list) || list.length === 0) {
        html += '<div class="task-top5-empty">暂无数据</div></div>';
        return html;
    }
    list.forEach(function (item, index) {
        html += '<div class="task-top5-row">' +
                '<span class="task-top5-rank">' + (index + 1) + '</span>' +
                '<span class="task-top5-name">' + escapeHtml(item.name) + '</span>' +
                '<span class="task-top5-progress">' + (Number(item.progress) || 0) + '%</span>' +
                '</div>';
    });
    html += '</div>';
    return html;
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
        name.textContent = task.name || '未命名任务';

        const meta = document.createElement('div');
        meta.className = 'task-card-meta';
        const people = document.createElement('span');
        people.className = 'task-people';
        people.textContent = (Number(task.item_count) || 0) + ' 人';
        const completed = document.createElement('span');
        completed.className = 'task-completed';
        completed.textContent = '已完成 ' + (Number(task.completed_count) || 0) + '/' +
                                (Number(task.item_count) || 0) + ' 人';
        const percent = document.createElement('span');
        percent.className = 'task-percent';
        percent.textContent = '平均进度 ' + (Number(task.progress_percent) || 0) + '%';
        meta.appendChild(people);
        meta.appendChild(completed);
        meta.appendChild(percent);

        const times = document.createElement('div');
        times.className = 'task-card-times';
        times.textContent = '创建 ' + formatTaskTime(task.created_at) +
                            ' · 修改 ' + formatTaskTime(task.updated_at);

        const progress = document.createElement('div');
        progress.className = 'task-card-progress';
        const progressPercent = Math.max(0, Math.min(100, Number(task.progress_percent) || 0));
        progress.innerHTML =
            '<div class="task-card-progress-head"><span>全体完成进度</span>' +
            '<b>' + progressPercent + '%</b></div>' +
            '<div class="task-card-progress-track"><i style="width:' +
            progressPercent + '%"></i></div>';

        main.appendChild(name);
        main.appendChild(meta);
        main.appendChild(times);
        main.appendChild(progress);

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
                else if (pair[0] === 'export') exportTask(task.id, task.name);
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

// ==================== 完成方式 ====================

// 刷新某个弹窗（create / edit）的完成方式 UI；keepInput = 正在手动输入时不回写输入框
function setTaskModeUI(prefix, mode, steps, keepInput) {
    const tabs = document.getElementById(prefix + 'ModeTabs');
    if (!tabs) return;
    const safeMode = mode === 'steps' || mode === 'once' ? mode : 'percent';
    const value = Math.max(2, Math.min(20, Number(steps) || 3));
    const quick = tabs.querySelectorAll('.task-mode-tab');
    Array.prototype.forEach.call(quick, function (btn) {
        btn.classList.toggle('active', btn.dataset.mode === safeMode);
    });
    tabs.dataset.mode = safeMode;
    const row = document.getElementById(prefix + 'StepsRow');
    if (row) {
        row.classList.toggle('hidden', safeMode !== 'steps');
        const input = document.getElementById(prefix + 'StepsInput');
        if (input && !keepInput) input.value = String(value);
        Array.prototype.forEach.call(row.querySelectorAll('.task-step-quick'), function (btn) {
            btn.classList.toggle('active', Number(btn.dataset.steps) === value);
        });
    }
}

// 读取某个弹窗当前选择的完成方式
function getTaskMode(prefix) {
    const tabs = document.getElementById(prefix + 'ModeTabs');
    const active = tabs ? tabs.querySelector('.task-mode-tab.active') : null;
    const input = document.getElementById(prefix + 'StepsInput');
    const picked = (tabs && tabs.dataset.mode) || (active ? active.dataset.mode : 'percent');
    return {
        mode: picked === 'steps' || picked === 'once' ? picked : 'percent',
        steps: Math.max(2, Math.min(20, Number(input && input.value) || 3))
    };
}

// 绑定完成方式切换按钮
function bindTaskModeControls(prefix) {
    const tabs = document.getElementById(prefix + 'ModeTabs');
    if (!tabs) return;
    Array.prototype.forEach.call(tabs.querySelectorAll('.task-mode-tab'), function (btn) {
        btn.addEventListener('click', function () {
            setTaskModeUI(prefix, btn.dataset.mode, getTaskMode(prefix).steps);
        });
    });
    const row = document.getElementById(prefix + 'StepsRow');
    if (!row) return;
    Array.prototype.forEach.call(row.querySelectorAll('.task-step-quick'), function (btn) {
        btn.addEventListener('click', function () {
            setTaskModeUI(prefix, 'steps', Number(btn.dataset.steps));
        });
    });
    const input = document.getElementById(prefix + 'StepsInput');
    if (input) {
        input.addEventListener('input', function () {
            setTaskModeUI(prefix, 'steps', input.value, true);
        });
        input.addEventListener('blur', function () {
            setTaskModeUI(prefix, 'steps', input.value);
        });
    }
}

// ==================== 新建任务 ====================

function openCreateTaskModal(prefillNames) {
    const nameEl = document.getElementById('createTaskName');
    nameEl.value = '';
    nameEl.placeholder = defaultTaskName();
    document.getElementById('createTaskNames').value =
        Array.isArray(prefillNames) ? prefillNames.join('\n') : '';
    setTaskModeUI('create', 'percent', 3);
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
    const modeInfo = getTaskMode('create');
    setButtonBusy(btn, true, '创建中…');
    try {
        const data = await CloudSync.createTask(name, names, modeInfo.mode, modeInfo.steps);
        closeCreateTaskModal();
        await refreshTaskList();
        const id = data.task && data.task.id;
        showCustomConfirm(
            '任务「' + escapeHtml(name) + '」已创建。<br><br>是否立即进入？',
            function (ok) { if (ok && id) enterTask(id); },
            '创建成功');
    } catch (e) {
        showCustomAlert('创建失败：' + e.message);
    } finally {
        setButtonBusy(btn, false);
    }
}

// ==================== 进入 / 返回 ====================

let taskLoading = false;       // 进入任务期间的防重复点击锁

function showTaskLoading(show, taskName) {
    const overlay = document.getElementById('taskLoadingOverlay');
    if (!overlay) return;
    const text = document.getElementById('taskLoadingText');
    if (text) {
        text.textContent = taskName
            ? '正在加载「' + taskName + '」…'
            : '正在加载任务数据…';
    }
    overlay.classList.toggle('show', !!show);
}

async function enterTask(id) {
    if (taskLoading) return;   // 加载期间忽略重复点击
    taskLoading = true;
    const known = taskListCache.find(function (t) { return Number(t.id) === Number(id); });
    showTaskLoading(true, known ? (known.name || '未命名任务') : '');
    try {
        let task;
        try {
            const data = await CloudSync.getTask(id);
            task = data.task;
        } catch (e) {
            showCustomAlert('打开任务失败：' + e.message);
            return;
        }
        currentTaskId = Number(task.id);
        currentTaskName = task.name || '未命名任务';
        CloudSync.resetRevision(task.revision || 0);
        CloudSync.acceptTask(task, true);
        if (countingTaskName) countingTaskName.textContent = currentTaskName;
        document.getElementById('taskListScreen').classList.add('hidden');
        mainApp.classList.add('visible');
        CloudSync.connect(currentTaskId);
        initMainApp();
    } finally {
        showTaskLoading(false);
        taskLoading = false;
    }
}

function backToTaskList() {
    CloudSync.disconnect();
    currentTaskId = null;
    currentTaskName = '';
    currentStudentName = null;
    mainApp.classList.remove('visible');
    document.getElementById('taskListScreen').classList.remove('hidden');
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
    setTaskModeUI('edit', task.mode || 'percent', task.steps || 3);
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
    if (!name) { showCustomAlert('请输入任务名称'); return; }
    const btn = document.getElementById('confirmEditTaskBtn');
    setButtonBusy(btn, true, '保存中…');
    try {
        const modeInfo = getTaskMode('edit');
        await CloudSync.updateTask(id, {
            name: name,
            mode: modeInfo.mode,
            steps: modeInfo.steps
        });
        closeEditTaskModal();
        await refreshTaskList();
    } catch (e) {
        showCustomAlert('保存失败：' + e.message);
    } finally {
        setButtonBusy(btn, false);
    }
}

async function exportTask(id, name) {
    try {
        const data = await CloudSync.getTask(id);
        // 复用导出模块：它读的是全局 appState，先把该任务的状态装进去。
        CloudSync.paint(data.task.state, true);
        exportToExcel(name || data.task.name);
    } catch (e) {
        showCustomAlert('读取任务数据失败：' + e.message);
    }
}

function deleteTaskFromList(task) {
    showCustomConfirm(
        '确定删除「' + escapeHtml(task.name || '未命名任务') +
        '」吗？<br>名单、进度与评分将永久删除，其它设备上打开的同一次任务也会关闭。',
        async function (ok) {
            if (!ok) return;
            try {
                await CloudSync.deleteTask(task.id);
                await refreshTaskList();
            } catch (e) {
                showCustomAlert('删除失败：' + e.message);
            }
        },
        '删除任务');
}

// ==================== 云端回调 ====================

function onCloudTaskUpdated(task) {
    if (!currentTaskId || Number(task.id) !== Number(currentTaskId)) return;
    if (task.name) {
        currentTaskName = task.name;
        if (countingTaskName) countingTaskName.textContent = task.name;
    }
}

function onCloudTaskDeleted() {
    showCustomAlert('该任务已在其它设备上删除', '提示');
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
    bindTaskModeControls('create');
    bindTaskModeControls('edit');
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
