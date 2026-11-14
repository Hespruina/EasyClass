// ==================== 状态派生 ====================

function getProgress(name) {
    const value = appState.progress[name];
    return typeof value === 'number' && isFinite(value) ? value : 0;
}

function getStars(name) {
    const value = appState.stars[name];
    return typeof value === 'number' && isFinite(value) ? value : 0;
}

function getStudentStatus(name) {
    const progress = getProgress(name);
    if (progress >= 100) return 'done';
    if (progress > 0) return 'doing';
    return 'todo';
}

// 进度数字配色：0 灰 / 进行中蓝 / 完成绿
function applyProgressTone(el, value) {
    if (!el) return;
    el.classList.toggle('is-zero', value <= 0);
    el.classList.toggle('is-done', value >= 100);
    el.classList.toggle('is-doing', value > 0 && value < 100);
}

// ==================== 完成方式（百分制 / 分次数 / 一次完成） ====================

function totalSteps() {
    return Math.max(2, Math.min(20, Number(appState.steps) || 3));
}

// 进度百分比 -> 已完成次数（四舍五入）
function progressToStep(value) {
    return Math.max(0, Math.min(totalSteps(), Math.round(value * totalSteps() / 100)));
}

// 已完成次数 -> 进度百分比
function stepToProgress(step) {
    const steps = totalSteps();
    const k = Math.max(0, Math.min(steps, Number(step) || 0));
    return Math.round(k * 100 / steps);
}

// 按当前完成方式显示进度文本
function progressDisplayText(value) {
    if (appState.mode === 'steps') return progressToStep(value) + ' / ' + totalSteps();
    if (appState.mode === 'once') return value >= 100 ? '已完成' : '未完成';
    return value + '%';
}

function statusText(status) {
    if (status === 'done') return '已完成';
    if (status === 'doing') return '进行中';
    return '未开始';
}

function starText(stars) {
    return '★★★★★'.slice(0, stars) + '☆☆☆☆☆'.slice(0, 5 - stars);
}

// ==================== 学生卡片 ====================

function studentCardInner(name) {
    const progress = getProgress(name);
    const stars = getStars(name);
    const status = getStudentStatus(name);
    const safeName = escapeHtml(name);
    if (status === 'done') {
        const starLabel = stars > 0 ? stars + ' 星' : '未评分';
        return '<div class="student-name">' + safeName + '</div>' +
               '<div class="card-stars" title="' + starLabel + '">' +
               starText(stars) + '</div>' +
               '<div class="card-status">已完成 · ' + starLabel + '</div>';
    }
    return '<div class="student-name">' + safeName + '</div>' +
           '<div class="card-percent is-' + appState.mode +
           (progress <= 0 ? ' is-zero' : '') + '">' +
           progressDisplayText(progress) + '</div>' +
           '<div class="card-progress-track"><i style="width:' + progress + '%"></i></div>' +
           '<div class="card-status">' + statusText(status) + '</div>';
}

function createStudentCard(item, index) {
    const card = document.createElement('div');
    card.className = 'vote-card is-' + getStudentStatus(item.name);
    card.dataset.index = index;
    card.dataset.name = item.name;
    card.innerHTML = studentCardInner(item.name);
    card.addEventListener('click', function () { openStudentModal(item.name); });
    return card;
}

function renderGrid() {
    grid.innerHTML = '';
    appState.namesData.forEach(function (item, index) {
        grid.appendChild(createStudentCard(item, index));
    });
}

function updateStudentCard(name) {
    const card = grid.querySelector('.vote-card[data-name="' + cssEscape(name) + '"]');
    if (!card) return;
    card.className = 'vote-card is-' + getStudentStatus(name);
    card.innerHTML = studentCardInner(name);
}

function refreshAllStudents() {
    appState.namesData.forEach(function (item) { updateStudentCard(item.name); });
}

// 姓名可能包含 CSS 特殊字符，用属性选择器前先转义
function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
}

// ==================== 完成情况总览 ====================

