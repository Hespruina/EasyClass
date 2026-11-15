// 获取排序后的数据
function getRankedData() {
let items = [...appState.namesData];
items.sort((a, b) => {
if (appState.votes[b.name] !== appState.votes[a.name]) {
return appState.votes[b.name] - appState.votes[a.name];
}
return a.name.localeCompare(b.name);
});
return items;
}
// 更新排名列表
function updateRankList(forceInstant = false) {
const currentOrder = getRankedData();
currentOrder.forEach((item, rank) => {
let rankItem = rankItemMap.get(item.name);
if (!rankItem) {
rankItem = createRankItem(item, rank);
rankItemMap.set(item.name, rankItem);
rankList.appendChild(rankItem);
} else {
updateRankItemContent(rankItem, item, rank);
}
});
currentOrder.forEach((item) => {
const rankItem = rankItemMap.get(item.name);
if (rankItem) {
rankList.appendChild(rankItem);
}
});
currentOrder.forEach((item, rank) => {
const rankItem = rankItemMap.get(item.name);
if (!rankItem) return;
const oldRank = lastRankOrder.findIndex(o => o.name === item.name);
if (!forceInstant && oldRank !== -1 && oldRank !== rank) {
const changeEl = rankItem.querySelector('.rank-change');
if (changeEl) {
changeEl.className = 'rank-change';
if (rank < oldRank) {
changeEl.classList.add('up');
changeEl.innerText = '↑';
} else {
changeEl.classList.add('down');
changeEl.innerText = '↓';
}
if (rankItem._arrowTimeout) clearTimeout(rankItem._arrowTimeout);
rankItem._arrowTimeout = setTimeout(() => {
if (changeEl) changeEl.style.opacity = '0';
}, 2000);
}
} else if (forceInstant && rankItem) {
const changeEl = rankItem.querySelector('.rank-change');
if (changeEl) changeEl.style.opacity = '0';
}
});
for (const [name, el] of rankItemMap.entries()) {
if (!currentOrder.find(i => i.name === name)) {
el.remove();
rankItemMap.delete(name);
}
}
lastRankOrder = [...currentOrder];
}
function createRankItem(item, rank) {
const div = document.createElement('div');
div.className = 'rank-item';
div.dataset.name = item.name;
const numDiv = document.createElement('div');
numDiv.className = 'rank-num';
const infoDiv = document.createElement('div');
infoDiv.className = 'rank-info';
const nameDiv = document.createElement('div');
nameDiv.className = 'rank-name';
const scoreDiv = document.createElement('div');
scoreDiv.className = 'rank-score';
infoDiv.appendChild(nameDiv);
infoDiv.appendChild(scoreDiv);
const changeDiv = document.createElement('div');
changeDiv.className = 'rank-change';
changeDiv.style.opacity = '0';
div.appendChild(numDiv);
div.appendChild(infoDiv);
div.appendChild(changeDiv);
updateRankItemContent(div, item, rank);
return div;
}
function updateRankItemContent(div, item, rank) {
div.classList.remove('top-1', 'top-2', 'top-3');
if (rank === 0) div.classList.add('top-1');
else if (rank === 1) div.classList.add('top-2');
else if (rank === 2) div.classList.add('top-3');
const numEl = div.querySelector('.rank-num');
const nameEl = div.querySelector('.rank-name');
const scoreEl = div.querySelector('.rank-score');
if (numEl) numEl.innerText = rank + 1;
if (nameEl) nameEl.innerText = item.name;
if (scoreEl) scoreEl.innerText = appState.votes[item.name] || 0;
}
function renderGrid() {
grid.innerHTML = '';
// 设置网格容器的事件监听（用于检测操作方式不匹配）
setupGridMismatchDetection();
// 名字卡片布局：混排（默认）按名单顺序铺满网格；按拼音分行按首字母分组分行
const letterLayout = appState.cardLayout === 'pinyin';
grid.classList.toggle('card-layout-letter', letterLayout);
if (letterLayout) {
buildLetterGroups().forEach((group) => {
const row = document.createElement('div');
row.className = 'letter-row';
const head = document.createElement('div');
head.className = 'letter-row-head';
const key = document.createElement('span');
key.className = 'letter-row-key';
key.textContent = group.letter;
const count = document.createElement('span');
count.className = 'letter-row-count';
count.textContent = group.entries.length + ' 人';
const line = document.createElement('span');
line.className = 'letter-row-line';
head.appendChild(key);
head.appendChild(count);
head.appendChild(line);
const cards = document.createElement('div');
cards.className = 'letter-row-cards';
group.entries.forEach((entry) => cards.appendChild(createVoteCard(entry.item, entry.index)));
row.appendChild(head);
row.appendChild(cards);
grid.appendChild(row);
});
return;
}
appState.namesData.forEach((item, index) => {
grid.appendChild(createVoteCard(item, index));
});
}
// 单个投票卡片。index 必须是 namesData 里的下标：票数节点 id 为 score-<index>，
// updateDisplay 靠它直接定位，所以「按拼音分行」也只是分组，不能重排下标。
function createVoteCard(item, index) {
const card = document.createElement('div');
card.className = 'vote-card';
card.dataset.index = index;
card.dataset.name = item.name;
if (appState.touchMode === 'touch') {
// 触屏模式：只绑定 touch 事件
card.addEventListener('touchstart', handleTouchStart, {passive: false});
card.addEventListener('touchend', handleTouchEnd, {passive: false});
card.addEventListener('touchcancel', handleTouchCancel, {passive: false});
} else {
// 鼠标模式：只绑定 mouse 和 click 事件
card.addEventListener('mousedown', handleMouseDown);
card.addEventListener('mouseup', handleMouseUp);
card.addEventListener('mouseleave', handleMouseUp);
card.addEventListener('click', (e) => {
if (e.target.classList.contains('minus-btn') || e.target.closest('.minus-btn')) {
subVote(item.name);
return;
}
addVote(item.name);
});
}
card.innerHTML = `
<div class="student-name">${item.name}</div>
<div class="score-container">
<div class="score-display" id="score-${index}">${appState.votes[item.name]}</div>
</div>
<div class="controls">
<span class="hint-text">${appState.touchMode === 'touch' ? '按压即计分' : '点击加分'}</span>
<div class="minus-btn" data-index="${index}" data-name="${item.name}">−</div>
</div>
`;
return card;
}
// 按拼音首字母分组：A→Z 升序，识别不出首字母的（#）排在最后
function buildLetterGroups() {
const buckets = new Map();
appState.namesData.forEach((item, index) => {
const letter = letterOfName(item);
if (!buckets.has(letter)) buckets.set(letter, []);
buckets.get(letter).push({item: item, index: index});
});
return Array.from(buckets.keys())
.sort((a, b) => {
if (a === '#') return 1;
if (b === '#') return -1;
return a.localeCompare(b);
})
.map((letter) => ({letter: letter, entries: buckets.get(letter)}));
}
// 取名字首字母：优先用云端快照里的 firstLetter；老快照缺该字段时回退到
// groupedByLetter 反查，最后兜底「首字符是字母就用它，否则归 #」
function letterOfName(item) {
if (item && item.firstLetter) return item.firstLetter;
const grouped = appState.groupedByLetter || {};
for (const letter in grouped) {
if (grouped[letter].some((entry) => entry.name === item.name)) return letter;
}
const first = String((item && item.name) || '').charAt(0).toUpperCase();
return /^[A-Z]$/.test(first) ? first : '#';
}
// 设置网格容器的操作方式自动检测：检测到与当前模式不同的输入时静默自动切换
function setupGridMismatchDetection() {
// 移除旧的事件监听
grid.removeEventListener('mousedown', handleGridMouseDown);
grid.removeEventListener('touchstart', handleGridTouchStart);
if (appState.touchMode === 'touch') {
// 触屏模式下，监听鼠标事件来检测不匹配
grid.addEventListener('mousedown', handleGridMouseDown);
} else {
// 鼠标模式下，监听触摸事件来检测不匹配（使用捕获阶段确保优先触发）
grid.addEventListener('touchstart', handleGridTouchStart, { capture: true });
}
}
function handleGridMouseDown(e) {
if (e.target.closest('.vote-card') || e.target.closest('.minus-btn')) {
setTouchMode('mouse');
}
}
function handleGridTouchStart(e) {
if (e.target.closest('.vote-card') || e.target.closest('.minus-btn')) {
setTouchMode('touch');
}
}
function handleMouseDown(e) {
const btn = e.target.closest('.minus-btn');
const card = e.currentTarget;
if (btn) btn.classList.add('is-pressed'); else card.classList.add('is-pressed');
}
function handleMouseUp(e) {
const btn = e.target.closest('.minus-btn');
const card = e.currentTarget;
if (btn) btn.classList.remove('is-pressed');
if (card) card.classList.remove('is-pressed');
}
function handleTouchStart(e) {
for (let i = 0; i < e.changedTouches.length; i++) {
const touch = e.changedTouches[i];
const target = document.elementFromPoint(touch.clientX, touch.clientY);
if (!target) continue;
const minusBtn = target.closest('.minus-btn');
const card = target.closest('.vote-card');
if (!card) continue;
activeTouches.set(touch.identifier, {
name: card.dataset.name,
index: parseInt(card.dataset.index),
card: card,
isMinus: !!minusBtn,
startX: touch.clientX,
startY: touch.clientY,
hasMoved: false
});
if (minusBtn) minusBtn.classList.add('is-pressed');
else card.classList.add('is-pressed');
}
}
function handleTouchMove(e) {
for (let i = 0; i < e.changedTouches.length; i++) {
const touch = e.changedTouches[i];
const data = activeTouches.get(touch.identifier);
if (!data) continue;
const dx = Math.abs(touch.clientX - data.startX);
const dy = Math.abs(touch.clientY - data.startY);
if (dx > 5 || dy > 5) {
data.hasMoved = true;
if (data.isMinus) {
const btn = data.card.querySelector('.minus-btn');
if (btn) btn.classList.remove('is-pressed');
} else {
data.card.classList.remove('is-pressed');
}
}
}
}
function handleTouchEnd(e) {
let shouldPreventDefault = false;
for (let i = 0; i < e.changedTouches.length; i++) {
const touch = e.changedTouches[i];
const data = activeTouches.get(touch.identifier);
if (!data) continue;
const { name, card, isMinus, hasMoved } = data;
if (isMinus) {
const btn = card.querySelector('.minus-btn');
if (btn) btn.classList.remove('is-pressed');
}
card.classList.remove('is-pressed');
if (!hasMoved) {
const endTarget = document.elementFromPoint(touch.clientX, touch.clientY);
let valid = false;
if (isMinus) {
const btn = card.querySelector('.minus-btn');
if (btn && endTarget && (btn.contains(endTarget) || endTarget === btn)) valid = true;
} else {
if (endTarget && card.contains(endTarget) && !endTarget.closest('.minus-btn')) valid = true;
}
if (valid) {
isMinus ? subVote(name) : addVote(name);
shouldPreventDefault = true;
}
}
activeTouches.delete(touch.identifier);
}
if (shouldPreventDefault) {
e.preventDefault();
}
}
function handleTouchCancel(e) {
for (let i = 0; i < e.changedTouches.length; i++) {
const touch = e.changedTouches[i];
const data = activeTouches.get(touch.identifier);
if (data) {
if (data.isMinus) {
const btn = data.card.querySelector('.minus-btn');
if (btn) btn.classList.remove('is-pressed');
}
data.card.classList.remove('is-pressed');
activeTouches.delete(touch.identifier);
}
}
}
function addVote(name) {
if (!currentTaskId) return;
appState.votes[name] = (appState.votes[name] || 0) + 1;
appState.totalVotes++;
updateDisplay(name);
updateTotal();
updateRankList();
CloudSync.vote(name, 'add');   // 每个操作立即落库，并广播给其它设备
}
function subVote(name) {
if (!currentTaskId) return;
if (appState.votes[name] > 0) {
appState.votes[name]--;
appState.totalVotes--;
updateDisplay(name);
updateTotal();
updateRankList();
CloudSync.vote(name, 'sub');
}
}
function updateDisplay(name) {
const item = appState.namesData.find(i => i.name === name);
if (!item) return;
const index = appState.namesData.indexOf(item);
const el = document.getElementById(`score-${index}`);
if (!el) return;
el.innerText = appState.votes[name];
el.classList.remove('pulse');
void el.offsetWidth;
el.classList.add('pulse');
if (appState.votes[name] > 10) el.classList.add('high-score');
else el.classList.remove('high-score');
}
function updateTotal() {
const text = String(appState.totalVotes);
// 值没变化就不重绘：云端响应/广播校准时不再闪一下透明度
if (totalEl.innerText === text) return;
totalEl.innerText = text;
totalEl.style.opacity = '0.5';
setTimeout(() => totalEl.style.opacity = '1', 100);
}
function setupResize() {
let isDragging = false;
const startDrag = (e) => {
isDragging = true;
resizeHandle.classList.add('dragging');
document.body.style.cursor = 'col-resize';
};
const doDrag = (e) => {
if (!isDragging) return;
if (e.cancelable) e.preventDefault();
const clientX = e.touches ? e.touches[0].clientX : e.clientX;
const totalWidth = window.innerWidth;
let newWidthPercent = (clientX / totalWidth) * 100;
if (newWidthPercent < 15) newWidthPercent = 15;
if (newWidthPercent > 45) newWidthPercent = 45;
rankPanel.style.width = `${newWidthPercent}%`;
};
const stopDrag = () => {
isDragging = false;
resizeHandle.classList.remove('dragging');
document.body.style.cursor = 'default';
};
resizeHandle.addEventListener('mousedown', startDrag);
resizeHandle.addEventListener('touchstart', startDrag, {passive: false});
window.addEventListener('mousemove', doDrag);
window.addEventListener('touchmove', doDrag, {passive: false});
window.addEventListener('mouseup', stopDrag);
window.addEventListener('touchend', stopDrag);
}
function openSettings() {
settingsModal.classList.add('show');
updateSearchModeUI();
updateThemeUI();
updateCardLayoutUI();
if (isLoggedIn) {
    fetchAndRenderCloudLists();
}
}
function closeSettings() {
settingsModal.classList.add('hiding');
setTimeout(() => {
settingsModal.classList.remove('show');
settingsModal.classList.remove('hiding');
}, 300);
}
function setTouchMode(mode) {
appState.touchMode = mode;
renderGrid();
updateRankList(true);
}
// 名字卡片布局：混排 / 按拼音分行（本机偏好，与搜索模式、主题一样存 localStorage）
function updateCardLayoutUI() {
const isLetter = appState.cardLayout === 'pinyin';
if (layoutMixedBtn) layoutMixedBtn.classList.toggle('active', !isLetter);
if (layoutPinyinBtn) layoutPinyinBtn.classList.toggle('active', isLetter);
}
function setCardLayout(mode) {
appState.cardLayout = mode === 'pinyin' ? 'pinyin' : 'mixed';
Storage.set('cardLayout', appState.cardLayout);
updateCardLayoutUI();
renderGrid();
}
function resetData() {
showCustomConfirm('确定清空所有票数？', (confirmed) => {
if (!confirmed || !currentTaskId) return;
Object.keys(appState.votes).forEach(key => {
appState.votes[key] = 0;
});
appState.totalVotes = 0;
renderGrid();
updateRankList(true);
updateTotal();
CloudSync.resetVotes();   // 云端同步清空，其它设备同步归零
});
}