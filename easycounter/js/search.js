// 初始化字母查找网格
function initLetterGrid() {
const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
letterGrid.innerHTML = '';
letters.forEach(letter => {
const btn = document.createElement('button');
btn.className = 'letter-btn';
btn.textContent = letter;
btn.dataset.letter = letter;
btn.addEventListener('click', () => handleLetterClick(letter));
letterGrid.appendChild(btn);
});
}
// 初始化常驻快速查找网格
function initQuickSearchGrid() {
const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
quickSearchGrid.innerHTML = '';
letters.forEach(letter => {
const btn = document.createElement('button');
btn.className = 'quick-search-btn';
btn.textContent = letter;
btn.dataset.letter = letter;
btn.addEventListener('click', () => handleLetterClick(letter));
quickSearchGrid.appendChild(btn);
});
}
// 更新常驻快速查找按钮状态
function updateQuickSearchGrid() {
const buttons = quickSearchGrid.querySelectorAll('.quick-search-btn');
buttons.forEach(btn => {
const letter = btn.dataset.letter;
const hasNames = appState.availableLetters.includes(letter);
btn.classList.toggle('has-names', hasNames);
btn.classList.toggle('empty', !hasNames);
});
}
// 更新搜索模式 UI
function updateSearchModeUI() {
if (appState.searchMode === 'permanent') {
searchPermanentBtn.classList.add('active');
searchModalBtn.classList.remove('active');
quickSearchContainer.classList.remove('hidden');
searchBtn.style.display = 'none';
} else {
searchPermanentBtn.classList.remove('active');
searchModalBtn.classList.add('active');
quickSearchContainer.classList.add('hidden');
searchBtn.style.display = 'flex';
}
}
// 设置搜索模式
function setSearchMode(mode) {
appState.searchMode = mode;
Storage.set('searchMode', mode);
updateSearchModeUI();
}

function setThemeOption(theme) {
ThemeManager.setTheme(theme);
updateThemeUI();
}

function updateThemeUI() {
const currentTheme = ThemeManager.getTheme();
themeSystemBtn.classList.toggle('active', currentTheme === 'system');
themeLightBtn.classList.toggle('active', currentTheme === 'light');
themeDarkBtn.classList.toggle('active', currentTheme === 'dark');
}
// 更新字母按钮状态
function updateLetterGrid() {
const buttons = letterGrid.querySelectorAll('.letter-btn');
buttons.forEach(btn => {
const letter = btn.dataset.letter;
const hasNames = appState.availableLetters.includes(letter);
btn.classList.toggle('has-names', hasNames);
btn.classList.toggle('empty', !hasNames);
});
}
// 处理字母点击
function handleLetterClick(letter) {
if (!appState.availableLetters.includes(letter)) return;
// 关闭查找弹窗
closeLetterSearch();
// 高亮对应的人
highlightByLetter(letter);
}
// 高亮指定首字母的所有人员
function highlightByLetter(letter) {
const names = appState.groupedByLetter[letter];
if (!names || names.length === 0) return;
// 获取所有需要高亮的卡片和排名项
const cards = [];
const rankItems = [];
names.forEach(item => {
const card = document.querySelector(`.vote-card[data-name="${item.name}"]`);
const rankItem = document.querySelector(`.rank-item[data-name="${item.name}"]`);
if (card) cards.push(card);
if (rankItem) rankItems.push(rankItem);
});
// 滚动到第一个卡片
if (cards.length > 0) {
cards[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
}
// 添加高亮效果
cards.forEach(card => card.classList.add('highlighted'));
rankItems.forEach(item => item.classList.add('highlighted'));
// 1 秒后移除高亮
setTimeout(() => {
cards.forEach(card => card.classList.remove('highlighted'));
rankItems.forEach(item => item.classList.remove('highlighted'));
}, 1500);
}
// 打开字母查找弹窗
function openLetterSearch() {
updateLetterGrid();
letterSearchModal.classList.add('show');
}
// 关闭字母查找弹窗
function closeLetterSearch() {
letterSearchModal.classList.add('hiding');
setTimeout(() => {
letterSearchModal.classList.remove('show');
letterSearchModal.classList.remove('hiding');
}, 300);
}