function renderOverview() {
    if (!overviewList) return;
    const scrollTop = overviewList.scrollTop;
    overviewList.innerHTML = '';

    const groups = [
        { key: 'done', title: '已完成' },
        { key: 'doing', title: '进行中' },
        { key: 'todo', title: '未开始' }
    ];
    const buckets = { done: [], doing: [], todo: [] };
    appState.namesData.forEach(function (item) {
        buckets[getStudentStatus(item.name)].push(item);
    });
    buckets.doing.sort(function (a, b) {
        return getProgress(b.name) - getProgress(a.name) || a.name.localeCompare(b.name);
    });
    buckets.todo.sort(function (a, b) { return a.name.localeCompare(b.name); });
    buckets.done.sort(function (a, b) { return a.name.localeCompare(b.name); });

    groups.forEach(function (group) {
        const items = buckets[group.key];
        const wrap = document.createElement('div');
        wrap.className = 'overview-group overview-group-' + group.key;

        const head = document.createElement('div');
        head.className = 'overview-group-title';
        const label = document.createElement('span');
        label.textContent = group.title;
        const count = document.createElement('b');
        count.textContent = String(items.length);
        head.appendChild(label);
        head.appendChild(count);
        wrap.appendChild(head);

        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'overview-empty';
            empty.textContent = '暂无';
            wrap.appendChild(empty);
        }

        items.forEach(function (item) {
            const status = getStudentStatus(item.name);
            const row = document.createElement('div');
            row.className = 'overview-row is-' + status;
            row.dataset.name = item.name;

            const name = document.createElement('span');
            name.className = 'overview-row-name';
            name.textContent = item.name;

            const meta = document.createElement('span');
            meta.className = 'overview-row-meta';
            if (status === 'done') {
                meta.textContent = getStars(item.name) > 0
                    ? starText(getStars(item.name))
                    : '已完成';
            } else if (status === 'doing') {
                meta.textContent = progressDisplayText(getProgress(item.name));
            } else {
                meta.textContent = '未开始';
            }

            row.appendChild(name);
            row.appendChild(meta);
            row.addEventListener('click', function () { openStudentModal(item.name); });
            wrap.appendChild(row);
        });
        overviewList.appendChild(wrap);
    });

    updateOverviewStats();
    overviewList.scrollTop = scrollTop;
}

function updateOverviewStats() {
    let done = 0;
    let progressSum = 0;
    appState.namesData.forEach(function (item) {
        if (getStudentStatus(item.name) === 'done') done++;
        progressSum += getProgress(item.name);
    });
    const total = appState.namesData.length;
    if (overviewDoneCount) overviewDoneCount.textContent = String(done);
    if (overviewUndoneCount) overviewUndoneCount.textContent = String(total - done);
    if (overviewTotalCount) overviewTotalCount.textContent = String(total);
    if (overviewProgressPercent) {
        const average = total ? Math.round(progressSum / total) : 0;
        overviewProgressPercent.textContent = average + '%';
        applyProgressTone(overviewProgressPercent, average);
    }
}

// ==================== 学生进度 / 星级弹窗 ====================

function ensureStarButtons() {
    if (!studentStars || studentStars.children.length > 0) return;
    for (let i = 1; i <= 5; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'student-star-btn';
        btn.dataset.value = String(i);
        btn.setAttribute('aria-label', i + ' 星');
        btn.textContent = '★';
        btn.addEventListener('click', function () { toggleStudentStar(i); });
        studentStars.appendChild(btn);
    }
}

function openStudentModal(name) {
    if (!currentTaskId || !appState.progress.hasOwnProperty(name)) return;
    currentStudentName = name;
    ensureStarButtons();
    if (appState.mode === 'steps') ensureStepButtons();
    applyTaskModeUI();
    updateStudentModal();
    studentModal.classList.add('show');
}

// 按任务完成方式切换弹窗控件
function applyTaskModeUI() {
    const mode = appState.mode;
    if (studentProgressRange) studentProgressRange.classList.toggle('hidden', mode !== 'percent');
    if (studentProgressScale) studentProgressScale.classList.toggle('hidden', mode !== 'percent');
    if (studentStepOptions) studentStepOptions.classList.toggle('hidden', mode !== 'steps');
    if (studentOnceOptions) studentOnceOptions.classList.toggle('hidden', mode !== 'once');
    if (studentProgressLabel) {
        studentProgressLabel.textContent =
            mode === 'steps' ? '已完成次数' : (mode === 'once' ? '完成情况' : '完成进度');
    }
    if (mode === 'steps') ensureStepButtons();
    if (currentStudentName) updateStudentModal();
}

