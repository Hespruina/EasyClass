// EasyCounter账户系统集成
let isLoggedIn = false;
let currentUser = null;

// 获取API基础路径
function getEasyCoreApiPath() {
    const pathname = window.location.pathname;
    const lastSlash = pathname.lastIndexOf('/');
    return pathname.substring(0, lastSlash + 1) + '../easycore/';
}

// 获取用户信息
async function fetchUserInfo() {
    const accountLoading = document.getElementById('accountLoading');
    const accountLoggedIn = document.getElementById('accountLoggedIn');
    const accountLoggedOut = document.getElementById('accountLoggedOut');
    const cloudListSection = document.getElementById('cloudListSection');
    
    if (accountLoading) accountLoading.classList.remove('hidden');
    if (accountLoggedIn) accountLoggedIn.classList.add('hidden');
    if (accountLoggedOut) accountLoggedOut.classList.add('hidden');
    if (cloudListSection) cloudListSection.classList.add('hidden');
    
    try {
        const response = await fetch(getEasyCoreApiPath() + 'api/user/info', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.user) {
                isLoggedIn = true;
                currentUser = data.user;
                updateAccountUI();
                fetchAndRenderCloudLists();
            } else {
                isLoggedIn = false;
                currentUser = null;
                updateAccountUI();
            }
        } else {
            isLoggedIn = false;
            currentUser = null;
            updateAccountUI();
        }
    } catch (error) {
        console.error('获取用户信息失败:', error);
        isLoggedIn = false;
        currentUser = null;
        updateAccountUI();
    }
}

