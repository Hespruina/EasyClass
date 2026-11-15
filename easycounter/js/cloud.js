/*
 * EasyCounter 纯云端数据层
 *
 * 浏览器不再保存任何计票数据（名单 / 票数 / 排名），全部以 counter.db 为准：
 *   - 每个操作（加票 / 减票 / 清空 / 改名单）都走一次 POST /ops 立即落库；
 *   - WebSocket 带 5s 心跳，把权威快照推给同账号的其它设备；
 *   - revision 单调递增，只接受比本地更新的快照，网络乱序不会回退。
 *
 * 防闪烁：显示值 = 服务器权威值 + 在途增量（pendingOps）。每个 POST 带 tag，
 * 响应回显 tag 后销账——连点时先回来的旧快照不会把显示值盖回过去。
 * 服务端广播跳过发起者连接（hello 下发的 conn_id 随 ops 带回），不产生回声。
 *
 * 本机 localStorage 只剩 UI 偏好（搜索模式 / 主题），与计票数据无关。
 */
const CloudSync = (function () {
    'use strict';

    const HEARTBEAT_INTERVAL = 5000;   // 与后端 counter_hub 一致
    // 断线重连节奏（与易积分 / 易排座 / 易任务 / 易点名一致）：
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

    // ---------- 在途增量（防闪烁核心） ----------
    // 显示值 = 服务器权威值 + 尚未确认的本地增量。点击时本地先 +1 并记一条
    // pending（tag 与 POST 一一对应）；响应回显 tag 后销账。这样快点的多笔
    // 点击之间，先回来的旧快照不会把显示值「盖回过去」（忽大忽小的根源）。
    let serverVotes = {};              // 最近一次权威快照的票数（不含 pending）
    let serverTotal = 0;               // 最近一次权威快照的总票数
    const pendingOps = new Map();      // tag -> { name, delta }  （delta: +1 / -1）
    let opSeq = 0;

    function pendingFor(name) {
        let d = 0;
        pendingOps.forEach(function (p) {
            if (p.name === name) d += p.delta;
        });
        return d;
    }
    function pendingTotal() {
        let d = 0;
        pendingOps.forEach(function (p) { d += p.delta; });
        return d;
    }
    function clearPending() {
        pendingOps.clear();
        opSeq = 0;
    }

    // 权威值没变、只销了账时，acceptTask 会因 revision 相同而拒绝重绘；
    // 这里按名字用「权威值 + 剩余 pending」修正显示（不触发 pulse 动画）。
    function syncNames(names) {
        let touched = false;
        names.forEach(function (name) {
            const item = appState.namesData.find(function (i) { return i.name === name; });
            if (!item) return;
            const idx = appState.namesData.indexOf(item);
            const shown = (serverVotes[name] || 0) + pendingFor(name);
            appState.votes[name] = shown;
            const el = document.getElementById('score-' + idx);
            if (el) {
                if (el.innerText !== String(shown)) el.innerText = shown;
                if (shown > 10) el.classList.add('high-score');
                else el.classList.remove('high-score');
            }
            touched = true;
        });
        if (touched) {
            if (typeof updateRankList === 'function') updateRankList();
            if (typeof updateTotal === 'function') updateTotal();
        }
    }

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

        // 记录权威值，再叠加在途增量得到显示值
        serverVotes = (s.votes && typeof s.votes === 'object') ? s.votes : {};
        serverTotal = Number(s.totalVotes) || 0;
        appState.namesData.forEach(function (item) {
            if (typeof serverVotes[item.name] !== 'number') serverVotes[item.name] = 0;
        });
        appState.votes = {};
        appState.namesData.forEach(function (item) {
            appState.votes[item.name] = (serverVotes[item.name] || 0) + pendingFor(item.name);
        });
        appState.totalVotes = serverTotal + pendingTotal();

        if (changedNames && typeof renderGrid === 'function') {
            renderGrid();
        } else {
            appState.namesData.forEach(function (item) {
                const idx = appState.namesData.indexOf(item);
                const el = document.getElementById('score-' + idx);
                if (el) {
                    const shown = appState.votes[item.name];
                    // 值没变就不写 DOM：响应/广播风暴下不再有无谓的重绘闪烁
                    if (el.innerText !== String(shown)) el.innerText = shown;
                    if (shown > 10) el.classList.add('high-score');
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

    function listTasks() { return api('api/counter/tasks'); }
    function createTask(name, names) {
        return api('api/counter/tasks', { method: 'POST', body: { name: name, names: names } });
    }
    function getTask(id) { return api('api/counter/tasks/' + id); }
    function renameTask(id, name) {
        return api('api/counter/tasks/' + id, { method: 'PUT', body: { name: name } });
    }
    function deleteTask(id) { return api('api/counter/tasks/' + id, { method: 'DELETE' }); }

    async function op(operation, extra, tag) {
        if (!taskId) throw new Error('当前没有打开的计票任务');
        const body = Object.assign({ op: operation }, extra || {});
        if (tag !== undefined) body.tag = tag;
        // 带上自己的 WS 连接 id：服务端广播跳过本机，彻底不回声
        if (connId) body.conn_id = connId;
        const data = await api('api/counter/tasks/' + taskId + '/ops',
                               { method: 'POST', body: body });
        // 销账后再 paint：快照(权威) + 剩余 pending = 正确显示值
        const settledNames = settlePending(tag);
        const accepted = acceptTask(data.task, false);
        if (settledNames && !accepted) syncNames(settledNames);
        return data.task;
    }

    // tag 的响应回来了 = 权威快照已包含该笔操作，从 pending 中销账。
    // 返回受影响的名字（供快照被 revision 挡掉时手动修正显示）。
    function settlePending(tag) {
        if (tag === undefined || tag === null) return null;
        const rec = pendingOps.get(tag);
        if (!rec) return null;
        pendingOps.delete(tag);
        return [rec.name];
    }

    // 本地先乐观更新（点击零延迟），随后由 op 的响应与 WS 快照校准。
    // 在途期间显示值由 paint 的 pending 叠加机制维持，快点的连点不会再闪。
    function vote(name, operation) {
        if (!taskId) return;
        const tag = 'v' + (++opSeq);
        pendingOps.set(tag, { name: name, delta: operation === 'add' ? 1 : -1 });
        return op(operation, { name: name }, tag).catch(function (e) {
            pendingOps.delete(tag);
            if (typeof showCustomAlert === 'function') showCustomAlert('保存失败：' + e.message);
            // 失败后状态不明：丢弃全部在途增量，以服务器为准整刷一次
            clearPending();
            return refreshCurrent(true).catch(function () {});
        });
    }
    function resetVotes() {
        if (!taskId) return;
        clearPending();        // reset 是权威全量操作，未确认的 add/sub 一并作废
        return op('reset').catch(function (e) {
            if (typeof showCustomAlert === 'function') showCustomAlert('保存失败：' + e.message);
            return refreshCurrent(true).catch(function () {});
        });
    }
    function setNames(names) {
        if (!taskId) return Promise.reject(new Error('当前没有打开的计票任务'));
        clearPending();        // 改名单会重置票数，在途增量同样作废
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
                    // 记下本机连接 id：计票操作带给服务端，广播据此跳过本机
                    if (msg.conn_id) connId = msg.conn_id;
                    break;
                case 'state':
                    if (taskId && msg.task && Number(msg.task.id) === Number(taskId)) {
                        acceptTask(msg.task, false);
                    }
                    break;
                case 'votes_changed':
                    // 只停在任务列表页时：卡片上的「已投票」就地更新，不整列表重拉
                    if (!taskId && typeof onCloudVotesChanged === 'function') {
                        onCloudVotesChanged(msg.task_id, msg.total_votes);
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
        connId = null;
        clearPending();
    }

    function resetRevision(next) {
        revision = Number(next) || 0;
        namesSignature = '';
        clearPending();        // 换任务：在途增量属于旧任务，全部作废
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
        CloudSync.refreshCurrent(true).catch(function () {});
    } else if (typeof refreshTaskList === 'function') {
        refreshTaskList();
    }
});
