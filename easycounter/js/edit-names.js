// 渲染编辑名单的卡片
function renderEditNameCards() {
const names = getCurrentEditNames();
editNamesCardsContainer.innerHTML = '';

// 添加现有名字的卡片
names.forEach((name, index) => {
const card = createEditNameCard(name, index);
editNamesCardsContainer.appendChild(card);
});

// 添加"添加名字"的占位卡片（如果需要）
// 这里不需要，因为添加按钮在左下角
}

// 创建名字卡片
function createEditNameCard(name, index) {
const card = document.createElement('div');
card.className = 'edit-name-card';
card.dataset.index = index;
card.dataset.name = name;

const nameDisplay = document.createElement('div');
nameDisplay.className = 'edit-name-display';
nameDisplay.textContent = name;

// 按钮容器
const actionsDiv = document.createElement('div');
actionsDiv.className = 'edit-name-actions';

// 编辑按钮
const editBtn = document.createElement('button');
editBtn.className = 'edit-name-edit-btn';
editBtn.innerHTML = `
<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
`;
editBtn.title = '编辑此名字';
editBtn.addEventListener('click', (e) => {
e.stopPropagation();
handleEditName(card, nameDisplay);
});

// 删除按钮
const deleteBtn = document.createElement('button');
deleteBtn.className = 'edit-name-delete-btn';
deleteBtn.innerHTML = `
<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
`;
deleteBtn.title = '删除此名字';
deleteBtn.addEventListener('click', (e) => {
e.stopPropagation();
handleDeleteName(card);
});

actionsDiv.appendChild(editBtn);
actionsDiv.appendChild(deleteBtn);
card.appendChild(nameDisplay);
card.appendChild(actionsDiv);

// 卡片点击事件（用于多选）
card.addEventListener('click', (e) => {
// 如果点击的是按钮，不触发选择
if (e.target.closest('button')) return;
toggleCardSelection(card);
});

return card;
}

// 创建输入名字的卡片
function createNameInputCard() {
const card = document.createElement('div');
card.className = 'edit-name-card';
card.dataset.isInput = 'true';

const input = document.createElement('textarea');
input.className = 'edit-name-card-input';
input.placeholder = '输入姓名...';
input.autofocus = true;

const actions = document.createElement('div');
actions.className = 'edit-name-input-actions';

const confirmBtn = document.createElement('button');
confirmBtn.className = 'edit-name-confirm-btn';
confirmBtn.textContent = '确认';

const cancelBtn = document.createElement('button');
cancelBtn.className = 'edit-name-cancel-btn';
cancelBtn.textContent = '取消';

actions.appendChild(confirmBtn);
actions.appendChild(cancelBtn);
card.appendChild(input);
card.appendChild(actions);

// 事件监听
input.addEventListener('keydown', (e) => {
if (e.key === 'Enter') {
e.preventDefault();
handleAddNameConfirm(input.value);
}
});

confirmBtn.addEventListener('click', () => {
handleAddNameConfirm(input.value);
});

cancelBtn.addEventListener('click', () => {
handleAddNameCancel(card);
});

// 自动聚焦
setTimeout(() => input.focus(), 10);

return card;
}

// 处理添加名字确认
function handleAddNameConfirm(value) {
const name = value.trim();
if (!name) {
showCustomAlert('请输入有效的姓名');
return;
}

// 检查是否重复
const currentNames = getCurrentEditNames();
if (currentNames.includes(name)) {
showCustomAlert('该姓名已存在');
return;
}

// 先移除输入卡片
const inputCard = editNamesCardsContainer.querySelector('.edit-name-card[data-is-input="true"]');
if (inputCard && inputCard.parentNode) {
inputCard.parentNode.removeChild(inputCard);
}

// 创建新的名字卡片
const newCard = createEditNameCard(name, currentNames.length);
editNamesCardsContainer.appendChild(newCard);
}

// 处理添加名字取消
function handleAddNameCancel(card) {
if (card && card.parentNode) {
card.parentNode.removeChild(card);
}
}