// 更新账户UI
function updateAccountUI() {
    const accountLoading = document.getElementById('accountLoading');
    const accountLoggedIn = document.getElementById('accountLoggedIn');
    const accountLoggedOut = document.getElementById('accountLoggedOut');
    const accountAvatar = document.getElementById('accountAvatar');
    const accountName = document.getElementById('accountName');
    const accountEmail = document.getElementById('accountEmail');
    const saveCloudNamesBtn = document.getElementById('saveCloudNamesBtn');
    
    if (accountLoading) accountLoading.classList.add('hidden');
    
    if (isLoggedIn && currentUser) {
        if (accountLoggedIn) accountLoggedIn.classList.remove('hidden');
        if (accountLoggedOut) accountLoggedOut.classList.add('hidden');
        if (saveCloudNamesBtn) saveCloudNamesBtn.classList.remove('hidden');
        
        if (accountName) accountName.textContent = currentUser.name || '-';
        if (accountEmail) accountEmail.textContent = currentUser.email || '-';
        
        if (accountAvatar) {
            if (currentUser.avatar_url) {
                accountAvatar.innerHTML = `<img src="${currentUser.avatar_url}" alt="用户头像" onerror="this.style.display='none'; this.parentElement.innerHTML='<svg viewBox=\\'0 0 24 24\\' fill=\\'currentColor\\' width=\\'32\\' height=\\'32\\'><path d=\\'M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z\\'/></svg>';">`;
            } else {
                accountAvatar.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/></svg>`;
            }
        }
    } else {
        if (accountLoggedIn) accountLoggedIn.classList.add('hidden');
        if (accountLoggedOut) accountLoggedOut.classList.remove('hidden');
        if (saveCloudNamesBtn) saveCloudNamesBtn.classList.add('hidden');
    }
}

// 登出
async function handleLogout() {
    try {
        const response = await fetch(getEasyCoreApiPath() + 'api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            isLoggedIn = false;
            currentUser = null;
            updateAccountUI();
            
            const cloudListSection = document.getElementById('cloudListSection');
            if (cloudListSection) cloudListSection.classList.add('hidden');
            
            showCustomAlert('已成功登出', '提示');
        } else {
            showCustomAlert('登出失败，请重试', '错误');
        }
    } catch (error) {
        console.error('登出失败:', error);
        showCustomAlert('登出失败，请重试', '错误');
    }
}

// 登录跳转
function handleLogin() {
    window.location.href = 'https://easyclass.zhrhello.top/easycore/';
}

// 获取云名单列表
async function fetchCloudLists() {
    try {
        const url = getEasyCoreApiPath() + 'api/cloud-lists/list';
        console.log('请求云名单列表:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include'
        });
        
        console.log('云名单列表响应状态:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => '无法读取错误信息');
            console.error('云名单列表请求失败:', response.status, errorText);
            throw new Error('获取云名单失败 (HTTP ' + response.status + ')');
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error('云名单列表响应不是JSON:', contentType);
            throw new Error('服务器返回非JSON数据');
        }
        
        const data = await response.json();
        console.log('云名单列表数据:', data);
        
        if (!data || typeof data !== 'object') {
            throw new Error('数据格式无效');
        }
        
        return data;
    } catch (error) {
        console.error('获取云名单失败:', error);
        return { success: false, error: error.message };
    }
}

// 获取并渲染云名单
async function fetchAndRenderCloudLists() {
    const container = document.getElementById('cloudListContainer');
    const emptyState = document.getElementById('cloudListEmpty');
    const cloudListSection = document.getElementById('cloudListSection');
    
    console.log('fetchAndRenderCloudLists 被调用');
    console.log('container:', container);
    console.log('emptyState:', emptyState);
    console.log('cloudListSection:', cloudListSection);
    
    if (!container || !emptyState || !cloudListSection) {
        console.error('fetchAndRenderCloudLists: 找不到必要的 DOM 元素');
        return;
    }
    
    // 重置 UI 状态
    cloudListSection.classList.remove('hidden');
    emptyState.classList.add('hidden');
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-dim);">加载中...</div>';
    
    try {
        console.log('开始获取云名单列表...');
        const result = await fetchCloudLists();
        console.log('云名单API返回:', result);
        
        // 检查返回结果是否有效
        if (!result) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">加载失败：无返回数据</div>';
            return;
        }
        
        // 如果API明确返回了success: false
        if (result.success === false) {
            const errorMsg = result.error || '加载失败';
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">加载失败：' + escapeHtml(errorMsg) + '</div>';
            return;
        }
        
        // 获取名单列表（兼容不同的返回格式）
        const lists = result.lists || result.data || [];
        console.log('提取的名单列表:', lists);
        
        if (!Array.isArray(lists)) {
            console.error('lists 不是数组:', lists);
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">数据格式错误</div>';
            return;
        }
        
        renderCloudLists(lists);
    } catch (error) {
        console.error('获取并渲染云名单失败:', error);
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">加载异常：' + escapeHtml(error.message) + '</div>';
    }
}

// 渲染云名单列表
function renderCloudLists(lists) {
    const container = document.getElementById('cloudListContainer');
    const emptyState = document.getElementById('cloudListEmpty');
    
    console.log('renderCloudLists 被调用, lists:', lists);
    
    if (!container || !emptyState) {
        console.error('renderCloudLists: 找不到 container 或 emptyState 元素');
        return;
    }
    
    if (!lists || lists.length === 0) {
        console.log('renderCloudLists: 显示空状态');
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    try {
        const html = lists.map(list => `
            <div class="cloud-list-item" data-list-id="${escapeHtml(list.list_id)}">
                <div class="cloud-list-name">${escapeHtml(list.name)}</div>
                <div class="cloud-list-info">
                    <span>${escapeHtml(list.item_count || 0)}人</span>
                </div>
                <button class="cloud-list-select-btn" onclick="selectCloudList('${escapeHtml(list.list_id)}', this)">导入</button>
            </div>
        `).join('');
        
        console.log('renderCloudLists: 生成HTML长度:', html.length);
        console.log('renderCloudLists: 设置innerHTML前 container.innerHTML:', container.innerHTML.substring(0, 50));
        
        container.innerHTML = html;
        
        console.log('renderCloudLists: 设置innerHTML后 container.innerHTML:', container.innerHTML.substring(0, 50));
        console.log('renderCloudLists: container内子元素数量:', container.children.length);
        console.log('renderCloudLists: 成功渲染', lists.length, '个云名单');
    } catch (error) {
        console.error('renderCloudLists 渲染失败:', error);
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">渲染失败：' + escapeHtml(error.message) + '</div>';
    }
}

// HTML转义
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/&/g, '&amp;')
                         .replace(/</g, '&lt;')
                         .replace(/>/g, '&gt;')
                         .replace(/"/g, '&quot;')
                         .replace(/'/g, '&#039;');
}

// 选择云名单并导入
async function selectCloudList(listId, button) {
    console.log('selectCloudList 被调用, listId:', listId, 'button:', button);
    
    if (!listId || !button) {
        console.error('selectCloudList: 缺少 listId 或 button');
        return;
    }
    
    const originalText = button.textContent;
    const originalDisabled = button.disabled;
    button.disabled = true;
    button.textContent = '导入中...';
    
    const listItem = button.closest('.cloud-list-item');
    if (listItem) {
        listItem.classList.add('loading');
    }
    
    console.log('开始导入云名单, listId:', listId);
    
    try {
        const pickUrl = getEasyCoreApiPath() + 'api/cloud-lists/pick?list_id=' + encodeURIComponent(listId);
        console.log('请求pick API:', pickUrl);
        
        const response = await fetch(pickUrl, {
            method: 'GET',
            credentials: 'include'
        });
        
        console.log('pick API响应状态:', response.status);
        
        if (!response.ok) {
            throw new Error('选择名单失败 (HTTP ' + response.status + ')');
        }
        
        const data = await response.json();
        console.log('pick API返回数据:', data);
        
        if (!data.token) {
            throw new Error('未获取到token');
        }
        
        console.log('开始通过token导入, token:', data.token);
        await importCloudListByToken(data.token);
        
        console.log('导入成功，关闭设置面板');
        closeSettings();
    } catch (error) {
        console.error('选择名单失败:', error);
        showCustomAlert('导入失败：' + error.message);
        
        // 恢复按钮状态
        button.disabled = false;
        button.textContent = originalText;
        if (listItem) {
            listItem.classList.remove('loading');
        }
    }
}

// 通过token导入云名单
async function importCloudListByToken(token) {
    try {
        const response = await fetch(getEasyCoreApiPath() + 'api/cloud-lists/get_names?token=' + token, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('获取名单失败');
        }
        
        const data = await response.json();
        
        if (!data.names || !Array.isArray(data.names)) {
            throw new Error('数据格式错误');
        }
        
        if (data.names.length === 0) {
            throw new Error('名单为空');
        }
        
        // 填入名单到输入框
        const nameInputEl = document.getElementById('nameInput');
        if (nameInputEl) {
            nameInputEl.value = data.names.join('\n');
        }
        
        console.log('成功导入云名单，数量:', data.names.length);
        
        // 清除URL中的token
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        showCustomAlert('成功导入 ' + data.names.length + ' 人', '提示');
        
        return true;
    } catch (error) {
        console.error('导入名单失败:', error);
        throw error;
    }
}

// 修改云名单导入函数
function importFromCloudList() {
    if (isLoggedIn) {
        openSettings();
        switchToAccountTab();
        fetchAndRenderCloudLists();
    } else {
        window.location.href = 'https://easyclass.zhrhello.top/easycore/';
    }
}

// 切换到账户标签页
function switchToAccountTab() {
    const tabs = document.querySelectorAll('.settings-tab');
    const tabContents = document.querySelectorAll('.settings-tab-content');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    const accountTab = document.querySelector('[data-tab="account"]');
    const accountContent = document.getElementById('accountTab');
    
    if (accountTab) accountTab.classList.add('active');
    if (accountContent) accountContent.classList.add('active');
}

// 初始化标签页切换
function initTabs() {
    const tabs = document.querySelectorAll('.settings-tab');
    const tabContents = document.querySelectorAll('.settings-tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            this.classList.add('active');
            const targetContent = document.getElementById(tabName + 'Tab');
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

// 初始化账户系统集成
function initAccountSystem() {
    initTabs();
    
    const accountLoginBtn = document.getElementById('accountLoginBtn');
    const accountLogoutBtn = document.getElementById('accountLogoutBtn');
    
    if (accountLoginBtn) {
        accountLoginBtn.addEventListener('click', handleLogin);
    }
    
    if (accountLogoutBtn) {
        accountLogoutBtn.addEventListener('click', handleLogout);
    }
    
    // 页面加载时获取用户信息
    fetchUserInfo();
}

// 在页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccountSystem);
} else {
    initAccountSystem();
}
