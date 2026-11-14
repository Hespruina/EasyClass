/*
 * EasyCounter 纯云端数据层
 *
 * 浏览器不再保存任何计票数据（名单 / 票数 / 排名），全部以 counter.db 为准：
 *   - 每个操作（加票 / 减票 / 清空 / 改名单）都走一次 POST /ops 立即落库；
 *   - WebSocket 带 5s 心跳，把权威快照推给同账号的其它设备；
 *   - revision 单调递增，只接受比本地更新的快照，网络乱序不会回退。
 *
 * 本机 localStorage 只剩 UI 偏好（操作模式 / 搜索模式 / 主题），与计票数据无关。
 */
const CloudSync = (function () {
    'use strict';

    const HEARTBEAT_INTERVAL = 5000;   // 与后端 counter_hub 一致
    const RECONNECT_MIN = 1500;
    const RECONNECT_MAX = 10000;

    function apiBase() {
        const pathname = window.location.pathname;
        const dir = pathname.substring(0, pathname.lastIndexOf('/') + 1);
        return new URL(dir + '../easycore/', window.location.origin).href;
    }

    function wsUrl(taskId) {
        const base = apiBase();                       // https://host/easycore/
        const url = new URL('api/counter/ws', base);
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
    let pingTimer = null;
    let reconnectTimer = null;
    let reconnectDelay = RECONNECT_MIN;
    let closedByUs = false;
    let namesSignature = '';

    function signature(state) {
        const names = (state && state.namesData) || [];
        return names.map(function (i) { return i.name; }).join('\u0001');
    }

    function paint(state, force) {
        const s = state || {};
        const changedNames = force || signature(s) !== namesSignature;
        namesSignature = signature(s);

        appState.namesData = Array.isArray(s.namesData) ? s.namesData : [];
        appState.groupedByLetter = s.groupedByLetter || {};
        appState.availableLetters = Array.isArray(s.availableLetters) ? s.availableLetters : [];
        appState.votes = (s.votes && typeof s.votes === 'object') ? s.votes : {};
        appState.totalVotes = Number(s.totalVotes) || 0;
        appState.namesData.forEach(function (item) {
            if (typeof appState.votes[item.name] !== 'number') appState.votes[item.name] = 0;
        });

        if (changedNames && typeof renderGrid === 'function') {
            renderGrid();
        } else {
            appState.namesData.forEach(function (item) {
                const idx = appState.namesData.indexOf(item);
                const el = document.getElementById('score-' + idx);
                if (el) {
                    el.innerText = appState.votes[item.name];
                    if (appState.votes[item.name] > 10) el.classList.add('high-score');
                    else el.classList.remove('high-score');
                }
            });
        }
        if (typeof updateRankList === 'function') updateRankList(!!changedNames);
        if (typeof updateTotal === 'function') updateTotal();
        if (changedNames && typeof updateLetterGrid === 'function') updateLetterGrid();
        if (changedNames && typeof updateQuickSearchGrid === 'function') updateQuickSearchGrid();
    }

    function acceptTask(task, force) {
        if (!task || !task.state) return;
        const rev = Number(task.revision) || 0;
        if (!force && rev <= revision) return;      // 只接受更新的权威快照
        revision = rev;
        paint(task.state, force);
        if (typeof onCloudTaskUpdated === 'function') onCloudTaskUpdated(task);
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

    function listTasks() { return api('api/counter/tasks'); }
    function createTask(name, names) {
        return api('api/counter/tasks', { method: 'POST', body: { name: name, names: names } });
    }
    function getTask(id) { return api('api/counter/tasks/' + id); }
    function renameTask(id, name) {
        return api('api/counter/tasks/' + id, { method: 'PUT', body: { name: name } });
    }
    function deleteTask(id) { return api('api/counter/tasks/' + id, { method: 'DELETE' }); }

    async function op(operation, extra) {
        if (!taskId) throw new Error('当前没有打开的计票任务');
        const body = Object.assign({ op: operation }, extra || {});
        const data = await api('api/counter/tasks/' + taskId + '/ops',
                               { method: 'POST', body: body });
        acceptTask(data.task, false);
        return data.task;
    }

    // 本地先乐观更新（点击零延迟），随后由 op 的响应与 WS 快照校准
    function vote(name, operation) {
        if (!taskId) return;
        return op(operation, { name: name }).catch(function (e) {
            if (typeof showCustomAlert === 'function') showCustomAlert('保存失败：' + e.message);
            return refreshCurrent().catch(function () {});
        });
    }
    function resetVotes() {
        if (!taskId) return;
        return op('reset').catch(function (e) {
            if (typeof showCustomAlert === 'function') showCustomAlert('保存失败：' + e.message);
            return refreshCurrent().catch(function () {});
        });
    }
    function setNames(names) {
        if (!taskId) return Promise.reject(new Error('当前没有打开的计票任务'));
        return op('set_names', { names: names });
    }

    async function refreshCurrent() {
        if (!taskId) return;
        const data = await getTask(taskId);
        acceptTask(data.task, true);
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
            reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX);
            connect(taskId, true);
        }, reconnectDelay);
    }

    function connect(nextTaskId, isReconnect) {
        const id = (nextTaskId === undefined) ? taskId : nextTaskId;
        closedByUs = false;
        if (!isReconnect) {
            if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
            reconnectDelay = RECONNECT_MIN;
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
            reconnectDelay = RECONNECT_MIN;
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
                    break;
                case 'state':
                    if (taskId && msg.task && Number(msg.task.id) === Number(taskId)) {
                        acceptTask(msg.task, false);
                    }
                    break;
                case 'tasks_changed':
                    if (!taskId && typeof refreshTaskList === 'function') refreshTaskList();
                    break;
                case 'task_deleted':
                    if (taskId && Number(msg.task_id) === Number(taskId)) {
                        stopPing();
                        if (typeof onCloudTaskDeleted === 'function') onCloudTaskDeleted();
                    } else if (!taskId && typeof refreshTaskList === 'function') {
                        refreshTaskList();
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
    }

    function resetRevision(next) {
        revision = Number(next) || 0;
        namesSignature = '';
    }

    return {
        api: api,
        apiBaseForImport: function (path) { return apiBase() + path; },
        listTasks: listTasks, createTask: createTask, getTask: getTask,
        renameTask: renameTask, deleteTask: deleteTask,
        vote: vote, resetVotes: resetVotes, setNames: setNames,
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
        CloudSync.refreshCurrent().catch(function () {});
    } else if (typeof refreshTaskList === 'function') {
        refreshTaskList();
    }
});