// 处理编辑名字
function handleEditName(card, nameDisplay) {
const oldName = nameDisplay.textContent;

// 创建输入框
const input = document.createElement('textarea');
input.className = 'edit-name-card-input';
input.style.height = '40px';
input.style.marginBottom = '8px';
input.value = oldName;

// 替换显示为输入框
nameDisplay.style.display = 'none';
card.insertBefore(input, card.querySelector('.edit-name-actions'));
input.focus();

// 保存编辑
function saveEdit() {
const newName = input.value.trim();
if (!newName) {
showCustomAlert('请输入有效的姓名');
input.focus();
return;
}

// 检查是否重复
const currentNames = getCurrentEditNames();
if (currentNames.includes(newName) && newName !== oldName) {
showCustomAlert('该姓名已存在');
input.focus();
return;
}

// 更新名字显示
nameDisplay.textContent = newName;
nameDisplay.style.display = '';
card.removeChild(input);
}

// 监听事件
input.addEventListener('keydown', (e) => {
if (e.key === 'Enter') {
e.preventDefault();
saveEdit();
} else if (e.key === 'Escape') {
// 取消编辑
nameDisplay.style.display = '';
card.removeChild(input);
}
});

// 失去焦点时保存
input.addEventListener('blur', () => {
if (card.contains(input)) {
saveEdit();
}
});
}

// 处理删除名字
function handleDeleteName(card) {
// 直接从 DOM 中删除卡片
if (card && card.parentNode) {
card.parentNode.removeChild(card);
}
}

// 获取当前编辑的名字列表
function getCurrentEditNames() {
const cards = editNamesCardsContainer.querySelectorAll('.edit-name-card:not([data-is-input])');
const names = [];
cards.forEach(card => {
const nameDisplay = card.querySelector('.edit-name-display');
if (nameDisplay) {
names.push(nameDisplay.textContent);
}
});
return names;
}

// 多选模式状态
let batchSelectMode = false;
let selectedCards = new Set();

// 打开编辑名单弹窗
function openEditNamesModal() {
// 初始化时将 appState 中的名字加载到卡片容器
editNamesCardsContainer.innerHTML = '';
appState.namesData.forEach((item, index) => {
const card = createEditNameCard(item.name, index);
editNamesCardsContainer.appendChild(card);
});
// 重置多选模式
batchSelectMode = false;
selectedCards.clear();
updateBatchModeUI();
editNamesModal.classList.add('show');
}

// 关闭编辑名单弹窗
function closeEditNamesModal() {
const panel = editNamesModal.querySelector('.edit-names-panel');
panel.style.animation = 'slideOut 0.3s ease-out forwards';
editNamesModal.classList.add('hiding');
setTimeout(() => {
editNamesModal.classList.remove('show');
editNamesModal.classList.remove('hiding');
panel.style.animation = '';
}, 300);
}

// 计算名单更改内容
function calculateNameChanges(newNames) {
const oldNames = appState.namesData.map(item => item.name);
const oldSet = new Set(oldNames);
const newSet = new Set(newNames);

const removed = [];
const added = [];

// 找出被删除的名字
oldNames.forEach(name => {
if (!newSet.has(name)) {
removed.push(name);
}
});

// 找出新增的名字
newNames.forEach(name => {
if (!oldSet.has(name)) {
added.push(name);
}
});

return { removed, added };
}

// 生成更改标签的 HTML
function generateChangeTagsHTML(removed, added) {
let html = '<div class="name-change-tags">';

// 删除的标签
removed.forEach(name => {
html += `<div class="name-change-tag remove">
<span class="icon">[-]</span>
<span class="name">${escapeHtml(name)}</span>
</div>`;
});

// 新增的标签
added.forEach(name => {
html += `<div class="name-change-tag add">
<span class="icon">[+]</span>
<span class="name">${escapeHtml(name)}</span>
</div>`;
});

html += '</div>';
return html;
}

// 获取当前登录状态（从account.js全局变量获取）
function getEasyCoreApiPath() {
    const pathname = window.location.pathname;
    const lastSlash = pathname.lastIndexOf('/');
    return pathname.substring(0, lastSlash + 1) + '../easycore/';
}