// 分次数制的次数按钮（0 = 未开始，1..N = 第几次）
function ensureStepButtons() {
    if (!studentStepOptions) return;
    const steps = totalSteps();
    if (Number(studentStepOptions.dataset.steps) === steps) return;
    studentStepOptions.dataset.steps = String(steps);
    studentStepOptions.innerHTML = '';
    for (let k = 0; k <= steps; k++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'student-step-btn';
        btn.dataset.step = String(k);
        btn.textContent = k === 0 ? '未开始' : k + ' 次';
        btn.addEventListener('click', function () {
            commitStudentProgress(stepToProgress(k));
        });
        studentStepOptions.appendChild(btn);
    }
}

function closeStudentModal() {
    currentStudentName = null;
    if (!studentModal) return;
    studentModal.classList.add('hiding');
    setTimeout(function () {
        studentModal.classList.remove('show');
        studentModal.classList.remove('hiding');
    }, 200);
}

function updateStudentModal() {
    if (!currentStudentName) return;
    const name = currentStudentName;
    const progress = getProgress(name);
    const stars = getStars(name);
    const status = getStudentStatus(name);

    studentModalName.textContent = name;
    studentProgressRange.value = String(progress);
    studentProgressValue.textContent = progressDisplayText(progress);
    applyProgressTone(studentProgressValue, progress);
    studentStatusLabel.textContent = statusText(status);
    studentStatusLabel.dataset.status = status;

    if (studentStepOptions) {
        const currentStep = progressToStep(progress);
        Array.prototype.forEach.call(
            studentStepOptions.querySelectorAll('.student-step-btn'),
            function (btn) {
                btn.classList.toggle('active', Number(btn.dataset.step) === currentStep);
            });
    }
    if (studentOnceCheckbox) {
        studentOnceCheckbox.checked = progress >= 100;
    }

    if (studentStars) {
        Array.prototype.forEach.call(studentStars.children, function (btn) {
            const value = Number(btn.dataset.value) || 0;
            btn.classList.toggle('is-on', value <= stars);
            btn.classList.toggle('is-current', value === stars);
        });
    }
}

// 拖动时只做本地预览：卡片即时跟手，松手（change）才提交云端
function previewStudentProgress(value) {
    if (!currentStudentName) return;
    const progress = Math.max(0, Math.min(100, Number(value) || 0));
    appState.progress[currentStudentName] = progress;
    studentProgressValue.textContent = progressDisplayText(progress);
    applyProgressTone(studentProgressValue, progress);
    const status = getStudentStatus(currentStudentName);
    studentStatusLabel.textContent = statusText(status);
    studentStatusLabel.dataset.status = status;
    updateStudentCard(currentStudentName);
}

function commitStudentProgress(value) {
    if (!currentStudentName) return;
    const name = currentStudentName;
    const progress = Math.max(0, Math.min(100, Number(value) || 0));
    // 先本地生效，UI 不等待网络；失败时再回滚校准
    appState.progress[name] = progress;
    updateStudentCard(name);
    updateStudentModal();
    renderOverview();
    CloudSync.setProgress(name, progress).catch(function (e) {
        showCustomAlert('保存进度失败：' + e.message);
        CloudSync.refreshCurrent(true).catch(function () {});
    });
}

function toggleStudentStar(value) {
    if (!currentStudentName) return;
    const name = currentStudentName;
    const next = getStars(name) === value ? 0 : value;
    appState.stars[name] = next;
    updateStudentModal();
    updateStudentCard(name);
    CloudSync.setStars(name, next).catch(function (e) {
        showCustomAlert('保存评分失败：' + e.message);
        CloudSync.refreshCurrent(true).catch(function () {});
    });
}

// ==================== 设置 / 清空 ====================

function openSettings() {
    settingsModal.classList.add('show');
    updateSearchModeUI();
    updateThemeUI();
    if (isLoggedIn) {
        fetchAndRenderCloudLists();
    }
}

function closeSettings() {
    settingsModal.classList.add('hiding');
    setTimeout(function () {
        settingsModal.classList.remove('show');
        settingsModal.classList.remove('hiding');
    }, 300);
}

function resetData() {
    showCustomConfirm('确定清空所有学生的进度与评分？', function (confirmed) {
        if (!confirmed || !currentTaskId) return;
        CloudSync.reset().catch(function (e) {
            showCustomAlert('清空失败：' + e.message);
        });
    });
}
