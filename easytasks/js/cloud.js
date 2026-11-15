/*
 * EasyTasks 纯云端数据层
 *
 * 浏览器不保存任何任务数据（名单 / 进度 / 星级），全部以 tasks.db 为准：
 *   - 每个操作（进度 / 星级 / 清空 / 改名单）都走一次 POST /ops 立即落库；
 *   - WebSocket 带 5s 心跳，把权威快照推给同账号的其它设备；
 *   - revision 单调递增，只接受比本地更新的快照，网络乱序不会回退。
 *
 * 进度是 0–100 的绝对值，服务端按操作串行落库，不再需要计票那套
 * pending 增量；拖动时只做本地预览，松手才提交，响应/广播会带上权威快照。
 *
 * 本机 localStorage 只剩 UI 偏好（搜索模式 / 主题），与任务数据无关。
 */
const CloudSync = (function () {
    'use strict';

    const HEARTBEAT_INTERVAL = 5000;   // 与后端 tasks_hub 一致
    // 断线重连节奏（与易积分 / 易排座 / 易计票 / 易点名一致）：
    // 第 1 次立刻重连，之后 1s 起翻倍封顶 2s，连续失败超 10 次则固定每 1s 试一次
    const RETRY_BURST = 10;
    const RETRY_STEP = 1000;
    const RETRY_CAP = 2000;
    const RETRY_STEADY = 1000;

    function apiBase() {
        const pathname = window.location.pathname;
        const dir = pathname.substring(0, pathname.lastIndexOf('/') + 1);
        return new URL(dir + '../easycore/', window.location.origin).href;
    }

    function wsUrl(taskId) {
        const base = apiBase();                       // https://host/easycore/
        const url = new URL('api/tasks/ws', base);
        url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        if (taskId) url.searchParams.set('task_id', String(taskId));
        return url.href;
    }

    async function api(path, options) {
        const opts = options || {};
        const init = {
            method: opts.method || 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        };
        if (opts.body !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(opts.body);
        }
        let response;
        try {
            response = await fetch(apiBase() + path, init);
        } catch (e) {
            throw new Error('网络异常，请检查连接');
        }
        let data = null;
        try { data = await response.json(); } catch (e) { /* 非 JSON 响应 */ }
        if (!response.ok) {
            const msg = (data && (data.error || data.message)) || ('HTTP ' + response.status);
            const err = new Error(msg);
            err.status = response.status;
            throw err;
        }
        return data || {};
    }

    let revision = 0;
    let taskId = null;                 // 当前订阅的任务；null = 只订阅任务列表
    let socket = null;
    let connId = null;                 // 本机这条 WS 连接的 id（hello 下发）
    let pingTimer = null;
    let reconnectTimer = null;
    let dropFails = 0;                 // 连续失败次数，连上即清零
    let closedByUs = false;
    let namesSignature = '';

    /* 第 n 次重试前该等多久：首次 0ms（掉线立刻重连） */
    function nextRetryDelay() {
        dropFails += 1;
        if (dropFails === 1) return 0;
        if (dropFails > RETRY_BURST) return RETRY_STEADY;
        return Math.min(RETRY_STEP * Math.pow(2, dropFails - 2), RETRY_CAP);
    }

    function signature(state) {
        const names = (state && state.namesData) || [];
        return names.map(function (i) { return i.name; }).join('\u0001');
    }

    function normalizeValues(source, names, high) {
        const result = {};
        names.forEach(function (name) {
            const raw = source && source[name];
            const value = (typeof raw === 'number' && isFinite(raw)) ? Math.round(raw) : 0;
            result[name] = Math.max(0, Math.min(high, value));
        });
        return result;
    }

    function paint(state, force) {
        const s = state || {};
        const changedNames = force || signature(s) !== namesSignature;
        namesSignature = signature(s);

        appState.namesData = Array.isArray(s.namesData) ? s.namesData : [];
        appState.groupedByLetter = s.groupedByLetter || {};
        appState.availableLetters = Array.isArray(s.availableLetters) ? s.availableLetters : [];
        appState.mode = s.mode === 'steps' || s.mode === 'once' ? s.mode : 'percent';
        appState.steps = Math.max(2, Math.min(20, Number(s.steps) || 3));

        const names = appState.namesData.map(function (item) { return item.name; });
        appState.progress = normalizeValues(s.progress, names, 100);
        appState.stars = normalizeValues(s.stars, names, 5);

        if (changedNames && typeof renderGrid === 'function') {
            renderGrid();
        } else if (typeof refreshAllStudents === 'function') {
            refreshAllStudents();
        }
        if (typeof renderOverview === 'function') renderOverview();
        if (typeof applyTaskModeUI === 'function') applyTaskModeUI();
        if (changedNames && typeof updateLetterGrid === 'function') updateLetterGrid();
        if (changedNames && typeof updateQuickSearchGrid === 'function') updateQuickSearchGrid();
        if (currentStudentName && typeof updateStudentModal === 'function') updateStudentModal();
    }

    function acceptTask(task, force) {
        if (!task || !task.state) return false;
        const rev = Number(task.revision) || 0;
        if (!force && rev <= revision) return false;   // 只接受更新的权威快照
        revision = rev;
        paint(task.state, force);
        if (typeof onCloudTaskUpdated === 'function') onCloudTaskUpdated(task);
        return true;
    }

    function setSyncStatus(text, kind) {
        const el = document.getElementById('taskSyncStatus');
        if (!el) return;
        el.textContent = text || '';
        el.dataset.kind = kind || 'ok';
        const inner = document.getElementById('countingSyncStatus');
        if (inner) {
            inner.textContent = text || '';
            inner.dataset.kind = kind || 'ok';
        }
    }

    // ---------- REST ----------

    function listTasks() { return api('api/tasks'); }
    function createTask(name, names, mode, steps) {
        return api('api/tasks', {
            method: 'POST',
            body: { name: name, names: names, mode: mode, steps: steps }
        });
    }
    function getTask(id) { return api('api/tasks/' + id); }
    function updateTask(id, payload) {
        const body = Object.assign({}, payload || {});
        // 带上自己的 WS 连接 id：服务端广播跳过本机，彻底不回声
        if (connId) body.conn_id = connId;
        return api('api/tasks/' + id, { method: 'PUT', body: body });
    }
    function renameTask(id, name) {
        return updateTask(id, { name: name });
    }
    function deleteTask(id) { return api('api/tasks/' + id, { method: 'DELETE' }); }

    async function op(operation, extra) {
        if (!taskId) throw new Error('当前没有打开的任务');
        const body = Object.assign({ op: operation }, extra || {});
        // 带上自己的 WS 连接 id：服务端广播跳过本机，彻底不回声
        if (connId) body.conn_id = connId;
        const data = await api('api/tasks/' + taskId + '/ops',
                               { method: 'POST', body: body });
        acceptTask(data.task, false);
        return data.task;
    }

    // 本地先乐观更新（拖动/点星零延迟），随后由响应与 WS 快照校准。
    function setProgress(name, value) {
        if (!taskId) return Promise.reject(new Error('当前没有打开的任务'));
        appState.progress[name] = value;
        if (typeof updateStudentCard === 'function') updateStudentCard(name);
        return op('set_progress', { name: name, value: value }).catch(function (e) {
            return refreshCurrent(true).catch(function () {}).then(function () { throw e; });
        });
    }

    function setStars(name, value) {
        if (!taskId) return Promise.reject(new Error('当前没有打开的任务'));
        appState.stars[name] = value;
        if (typeof updateStudentCard === 'function') updateStudentCard(name);
        return op('set_stars', { name: name, value: value }).catch(function (e) {
            return refreshCurrent(true).catch(function () {}).then(function () { throw e; });
        });
    }

    function reset() {
        if (!taskId) return;
        return op('reset');
    }

    function setNames(names) {
        if (!taskId) return Promise.reject(new Error('当前没有打开的任务'));
        return op('set_names', { names: names });
    }

    async function refreshCurrent(force) {
        if (!taskId) return;
        const data = await getTask(taskId);
        acceptTask(data.task, !!force);
        return data.task;
    }

    // ---------- WebSocket ----------

    function send(payload) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            try { socket.send(JSON.stringify(payload)); } catch (e) { /* 忽略 */ }
        }
    }

    function stopPing() {
        if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    }

    function startPing() {
        stopPing();
        pingTimer = setInterval(function () { send({ type: 'ping', ts: Date.now() }); },
                                HEARTBEAT_INTERVAL);
    }

    function scheduleReconnect() {
        if (closedByUs || reconnectTimer) return;
        setSyncStatus('连接已断开，正在重连…', 'warn');
        reconnectTimer = setTimeout(function () {
            reconnectTimer = null;
            connect(taskId, true);
        }, nextRetryDelay());
    }

    function connect(nextTaskId, isReconnect) {
        const id = (nextTaskId === undefined) ? taskId : nextTaskId;
        closedByUs = false;
        if (!isReconnect) {
            if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
            dropFails = 0;
            if (socket) {
                try { socket.onclose = null; socket.close(); } catch (e) { /* 忽略 */ }
            }
        }
        taskId = id || null;

        let ws;
        try { ws = new WebSocket(wsUrl(taskId)); }
        catch (e) {
            setSyncStatus('无法建立实时连接', 'warn');
            scheduleReconnect();
            return;
        }
        socket = ws;

        ws.onopen = function () {
            dropFails = 0;
            setSyncStatus('实时同步已连接', 'ok');
            send({ type: taskId ? 'state_request' : 'tasks_request' });
            startPing();
        };
        ws.onmessage = function (event) {
            let msg;
            try { msg = JSON.parse(event.data); } catch (e) { return; }
            if (!msg || typeof msg !== 'object') return;
            switch (msg.type) {
                case 'ping':
                    send({ type: 'pong', ts: msg.ts });
                    break;
                case 'pong':
                    break;
                case 'hello':
                    // 记下本机连接 id：操作带给服务端，广播据此跳过本机
                    if (msg.conn_id) connId = msg.conn_id;
                    break;
                case 'state':
                    if (taskId && msg.task && Number(msg.task.id) === Number(taskId)) {
                        acceptTask(msg.task, false);
                    }
                    break;
                case 'tasks_changed':
                    if (!taskId && typeof scheduleTaskListRefresh === 'function') {
                        scheduleTaskListRefresh();
                    }
                    break;
                case 'task_deleted':
                    if (taskId && Number(msg.task_id) === Number(taskId)) {
                        stopPing();
                        if (typeof onCloudTaskDeleted === 'function') onCloudTaskDeleted();
                    } else if (!taskId && typeof scheduleTaskListRefresh === 'function') {
                        scheduleTaskListRefresh();
                    }
                    break;
                case 'error':
                    setSyncStatus(msg.message || '同步连接异常', 'warn');
                    break;
                default:
                    break;
            }
        };
        ws.onclose = function () {
            stopPing();
            if (socket === ws) socket = null;
            scheduleReconnect();
        };
        ws.onerror = function () { /* onclose 会负责重连 */ };
    }

    function disconnect() {
        closedByUs = true;
        stopPing();
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        if (socket) {
            try { socket.onclose = null; socket.close(); } catch (e) { /* 忽略 */ }
            socket = null;
        }
        taskId = null;
        connId = null;
    }

    function resetRevision(next) {
        revision = Number(next) || 0;
        namesSignature = '';
    }

    return {
        api: api,
        apiBaseForImport: function (path) { return apiBase() + path; },
        listTasks: listTasks, createTask: createTask, getTask: getTask,
        renameTask: renameTask, updateTask: updateTask, deleteTask: deleteTask,
        setProgress: setProgress, setStars: setStars, reset: reset, setNames: setNames,
        refreshCurrent: refreshCurrent,
        connect: connect, disconnect: disconnect,
        acceptTask: acceptTask, paint: paint,
        resetRevision: resetRevision, setSyncStatus: setSyncStatus,
        get taskId() { return taskId; }
    };
})();

// 页面重新可见时补一次校准：后台标签页可能错过推送
document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (CloudSync.taskId) {
        CloudSync.refreshCurrent(true).catch(function () {});
    } else if (typeof scheduleTaskListRefresh === 'function') {
        scheduleTaskListRefresh();
    }
});