// 打开保存云名单弹窗
function openSaveCloudNamesModal() {
    if (typeof isLoggedIn === 'undefined' || !isLoggedIn) {
        showCustomAlert('请先登录', '提示');
        return;
    }
    
    saveCloudSaveMode = null;
    saveCloudSelectedListId = null;
    
    document.getElementById('newListInputArea').style.display = 'none';
    document.getElementById('existingListSelectArea').style.display = 'none';
    document.getElementById('newListNameInput').value = '';
    document.getElementById('confirmSaveCloudBtn').disabled = true;
    
    // 重置选项样式
    const createNewListOption = document.getElementById('createNewListOption');
    const overwriteListOption = document.getElementById('overwriteListOption');
    createNewListOption.classList.remove('selected');
    overwriteListOption.classList.remove('selected');
    
    const modal = document.getElementById('saveCloudNamesModal');
    modal.classList.add('show');
}

// 关闭保存云名单弹窗
function closeSaveCloudNamesModal() {
    const modal = document.getElementById('saveCloudNamesModal');
    const promptPanel = modal.querySelector('.prompt-panel');
    promptPanel.style.animation = 'slideOut 0.3s ease-out forwards';
    modal.classList.add('hiding');
    setTimeout(() => {
        modal.classList.remove('show');
        modal.classList.remove('hiding');
        promptPanel.style.animation = '';
    }, 300);
}

let saveCloudSaveMode = null;
let saveCloudSelectedListId = null;

// 选择新建名单
function handleSelectNewListMode() {
    saveCloudSaveMode = 'new';
    saveCloudSelectedListId = null;
    
    document.getElementById('createNewListOption').classList.add('selected');
    document.getElementById('overwriteListOption').classList.remove('selected');
    
    document.getElementById('newListInputArea').style.display = 'block';
    document.getElementById('existingListSelectArea').style.display = 'none';
    document.getElementById('newListNameInput').focus();
    
    updateSaveCloudConfirmButton();
}

// 选择覆盖现有名单
function handleSelectOverwriteMode() {
    saveCloudSaveMode = 'overwrite';
    
    document.getElementById('overwriteListOption').classList.add('selected');
    document.getElementById('createNewListOption').classList.remove('selected');
    
    document.getElementById('newListInputArea').style.display = 'none';
    document.getElementById('existingListSelectArea').style.display = 'block';
    
    fetchExistingListsForOverwrite();
}

// 获取现有名单列表
async function fetchExistingListsForOverwrite() {
    const container = document.getElementById('existingListContainer');
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-dim);">加载中...</div>';
    
    try {
        const response = await fetch(getEasyCoreApiPath() + 'api/cloud-lists/list', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('获取名单失败');
        }
        
        const data = await response.json();
        const lists = data.lists || [];
        
        if (lists.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-dim);">暂无云名单</div>';
            return;
        }
        
        container.innerHTML = lists.map(list => `
            <div class="save-cloud-list-item" data-list-id="${escapeHtml(list.list_id)}" onclick="selectExistingList('${escapeHtml(list.list_id)}', this)">
                <div class="save-cloud-list-name">${escapeHtml(list.name)}</div>
                <div class="save-cloud-list-info">${escapeHtml(list.item_count || 0)}人</div>
            </div>
        `).join('');
        
    } catch (error) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);">加载失败：' + escapeHtml(error.message) + '</div>';
    }
}

// 选择现有名单
function selectExistingList(listId, element) {
    saveCloudSelectedListId = listId;
    
    document.querySelectorAll('.save-cloud-list-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    element.classList.add('selected');
    
    updateSaveCloudConfirmButton();
}

// 更新保存按钮状态
function updateSaveCloudConfirmButton() {
    const confirmBtn = document.getElementById('confirmSaveCloudBtn');
    
    if (saveCloudSaveMode === 'new') {
        const listName = document.getElementById('newListNameInput').value.trim();
        confirmBtn.disabled = !listName;
    } else if (saveCloudSaveMode === 'overwrite') {
        confirmBtn.disabled = !saveCloudSelectedListId;
    } else {
        confirmBtn.disabled = true;
    }
}

// 确认保存云名单
async function handleConfirmSaveCloud() {
    const names = getCurrentEditNames();
    
    if (names.length === 0) {
        showCustomAlert('名单为空，无法保存', '提示');
        return;
    }
    
    const confirmBtn = document.getElementById('confirmSaveCloudBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '保存中...';
    
    try {
        let listId;
        
        if (saveCloudSaveMode === 'new') {
            const listName = document.getElementById('newListNameInput').value.trim();
            
            if (!listName) {
                showCustomAlert('请输入名单名称', '提示');
                confirmBtn.disabled = false;
                confirmBtn.textContent = '保存';
                return;
            }
            
            const createResponse = await fetch(getEasyCoreApiPath() + 'api/lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: listName })
            });
            
            if (!createResponse.ok) {
                const errorData = await createResponse.json();
                throw new Error(errorData.error || '创建名单失败');
            }
            
            const createData = await createResponse.json();
            listId = createData.list.id;
            
        } else if (saveCloudSaveMode === 'overwrite') {
            if (!saveCloudSelectedListId) {
                showCustomAlert('请选择要覆盖的名单', '提示');
                confirmBtn.disabled = false;
                confirmBtn.textContent = '保存';
                return;
            }
            
            listId = saveCloudSelectedListId;
        }
        
        const items = names.map(name => ({ name: name }));
        
        const saveResponse = await fetch(getEasyCoreApiPath() + `api/lists/${listId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ items: items })
        });
        
        if (!saveResponse.ok) {
            const errorData = await saveResponse.json();
            throw new Error(errorData.error || '保存名单失败');
        }
        
        closeSaveCloudNamesModal();
        showCustomAlert('保存成功！共 ' + names.length + ' 人', '提示');
        
    } catch (error) {
        console.error('保存云名单失败:', error);
        showCustomAlert('保存失败：' + error.message, '错误');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '保存';
    }
}

// HTML 转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 取消多选模式

// 保存编辑后的名单
async function saveEditedNames() {
const newNames = getCurrentEditNames();
if (newNames.length === 0) {
showCustomAlert('请输入至少一个有效的姓名');
return;
}

// 计算更改内容
const changes = calculateNameChanges(newNames);

// 如果没有更改，提示用户
if (changes.removed.length === 0 && changes.added.length === 0) {
showCustomAlert('名单没有变化，无需保存');
return;
}

// 生成更改标签 HTML
const changesHTML = generateChangeTagsHTML(changes.removed, changes.added);

// 显示确认弹窗，包含更改内容
const confirmMessage = `修改名单将重置所有票数，是否继续？<br/>
<div style="font-size: 13px; color: #888; margin: 10px 0;">共 ${changes.removed.length + changes.added.length} 处更改：</div>
${changesHTML}`;

showCustomConfirm(confirmMessage, async (confirmed) => {
if (!confirmed) {
return;
}
try {
const apiPath = 'https://easyclass.zhrhello.top/easycore/api/pinyin';
const response = await fetch(apiPath, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ names: newNames })
});
if (!response.ok) {
throw new Error('服务器处理失败');
}
const data = await response.json();
appState.namesData = data.sortedNames;
appState.groupedByLetter = data.groupedByLetter;
appState.availableLetters = data.availableLetters;
// 重置投票数据
appState.votes = {};
appState.namesData.forEach(item => {
appState.votes[item.name] = 0;
});
appState.totalVotes = 0;
// 更新界面
updateLetterGrid();
updateQuickSearchGrid();
renderGrid();
updateRankList(true);
updateTotal();
closeEditNamesModal();
} catch (error) {
showCustomAlert('保存失败：' + error.message);
}
});
}

// 添加名字
function handleAddName() {
// 检查是否已经有输入卡片
const existingInput = editNamesCardsContainer.querySelector('.edit-name-card[data-is-input="true"]');
if (existingInput) {
existingInput.querySelector('.edit-name-card-input').focus();
return;
}

const inputCard = createNameInputCard();
editNamesCardsContainer.appendChild(inputCard);

// 滚动到底部
editNamesCardsContainer.scrollTop = editNamesCardsContainer.scrollHeight;
}

// 切换多选模式
function toggleBatchSelectMode() {
batchSelectMode = !batchSelectMode;
updateBatchModeUI();
}

// 更新多选模式 UI
function updateBatchModeUI() {
if (batchSelectMode) {
batchOperations.style.display = 'flex';
singleOperations.style.display = 'none';
batchSelectBtn.style.background = 'rgba(255, 215, 0, 0.2)';
batchSelectBtn.style.borderColor = 'rgba(255, 215, 0, 0.6)';
} else {
batchOperations.style.display = 'none';
singleOperations.style.display = 'flex';
batchSelectBtn.style.background = '';
batchSelectBtn.style.borderColor = '';
// 清除所有选中状态
selectedCards.forEach(card => {
card.classList.remove('selected');
});
selectedCards.clear();
}
}

// 切换卡片选中状态
function toggleCardSelection(card) {
if (!batchSelectMode) return;

if (selectedCards.has(card)) {
selectedCards.delete(card);
card.classList.remove('selected');
} else {
selectedCards.add(card);
card.classList.add('selected');
}

// 更新批量删除按钮状态
updateBatchDeleteButton();
}

// 更新批量删除按钮状态
function updateBatchDeleteButton() {
const count = selectedCards.size;
batchDeleteBtn.querySelector('span').textContent = `批量删除 (${count})`;
batchDeleteBtn.disabled = count === 0;
batchDeleteBtn.style.opacity = count === 0 ? '0.5' : '1';
}

// 批量删除选中的卡片
function batchDeleteSelected() {
if (selectedCards.size === 0) {
showCustomAlert('请先选择要删除的名字');
return;
}

const count = selectedCards.size;
showCustomConfirm(`确定要删除选中的 ${count} 个名字吗？`, (confirmed) => {
if (confirmed) {
selectedCards.forEach(card => {
if (card && card.parentNode) {
card.parentNode.removeChild(card);
}
});
selectedCards.clear();
updateBatchDeleteButton();
}
});
}

// 取消多选模式
function cancelBatchMode() {
batchSelectMode = false;
updateBatchModeUI();
}

// 清空所有名单
function clearAllNames() {
const count = getCurrentEditNames().length;
if (count === 0) {
showCustomAlert('名单已经为空');
return;
}

showCustomConfirm(`确定要清空所有 ${count} 个名字吗？此操作不可恢复。`, (confirmed) => {
if (confirmed) {
editNamesCardsContainer.innerHTML = '';
selectedCards.clear();
updateBatchDeleteButton();
}
});
}

// 打开批量添加名字弹窗
function openBatchAddNamesModal() {
batchAddNamesInput.value = '';
batchAddNamesModal.classList.add('show');
setTimeout(() => batchAddNamesInput.focus(), 100);
}

// 关闭批量添加名字弹窗
function closeBatchAddNamesModal() {
const panel = batchAddNamesModal.querySelector('.prompt-panel');
panel.style.animation = 'slideOut 0.3s ease-out forwards';
batchAddNamesModal.classList.add('hiding');
setTimeout(() => {
batchAddNamesModal.classList.remove('show');
batchAddNamesModal.classList.remove('hiding');
panel.style.animation = '';
}, 300);
}

// 批量添加名字
function batchAddNames() {
const text = batchAddNamesInput.value.trim();
if (!text) {
showCustomAlert('请输入至少一个名字');
return;
}

const names = text.split('\n').map(n => n.trim()).filter(n => n);
if (names.length === 0) {
showCustomAlert('请输入至少一个有效的名字');
return;
}

// 获取当前已有的名字
const currentNames = getCurrentEditNames();
const currentNamesSet = new Set(currentNames);

// 过滤掉重复的名字
const newNames = [];
const duplicates = [];
names.forEach(name => {
if (currentNamesSet.has(name)) {
duplicates.push(name);
} else {
newNames.push(name);
currentNamesSet.add(name);
}
});

// 如果有重复，提示用户
if (duplicates.length > 0) {
showCustomAlert(`以下名字已存在，已自动跳过：\n${duplicates.join('\n')}`);
}

// 添加新名字到列表
newNames.forEach(name => {
const card = createEditNameCard(name, currentNames.length);
editNamesCardsContainer.appendChild(card);
});

closeBatchAddNamesModal();
showCustomAlert(`成功添加 ${newNames.length} 个名字`);
}