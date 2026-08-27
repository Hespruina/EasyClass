let shifouzaiyunxing = false;
let dingshiqiID;
let yuanchengma;
let xingming = [];
let dangqianshixian = 0;
let paichuleibiao = [];
let availableNamesCache = []; // 可用名单缓存（已排除保护池），点名定时器只从此数组取值
let protectionPoolSize = 5;
let isNamesLoaded = false;  // 标记是否已从手机端获取名单
let localStorageEnabled = true; // 本地保存数据开关状态
let isLoggedIn = false; // 用户登录状态
let isGuest = false;    // 是否游客账号
let currentUser = null; // 当前用户信息 {user_id, name, email, avatar_url}
let broadcastEnabled = false;          // 自定义播报消息开关
let broadcastPrefixes = [];            // 播报可用前缀文本列表（含 {name} 占位符）
let isBroadcastOverlayVisible = false; // 点名播报遮罩显示状态

// 名单限制（与云端 EasyCore 保持一致）
const MAX_NAMES_COUNT = 1000; // 名单人数上限
const MIN_NAME_LENGTH = 1;    // 单个名字最少字数
const MAX_NAME_LENGTH = 5;    // 单个名字最多字数

// 校验单个名字长度是否符合要求（按 Unicode 字符数计算）
function isValidNameLength(name) {
    const len = [...name].length;
    return len >= MIN_NAME_LENGTH && len <= MAX_NAME_LENGTH;
}

// WebSocket连接相关变量
let socket;
let savedCode = ''; // 保存的code，用于重连
let isConnecting = false; // 防止重复连接的标志
let reconnectTimer = null; // 重连定时器
let codeTimeoutTimer = null; // 获取code超时定时器
let reconnectFailCount = 0; // 重连失败计数器
const MAX_RECONNECT_FAILS = 3; // 最大重连失败次数，超过则判定code过期
const CODE_TIMEOUT = 3300; // 3.3秒超时时间
let isCodeRefreshing = false; // 防止重复点击刷新

// 构造原生 WebSocket URL（支持查询参数）
function getWsUrl(params = {}) {
    const basePath = getApiBasePath();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let url = protocol + '//' + window.location.host + basePath + 'api/randamer/ws';
    const query = new URLSearchParams(params).toString();
    if (query) url += '?' + query;
    return url;
}

// 安全发送 JSON 消息（内部检查连接状态）
function wsSend(data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
        return true;
    }
    return false;
}

// 安全关闭 WebSocket（先清除回调再关闭，避免触发重连）
function wsSafeClose() {
    if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        try { socket.close(); } catch(e) {}
        socket = null;
    }
}

// 处理待处理的 token 请求
function handlePendingToken() {
    if (window.pendingToken) {
        console.log('处理待处理的 token 请求:', window.pendingToken);
        requestNamesFromEasyCore(window.pendingToken);
        window.pendingToken = null;
    }
}

// 遥控码刷新动画函数

// 通用弹窗函数
function showCustomAlert(message, title = '提示') {
    const modal = document.getElementById('customAlertModal');
    const titleEl = document.getElementById('customAlertTitle');
    const textEl = document.getElementById('customAlertText');
    
    titleEl.textContent = title;
    textEl.textContent = message;
    modal.classList.add('show');
}

function closeCustomAlert() {
    const modal = document.getElementById('customAlertModal');
    const promptPanel = modal.querySelector('.prompt-panel');
    
    promptPanel.style.animation = 'slideOut 0.3s ease-out forwards';
    modal.classList.add('hiding');
    setTimeout(() => {
        modal.classList.remove('show');
        modal.classList.remove('hiding');
        promptPanel.style.animation = '';
    }, 300);
}

// 通用确认弹窗函数
let customConfirmCallback = null;

function showCustomConfirm(message, callback, title = '确认') {
    const modal = document.getElementById('customConfirmModal');
    const titleEl = document.getElementById('customConfirmTitle');
    const textEl = document.getElementById('customConfirmText');
    
    titleEl.textContent = title;
    textEl.innerHTML = message;
    customConfirmCallback = callback;
    modal.classList.add('show');
}

function closeCustomConfirm() {
    const modal = document.getElementById('customConfirmModal');
    const promptPanel = modal.querySelector('.prompt-panel');
    
    promptPanel.style.animation = 'slideOut 0.3s ease-out forwards';
    modal.classList.add('hiding');
    setTimeout(() => {
        modal.classList.remove('show');
        modal.classList.remove('hiding');
        promptPanel.style.animation = '';
    }, 300);
}

function handleCustomConfirmOk() {
    closeCustomConfirm();
    if (customConfirmCallback) {
        customConfirmCallback(true);
        customConfirmCallback = null;
    }
}

function handleCustomConfirmCancel() {
    closeCustomConfirm();
    if (customConfirmCallback) {
        customConfirmCallback(false);
        customConfirmCallback = null;
    }
}

// 检查本地保存开关状态
function checkLocalStorageEnabled() {
    const saved = localStorage.getItem('localStorageEnabled');
    if (saved === null) {
        // 首次访问，默认开启
        localStorageEnabled = true;
        localStorage.setItem('localStorageEnabled', 'true');
    } else {
        localStorageEnabled = saved === 'true';
    }
    return localStorageEnabled;
}

// 保存数据到本地存储
function saveToLocalStorage() {
    if (!localStorageEnabled) {
        // 如果关闭本地保存，只保存开关状态为false
        localStorage.setItem('localStorageEnabled', 'false');
        // 清除其他数据
        localStorage.removeItem('xingming');
        localStorage.removeItem('protectionPoolSize');
        localStorage.removeItem('isNamesLoaded');
        localStorage.removeItem('customBroadcastEnabled');
        return;
    }
    // 开启状态下保存所有数据
    localStorage.setItem('localStorageEnabled', 'true');
    localStorage.setItem('xingming', JSON.stringify(xingming));
    localStorage.setItem('protectionPoolSize', protectionPoolSize.toString());
    localStorage.setItem('isNamesLoaded', isNamesLoaded.toString());
}

// 从本地存储加载数据
function loadFromLocalStorage() {
    // 先检查开关状态
    const enabled = localStorage.getItem('localStorageEnabled');
    if (enabled === 'false') {
        localStorageEnabled = false;
        return false; // 表示没有加载数据
    }
    
    localStorageEnabled = true;
    
    const savedXingming = localStorage.getItem('xingming');
    const savedPoolSize = localStorage.getItem('protectionPoolSize');
    const savedIsNamesLoaded = localStorage.getItem('isNamesLoaded');
    
    let hasData = false;
    
    if (savedXingming) {
        try {
            xingming = JSON.parse(savedXingming);
            hasData = true;
        } catch (e) {
            console.error('解析保存的名单失败:', e);
        }
    }
    
    if (savedPoolSize) {
        protectionPoolSize = parseInt(savedPoolSize, 10);
        hasData = true;
    }
    
    if (savedIsNamesLoaded === 'true') {
        isNamesLoaded = true;
        hasData = true;
    }
    
    return hasData;
}

// 更新防重复保护池显示
function updateProtectionPoolDisplay() {
    const protectionPoolList = document.getElementById('protectionPoolList');
    const protectionPoolCount = document.getElementById('protectionPoolCount');
    const protectionPoolPanel = document.getElementById('protectionPoolPanel');

    if (!protectionPoolList || !protectionPoolCount || !protectionPoolPanel) return;

    const currentItems = Array.from(protectionPoolList.querySelectorAll('.protection-pool-item'));

    // 计算面板的目标高度
    const calculatePanelHeight = (itemCount) => {
        const panelPadding = 40;      // 上下padding 20+20
        const headerHeight = 46;      // 标题高度 (约36px) + margin-bottom 15 - 重叠部分
        const countHeight = 26;       // 计数区域高度 (约16px) + margin-top 10
        const itemHeight = 42;        // 列表项实际高度 (padding 10+10 + 内容约22)
        const gapHeight = 8;          // 列表项间距
        const emptyStateHeight = 58;  // 空状态提示高度 (padding 20+20 + 内容约18)

        if (itemCount === 0) {
            return panelPadding + headerHeight + emptyStateHeight + countHeight;
        }

        const listHeight = itemCount * itemHeight + (itemCount - 1) * gapHeight;
        const maxListHeight = 300;
        const actualListHeight = Math.min(listHeight, maxListHeight);
        return panelPadding + headerHeight + actualListHeight + countHeight;
    };

    if (paichuleibiao.length === 0) {
        if (currentItems.length > 0) {
            currentItems.forEach(item => {
                item.style.opacity = '0';
                item.style.transform = 'translateX(-10px)';
            });
            setTimeout(() => {
                protectionPoolList.innerHTML = '<div class="protection-pool-empty">暂无已点名单</div>';
                protectionPoolList.style.maxHeight = '50px';
                // 更新面板高度
                protectionPoolPanel.style.height = `${calculatePanelHeight(0)}px`;
            }, 300);
        } else {
            protectionPoolList.innerHTML = '<div class="protection-pool-empty">暂无已点名单</div>';
            protectionPoolList.style.maxHeight = '50px';
            // 更新面板高度
            protectionPoolPanel.style.height = `${calculatePanelHeight(0)}px`;
        }
    } else {
        const emptyDiv = protectionPoolList.querySelector('.protection-pool-empty');
        if (emptyDiv) {
            emptyDiv.remove();
        }

        // 获取当前DOM中的名字列表
        const currentNames = currentItems.map(item => item.textContent);

        // 找出需要移除的名字（不在新列表中的）
        const namesToRemove = currentNames.filter(name => !paichuleibiao.includes(name));

        // 找出需要添加的名字（不在当前DOM中的）
        const namesToAdd = paichuleibiao.filter(name => !currentNames.includes(name));

        // 同时进行移除和添加动画

        // 移除旧元素（带动画）
        currentItems.forEach(item => {
            if (namesToRemove.includes(item.textContent)) {
                item.style.opacity = '0';
                item.style.transform = 'translateX(-10px)';
                setTimeout(() => {
                    item.remove();
                }, 300);
            }
        });

        // 立即添加新元素（同时进行动画）
        namesToAdd.forEach((name) => {
            const item = document.createElement('div');
            item.className = 'protection-pool-item';
            item.textContent = name;
            item.style.opacity = '0';
            item.style.transform = 'translateX(-10px)';
            protectionPoolList.appendChild(item);

            // 强制重排后添加动画
            item.offsetHeight;
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
        });

        const itemHeight = 42;
        const gapHeight = 8;
        const totalHeight = paichuleibiao.length * itemHeight + (paichuleibiao.length - 1) * gapHeight;
        const maxHeight = Math.min(totalHeight, 300);

        protectionPoolList.style.transition = 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        protectionPoolList.style.maxHeight = `${maxHeight}px`;

        // 更新面板高度
        protectionPoolPanel.style.height = `${calculatePanelHeight(paichuleibiao.length)}px`;

        // 滚动到底部
        setTimeout(() => {
            protectionPoolList.scrollTop = protectionPoolList.scrollHeight;
        }, 50);
    }

    protectionPoolCount.textContent = `${paichuleibiao.length} / ${protectionPoolSize}`;
}

// 更新按钮状态（未获取名单时禁用）
function updateButtonState() {
    const kaishianniu = document.getElementById('kaishianniu');
    const tingzhianniu = document.getElementById('tingzhianniu');
    const xingmingxianshi = document.getElementById('xingmingxianshi');
    const erweimaContainer = document.querySelector('.erweimacontaner');
    const inputNameListBtn = document.getElementById('inputNameListBtn');

    if (!isNamesLoaded) {
        // 未获取名单，禁用按钮
        if (kaishianniu) {
            kaishianniu.disabled = true;
            kaishianniu.textContent = '请扫码上传名单';
            kaishianniu.style.opacity = '0.6';
            kaishianniu.style.cursor = 'not-allowed';
        }
        if (tingzhianniu) {
            tingzhianniu.disabled = true;
        }
        if (xingmingxianshi) {
            xingmingxianshi.textContent = '等待名单上传...';
        }
        // 添加二维码水波纹效果
        if (erweimaContainer) {
            erweimaContainer.classList.add('ripple-effect');
        }
        // 为名单编辑按钮添加水波纹效果
        if (inputNameListBtn) {
            inputNameListBtn.classList.add('ripple-effect');
        }
    } else {
        // 已获取名单，启用按钮
        if (kaishianniu) {
            kaishianniu.disabled = false;
            kaishianniu.textContent = '开始';
            kaishianniu.style.opacity = '1';
            kaishianniu.style.cursor = 'pointer';
        }
        if (tingzhianniu) {
            tingzhianniu.disabled = false;
        }
        // 移除二维码水波纹效果
        if (erweimaContainer) {
            erweimaContainer.classList.remove('ripple-effect');
        }
        // 移除名单编辑按钮水波纹效果
        if (inputNameListBtn) {
            inputNameListBtn.classList.remove('ripple-effect');
        }
        // 隐藏气泡提示框
        hideTooltips();
    }
}

// 隐藏所有气泡提示框
function hideTooltips() {
    const tooltips = document.querySelectorAll('.tooltip-bubble');
    tooltips.forEach(tooltip => {
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
    });
}

// 从 names.txt 文件中读取姓名（已禁用，等待手机端上传）
async function duquXingming() {
    // 不再从文件读取，等待手机端上传名单
    console.log('等待手机端上传名单...');
    updateButtonState();
}

// 从手机端接收名单
function setNamesFromPhone(names) {
    if (names && names.length > 0) {
        xingming = names;
        isNamesLoaded = true;
        console.log('从手机端接收名单:', xingming);

        // 保存到本地存储
        saveToLocalStorage();

        // 更新滑块的最大值为总人数
        updateSliderMax();

        // 名单已更新，重新缓存可用名单（点名运行中也能立即生效）
        rebuildAvailableNamesCache();

        // 更新显示
        const xingmingxianshi = document.getElementById('xingmingxianshi');
        if (xingmingxianshi && xingming.length > 0) {
            xingmingxianshi.textContent = '名单已就绪';
        }

        // 更新按钮状态（启用按钮）
        updateButtonState();

        // 通知服务端名单已获取
        if (socket && socket.readyState === WebSocket.OPEN && yuanchengma) {
            wsSend({ type: 'is_names_geted', code: yuanchengma, is_geted: true });
        }
    }
}

// 显示名单选择弹窗
function showNameSelectModal() {
    const modal = document.getElementById('nameSelectModal');
    
    modal.style.display = 'block';
    modal.offsetHeight;
    modal.classList.add('show');
}

// 隐藏名单选择弹窗
function hideNameSelectModal() {
    const modal = document.getElementById('nameSelectModal');
    const nameSelectContent = modal.querySelector('.name-select-content');
    nameSelectContent.style.animation = 'slideOut 0.3s ease-out forwards';
    modal.classList.add('hiding');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('hiding');
        nameSelectContent.style.animation = '';
    }, 300);
}

// 显示放大版二维码弹窗
function showQrModal() {
    const modal = document.getElementById('qrModal');
    const qrImage = document.getElementById('uploadQrCode');
    
    // 设置二维码图片为当前的二维码
    const erweimaimage = document.getElementById('erweimaimage');
    if (erweimaimage) {
        qrImage.src = erweimaimage.src;
    }
    
    modal.style.display = 'block';
    modal.offsetHeight;
    modal.classList.add('show');
}

// 隐藏放大版二维码弹窗
function hideQrModal() {
    const modal = document.getElementById('qrModal');
    const qrContent = modal.querySelector('.qr-content');
    qrContent.style.animation = 'slideOut 0.3s ease-out forwards';
    modal.classList.add('hiding');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('hiding');
        qrContent.style.animation = '';
    }, 300);
}

// 从本地输入的名单设置
function setNamesFromLocal(names) {
    if (names && names.length > 0) {
        xingming = names;
        isNamesLoaded = true;
        console.log('从本地输入接收名单:', xingming);

        // 保存到本地存储
        saveToLocalStorage();

        // 更新滑块的最大值为总人数
        updateSliderMax();

        // 名单已更新，重新缓存可用名单（点名运行中也能立即生效）
        rebuildAvailableNamesCache();

        // 更新显示
        const xingmingxianshi = document.getElementById('xingmingxianshi');
        if (xingmingxianshi && xingming.length > 0) {
            xingmingxianshi.textContent = '名单已就绪';
        }

        // 更新按钮状态（启用按钮）
        updateButtonState();

        // 通知服务端名单已获取
        if (socket && socket.readyState === WebSocket.OPEN && yuanchengma) {
            wsSend({ type: 'is_names_geted', code: yuanchengma, is_geted: true });
        }
    }
}

// 更新滑块的最大值
function updateSliderMax() {
    const totalCount = xingming.length;
    const protectionPoolSizeInput = document.getElementById('protection-pool-size');
    const totalCountElement = document.getElementById('total-count');

    if (protectionPoolSizeInput && totalCountElement) {
        // 保护池最大值为总人数的 4/5，至少为 1
        const maxPoolSize = Math.max(1, Math.floor(totalCount * 0.8));
        protectionPoolSizeInput.max = maxPoolSize;
        totalCountElement.textContent = totalCount;

        // 确保保护池大小不超过最大限制
        if (protectionPoolSize > maxPoolSize) {
            protectionPoolSize = maxPoolSize;
        }

        // 确保保护池大小至少为1
        if (protectionPoolSize < 1) {
            protectionPoolSize = 1;
        }

        // 更新滑块值和显示值
        protectionPoolSizeInput.value = protectionPoolSize;
        document.getElementById('pool-size-value').textContent = protectionPoolSize;

        // 更新滑块背景
        updateSliderBackground(protectionPoolSizeInput);
    }
}

// 为"开始"按钮添加点击事件监听器
document.getElementById('kaishianniu').addEventListener('click', () => {
    kaishiSuijiDianming();
});

// 为"停止"按钮添加点击事件监听器
document.getElementById('tingzhianniu').addEventListener('click', () => {
    tingzhiSuijiDianming();
});

// 重建可用名单缓存：一次性计算未被保护池排除的名单
// 点名定时器只从缓存取值，避免每次 tick 都重复过滤
function rebuildAvailableNamesCache() {
    const excluded = new Set(paichuleibiao);
    availableNamesCache = xingming.filter(name => !excluded.has(name));
    return availableNamesCache;
}

// 开始随机点名的函数
function kaishiSuijiDianming() {
    // 若播报遮罩仍显示，先关闭（防残留）
    if (isBroadcastOverlayVisible) {
        hideBroadcastOverlay();
    }
    if (shifouzaiyunxing) return; // 如果已经在运行，则不执行

    // 检查是否已获取名单
    if (!isNamesLoaded || xingming.length === 0) {
        console.log('名单尚未获取，无法开始');
        return;
    }

    const kaishianniu = document.getElementById('kaishianniu');
    const tingzhianniu = document.getElementById('tingzhianniu');
    const dianmingkuang = document.querySelector('.dianmingkuang');
    const xingmingxianshi = document.getElementById('xingmingxianshi');

    // 一次性计算可用名单缓存（排除保护池），后续定时器只从缓存取值
    rebuildAvailableNamesCache();
    if (availableNamesCache.length === 0) {
        // 没有可点名的名字，清空最早的一个保护池名字
        if (paichuleibiao.length > 0) {
            paichuleibiao.shift();
            rebuildAvailableNamesCache(); // 保护池更新，重新缓存
            updateProtectionPoolDisplay();
        }
        return;
    }

    shifouzaiyunxing = true;

    // 隐藏"开始"按钮，显示"停止"按钮
    kaishianniu.classList.add('yincang');
    kaishianniu.classList.remove('chuxian');
    setTimeout(() => {
        tingzhianniu.classList.remove('yincang');
        tingzhianniu.classList.add('chuxian');
    }, 300);

    // 先移除慢速动画类，再添加快速动画类
    dianmingkuang.classList.remove('mansuxianshi');
    dianmingkuang.classList.add('kuaisuxianshi');

    // 添加姓名显示框的呼吸效果
    xingmingxianshi.classList.add('huxi');

    // 清除之前的定时器
    clearInterval(dingshiqiID);
    // 每 1 毫秒按顺序显示下一个姓名（只从缓存数组取值，不重复过滤）
    dingshiqiID = setInterval(() => {
        if (availableNamesCache.length > 0) {
            xingmingxianshi.textContent = availableNamesCache[dangqianshixian % availableNamesCache.length];
            dangqianshixian = (dangqianshixian + 1) % availableNamesCache.length;
        }
    }, 1);
}

// 停止随机点名的函数
function tingzhiSuijiDianming() {
    if (!shifouzaiyunxing) return; // 如果没有在运行，则不执行
    shifouzaiyunxing = false;

    const kaishianniu = document.getElementById('kaishianniu');
    const tingzhianniu = document.getElementById('tingzhianniu');
    const dianmingkuang = document.querySelector('.dianmingkuang');
    const xingmingxianshi = document.getElementById('xingmingxianshi');

    // 隐藏"停止"按钮，显示"开始"按钮
    tingzhianniu.classList.add('yincang');
    tingzhianniu.classList.remove('chuxian');
    setTimeout(() => {
        kaishianniu.classList.remove('yincang');
        kaishianniu.classList.add('chuxian');
    }, 300);

    // 停止动画效果
    dianmingkuang.classList.remove('kuaisuxianshi');
    dianmingkuang.classList.add('mansuxianshi');

    // 移除姓名显示框的呼吸效果
    xingmingxianshi.classList.remove('huxi');

    // 清除定时器
    clearInterval(dingshiqiID);
    // 显示最终选中的姓名
    const zuizhongxuanzhong = xingmingxianshi.textContent;
    xingmingxianshi.textContent = zuizhongxuanzhong;

    // 更新排除列表
    paichuleibiao.push(zuizhongxuanzhong);
    if (paichuleibiao.length > protectionPoolSize) {
        paichuleibiao.shift();
    }

    // 保护池已更新，重新缓存可用名单（下次点名直接使用）
    rebuildAvailableNamesCache();

    // 更新防重复保护池显示
    updateProtectionPoolDisplay();

    // 对姓名列表进行高强度打乱重排
    xingming = fisherYatesShuffle(xingming);

    // 点名播报：全屏展示随机前缀消息
    showBroadcastOverlay(zuizhongxuanzhong);
}

// Fisher-Yates 洗牌算法
function fisherYatesShuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 遥控码刷新动画函数
function playCodeRefreshAnimation(newCode) {
    const yuanchengmaEl = document.getElementById('yuanchengma');
    const erweimaimage = document.getElementById('erweimaimage');
    
    // 动画1: 淡出隐藏
    yuanchengmaEl.classList.add('code-refresh-fadeout');
    
    setTimeout(() => {
        // 动画2: 显示旋转动画
        yuanchengmaEl.classList.remove('code-refresh-fadeout');
        yuanchengmaEl.classList.add('code-refresh-spinning');
        yuanchengmaEl.textContent = '刷新中...';
        
        setTimeout(() => {
            // 动画3: 显示新code，黄色闪烁
            yuanchengmaEl.classList.remove('code-refresh-spinning');
            
            // 更新数据
            savedCode = newCode;
            yuanchengma = newCode;
            reconnectFailCount = 0;
            
            // 更新显示
            yuanchengmaEl.textContent = `遥控码：${yuanchengma}`;
            yuanchengmaEl.classList.add('code-refresh-flash');
            erweimaimage.src = `https://api.pwmqr.com/qrcode/create/?url=https://${window.location.host}/randamer/phone/index.html?code=${yuanchengma}`;
            
            // 显示二维码区域
            const erweimaContainer = document.querySelector('.erweimacontaner');
            if (erweimaContainer) {
                erweimaContainer.classList.remove('hidden');
            }
            
            // 闪烁结束后恢复正常颜色
            setTimeout(() => {
                yuanchengmaEl.classList.remove('code-refresh-flash');
            }, 1200);
            
            // 报告名单获取状态
            if (isNamesLoaded) {
                wsSend({ type: 'is_names_geted', code: yuanchengma, is_geted: true });
            }
            
            // 处理待处理的 token 请求
            handlePendingToken();
        }, 500);
    }, 300);
}

// 点击遥控码立即重置WebSocket（获取新code）
function initRemoteCodeClickHandler() {
    const yuanchengmaEl = document.getElementById('yuanchengma');
    if (!yuanchengmaEl) return;
    
    yuanchengmaEl.addEventListener('click', () => {
        // 防止重复点击
        if (isCodeRefreshing) {
            console.log('遥控码刷新中，忽略重复点击');
            return;
        }
        
        isCodeRefreshing = true;
        console.log('点击遥控码，立即重置WebSocket获取新code');
        
        // 先清除重连定时器
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        
        // 关闭旧连接
        wsSafeClose();
        
        // 清除旧code
        const oldCode = savedCode;
        savedCode = '';
        isConnecting = false;
        
        // 初始化新连接（原生 WebSocket）
        socket = new WebSocket(getWsUrl());
        let refreshConnected = false;
        
        socket.onopen = function() {
            refreshConnected = true;
            console.log('重置后的WebSocket 连接已打开');
            isConnecting = false;
            // 立即请求新code
            wsSend({ type: 'get_code' });
        };
        
        socket.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'set_code' && data.code) {
                    // 获取到新code，播放动画
                    clearCodeTimeout();
                    console.log(`获取到新code: ${data.code}`);
                    playCodeRefreshAnimation(data.code);
                    isCodeRefreshing = false;
                    
                    // 重置消息处理，恢复正常的消息处理
                    resetSocketMessageHandlers();
                } else if (data.type === 'refuse_bcs_no_code_can_give') {
                    console.log('服务器无可分配的遥控码');
                    isCodeRefreshing = false;
                    showCustomAlert('服务器当前无可分配的遥控码，请稍后再试。');
                    // 恢复连接
                    wsSafeClose();
                    initWebSocket();
                }
            } catch (error) {
                console.error('解析WebSocket消息失败:', error);
            }
        };
        
        socket.onerror = function(error) {
            console.error('重置连接错误:', error);
            isCodeRefreshing = false;
            isConnecting = false;
        };
        
        socket.onclose = function(event) {
            console.log('重置连接已关闭，代码:', event.code);
            if (!refreshConnected) {
                // 连接未成功建立，恢复连接
                isCodeRefreshing = false;
                isConnecting = false;
                initWebSocket();
            }
        };
        
        // 启动超时定时器
        startCodeTimeout();
    });
}

// 恢复正常的WebSocket消息处理（重置后）
function resetSocketMessageHandlers() {
    if (!socket) return;
    
    socket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'set_code' && data.code) {
                // 首次获取code
                clearCodeTimeout();
                reconnectFailCount = 0;
                savedCode = data.code;
                yuanchengma = data.code;
                document.getElementById('yuanchengma').textContent = `遥控码：${yuanchengma}`;
                const erweimaimage = document.getElementById('erweimaimage');
                erweimaimage.src = `https://api.pwmqr.com/qrcode/create/?url=https://${window.location.host}/randamer/phone/index.html?code=${yuanchengma}`;
                const erweimaContainer = document.querySelector('.erweimacontaner');
                if (erweimaContainer) {
                    erweimaContainer.classList.remove('hidden');
                }
                console.log('收到遥控码:', yuanchengma);
                showLoadingOverlay(false);
                if (isNamesLoaded) {
                    wsSend({ type: 'is_names_geted', code: yuanchengma, is_geted: true });
                } else {
                    setTimeout(() => showNameSelectModal(), 300);
                }
                handlePendingToken();
            } else if (data.type === 'reconnect_success' && data.code) {
                // 重连成功
                reconnectFailCount = 0;
                clearCodeTimeout();
                savedCode = data.code;
                yuanchengma = data.code;
                document.getElementById('yuanchengma').textContent = `遥控码：${yuanchengma}`;
                const erweimaimage = document.getElementById('erweimaimage');
                erweimaimage.src = `https://api.pwmqr.com/qrcode/create/?url=https://${window.location.host}/randamer/phone/index.html?code=${yuanchengma}`;
                const erweimaContainer = document.querySelector('.erweimacontaner');
                if (erweimaContainer) {
                    erweimaContainer.classList.remove('hidden');
                }
                console.log('重连成功，code:', yuanchengma);
                showLoadingOverlay(false);
                if (isNamesLoaded) {
                    wsSend({ type: 'is_names_geted', code: yuanchengma, is_geted: true });
                } else {
                    setTimeout(() => showNameSelectModal(), 300);
                }
                handlePendingToken();
            } else if (data.type === 'reconnect_failed') {
                // 重连失败，无可用的code
                console.log('重连失败，无可用的code，原因:', data.reason);
                savedCode = '';
                reconnectFailCount = 0;
                yuanchengma = '';
                document.getElementById('yuanchengma').textContent = '';
                const erweimaContainer = document.querySelector('.erweimacontaner');
                if (erweimaContainer) {
                    erweimaContainer.classList.add('hidden');
                }
                showCustomAlert('遥控码不可用，请刷新页面重新获取。');
            } else if (data.type === 'code_refreshed') {
                // code过期，服务器下发新code
                const oldCode = data.old_code;
                const newCode = data.new_code;
                console.log(`code已刷新: ${oldCode} -> ${newCode}`);
                playCodeRefreshAnimation(newCode);
            } else if (data.type === 'refuse_bcs_no_code_can_give') {
                // 服务器无可分配的code
                console.log('服务器无可分配的遥控码');
                savedCode = '';
                yuanchengma = '';
                const erweimaContainer = document.querySelector('.erweimacontaner');
                if (erweimaContainer) {
                    erweimaContainer.classList.add('hidden');
                }
                document.getElementById('yuanchengma').textContent = '';
            } else if (data.type === 'ask_has_names') {
                // 服务端主动询问本机是否已拥有名单，如实应答
                console.log('收到服务端对本机名单状态的询问');
                if (socket && socket.readyState === WebSocket.OPEN && yuanchengma) {
                    wsSend({
                        type: 'have_names',
                        code: yuanchengma,
                        has_names: !!(isNamesLoaded && xingming && xingming.length > 0)
                    });
                }
            } else if (data.type === 'get_names') {
                // 手机端请求获取PC端名单
                console.log('收到get_names请求，发送当前名单');
                if (socket && socket.readyState === WebSocket.OPEN && yuanchengma) {
                    wsSend({
                        type: 'return_names',
                        code: yuanchengma,
                        names: xingming || []
                    });
                }
            } else if (data.type === 'this_is_list' && data.names) {
                // 接收到手机端发送的名单
                console.log('接收到手机端发送的名单');
                
                const qrModal = document.getElementById('qrModal');
                if (qrModal && qrModal.classList.contains('show')) {
                    hideQrModal();
                }
                
                setNamesFromPhone(data.names);
            } else if (data.type === 'easycore_names' && data.names) {
                // 接收到从 EasyCore 获取的名单
                console.log('接收到从 EasyCore 获取的名单');
                handleNamesFromEasyCore(data.names);
            } else if (data.type === 'easycore_names_error') {
                // 从 EasyCore 获取名单失败
                console.error('从 EasyCore 获取名单失败:', data.message);
                showCustomAlert('获取名单失败：' + data.message);
            } else if (data.type === 'clicked_1') {
                // 接收到手机端点击消息
                console.log('收到手机端点击消息');
                if (isBroadcastOverlayVisible) {
                    // 播报遮罩显示时：优先关闭遮罩，不切换点名状态
                    hideBroadcastOverlay();
                } else if (shifouzaiyunxing) {
                    tingzhiSuijiDianming();
                } else {
                    kaishiSuijiDianming();
                }
            } else if (data.status === 'error') {
                // 错误消息
                console.error('错误:', data.message);
            }
        } catch (error) {
            console.error('解析WebSocket消息失败:', error);
        }
    };
    
    // 重新设置 onclose 和 onerror handlers
    socket.onclose = function(event) {
        console.log('WebSocket连接已关闭，代码:', event.code, '原因:', event.reason);
        updateConnectionStatus(false);
        isConnecting = false;
        clearCodeTimeout();
        
        reconnectTimer = setTimeout(() => {
            if (savedCode) {
                console.log('尝试使用保存的code重连:', savedCode);
                initWebSocket(savedCode);
            } else {
                initWebSocket();
            }
        }, 2000);
    };
    
    socket.onerror = function(error) {
        console.error('WebSocket错误:', error);
        isConnecting = false;
        updateConnectionStatus(false);
        clearCodeTimeout();
    };
}

// 获取当前路径前缀（用于反向代理子目录支持）
function getBasePath() {
    const pathname = window.location.pathname;
    // 如果路径以 /phone/ 结尾，说明当前在 phone 子目录
    if (pathname.includes('/phone/') || pathname.endsWith('/phone')) {
        return pathname.substring(0, pathname.indexOf('/phone/')) || '/';
    }
    // 否则取目录部分
    const lastSlash = pathname.lastIndexOf('/');
    return pathname.substring(0, lastSlash + 1);
}

// 获取 API 基础路径（用于连接到 EasyCore）
// 假设部署结构为：
//   /randamer/ -> 静态文件
//   /easycore/api/randamer/ -> EasyCore API
// 通过计算相对路径来定位 API
function getApiBasePath() {
    const pathname = window.location.pathname;
    
    // 如果当前在 /randamer/ 目录下
    if (pathname.includes('/randamer/')) {
        // 从 /randamer/ 到根目录，再到 /easycore/
        const randamerIndex = pathname.indexOf('/randamer/');
        const basePath = pathname.substring(0, randamerIndex);
        return basePath + '/easycore/';
    }
    
    // 如果当前在 /phone/ 子目录
    if (pathname.includes('/randamer') && pathname.includes('/phone/')) {
        const randamerIndex = pathname.indexOf('/randamer');
        const basePath = pathname.substring(0, randamerIndex);
        return basePath + '/easycore/';
    }
    
    // 默认情况：假设 API 在根目录的 /api/
    return '/';
}

// 更新连接状态显示
function updateConnectionStatus(connected) {
    const statusText = document.getElementById('statusText');

    if (connected) {
        statusText.classList.remove('disconnected');
        statusText.textContent = '服务器连接正常';
    } else {
        statusText.classList.add('disconnected');
        statusText.textContent = '服务器连接断开';
    }
}

// 显示/隐藏加载遮罩
function showLoadingOverlay(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        if (show) {
            loadingOverlay.classList.remove('hidden');
        } else {
            loadingOverlay.classList.add('hidden');
        }
    }
}

// 清除code超时定时器
function clearCodeTimeout() {
    if (codeTimeoutTimer) {
        clearTimeout(codeTimeoutTimer);
        codeTimeoutTimer = null;
    }
}

// 启动code超时定时器
function startCodeTimeout() {
    clearCodeTimeout();
    codeTimeoutTimer = setTimeout(() => {
        console.log('获取code超时，重置连接...');
        // 关闭当前连接
        wsSafeClose();
        isConnecting = false;
        reconnectFailCount++;
        if (savedCode && reconnectFailCount < MAX_RECONNECT_FAILS) {
            // 重连确认超时：保留旧 code 重试（服务端重连窗口内可继承）
            console.log(`重连确认超时，第 ${reconnectFailCount} 次重试...`);
            initWebSocket(savedCode);
        } else {
            // 多次失败或首次连接：清空旧 code，重新获取
            savedCode = '';
            reconnectFailCount = 0;
            initWebSocket();
        }
    }, CODE_TIMEOUT);
}

// 初始化WebSocket连接
function initWebSocket(reconnectCode = null) {
    // 防止重复初始化
    if (isConnecting) {
        console.log('连接正在进行中，跳过重复初始化');
        return;
    }

    // 如果已有连接，先断开
    if (socket) {
        console.log('关闭旧连接');
        wsSafeClose();
    }

    // 清除之前的重连定时器
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    isConnecting = true;

    // 构造 WebSocket URL（原生 WebSocket，非 Socket.IO）
    // 支持部署到任意目录，如 easyclass.zhrhello.top/randamer
    const wsParams = reconnectCode ? { in_reconnect: reconnectCode } : {};
    if (reconnectCode) {
        console.log('尝试重连，code:', reconnectCode);
    }

    socket = new WebSocket(getWsUrl(wsParams));
    let hasConnected = false;

    socket.onopen = function() {
        hasConnected = true;
        console.log('WebSocket 连接已打开');
        updateConnectionStatus(true);
        isConnecting = false;

        if (reconnectCode) {
            // 重连模式：主动告知服务端重连（消息协议，绕开 URL 参数解析问题）
            console.log('等待重连确认...');
            wsSend({ type: 'reconnect', code: reconnectCode });
            startCodeTimeout();
        } else {
            // 首次连接，立即获取遥控码
            wsSend({ type: 'get_code' });
            startCodeTimeout();
        }
    };

    socket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'set_code' && data.code) {
                // 接收到遥控码，清除超时定时器
                clearCodeTimeout();
                reconnectFailCount = 0;
                savedCode = data.code;
                yuanchengma = data.code;
                document.getElementById('yuanchengma').textContent = `遥控码：${yuanchengma}`;
                const erweimaimage = document.getElementById('erweimaimage');
                erweimaimage.src = `https://api.pwmqr.com/qrcode/create/?url=https://${window.location.host}/randamer/phone/index.html?code=${yuanchengma}`;
                const erweimaContainer = document.querySelector('.erweimacontaner');
                if (erweimaContainer) {
                    erweimaContainer.classList.remove('hidden');
                }
                console.log('收到遥控码:', yuanchengma);
                showLoadingOverlay(false);
                if (isNamesLoaded) {
                    wsSend({ type: 'is_names_geted', code: yuanchengma, is_geted: true });
                } else {
                    setTimeout(() => showNameSelectModal(), 300);
                }
                handlePendingToken();
            } else if (data.type === 'reconnect_success' && data.code) {
                clearCodeTimeout();
                reconnectFailCount = 0;
                savedCode = data.code;
                yuanchengma = data.code;
                document.getElementById('yuanchengma').textContent = `遥控码：${yuanchengma}`;
                const erweimaimage = document.getElementById('erweimaimage');
                erweimaimage.src = `https://api.pwmqr.com/qrcode/create/?url=https://${window.location.host}/randamer/phone/index.html?code=${yuanchengma}`;
                const erweimaContainer = document.querySelector('.erweimacontaner');
                if (erweimaContainer) {
                    erweimaContainer.classList.remove('hidden');
                }
                console.log('重连成功，code:', yuanchengma);
                showLoadingOverlay(false);
                if (isNamesLoaded) {
                    wsSend({ type: 'is_names_geted', code: yuanchengma, is_geted: true });
                } else {
                    setTimeout(() => showNameSelectModal(), 300);
                }
                handlePendingToken();
            } else if (data.type === 'reconnect_failed') {
                console.log('重连失败，无可用的code，原因:', data.reason);
                savedCode = '';
                reconnectFailCount = 0;
                yuanchengma = '';
                document.getElementById('yuanchengma').textContent = '';
                const erweimaContainer = document.querySelector('.erweimacontaner');
                if (erweimaContainer) {
                    erweimaContainer.classList.add('hidden');
                }
                showCustomAlert('遥控码不可用，请刷新页面重新获取。');
            } else if (data.type === 'code_refreshed') {
                const oldCode = data.old_code;
                const newCode = data.new_code;
                console.log(`code已刷新: ${oldCode} -> ${newCode}`);
                playCodeRefreshAnimation(newCode);
            } else if (data.type === 'refuse_bcs_no_code_can_give') {
                console.log('服务器无可分配的遥控码');
                savedCode = '';
                yuanchengma = '';
                const erweimaContainer = document.querySelector('.erweimacontaner');
                if (erweimaContainer) {
                    erweimaContainer.classList.add('hidden');
                }
                document.getElementById('yuanchengma').textContent = '';
            } else if (data.type === 'ask_has_names') {
                // 服务端主动询问本机是否已拥有名单，如实应答
                console.log('收到服务端对本机名单状态的询问');
                if (socket && socket.readyState === WebSocket.OPEN && yuanchengma) {
                    wsSend({
                        type: 'have_names',
                        code: yuanchengma,
                        has_names: !!(isNamesLoaded && xingming && xingming.length > 0)
                    });
                }
            } else if (data.type === 'get_names') {
                console.log('收到get_names请求，发送当前名单');
                if (socket && socket.readyState === WebSocket.OPEN && yuanchengma) {
                    wsSend({
                        type: 'return_names',
                        code: yuanchengma,
                        names: xingming || []
                    });
                }
            } else if (data.type === 'this_is_list' && data.names) {
                console.log('接收到手机端发送的名单');
                const qrModal = document.getElementById('qrModal');
                if (qrModal && qrModal.classList.contains('show')) {
                    hideQrModal();
                }
                setNamesFromPhone(data.names);
            } else if (data.type === 'easycore_names' && data.names) {
                console.log('接收到从 EasyCore 获取的名单');
                handleNamesFromEasyCore(data.names);
            } else if (data.type === 'easycore_names_error') {
                console.error('从 EasyCore 获取名单失败:', data.message);
                showCustomAlert('获取名单失败：' + data.message);
            } else if (data.type === 'clicked_1') {
                console.log('收到手机端点击消息');
                if (isBroadcastOverlayVisible) {
                    // 播报遮罩显示时：优先关闭遮罩，不切换点名状态
                    hideBroadcastOverlay();
                } else if (shifouzaiyunxing) {
                    tingzhiSuijiDianming();
                } else {
                    kaishiSuijiDianming();
                }
            } else if (data.status === 'error') {
                console.error('错误:', data.message);
            }
        } catch (error) {
            console.error('解析WebSocket消息失败:', error);
        }
    };

    socket.onerror = function(error) {
        console.error('WebSocket错误:', error);
        updateConnectionStatus(false);
        clearCodeTimeout();
    };

    socket.onclose = function(event) {
        console.log('WebSocket连接已关闭，代码:', event.code, '原因:', event.reason);
        updateConnectionStatus(false);
        isConnecting = false;
        clearCodeTimeout();

        if (!hasConnected) {
            // 连接未成功建立（connect_error 场景），延迟重连
            reconnectTimer = setTimeout(() => {
                if (savedCode) {
                    console.log('连接错误后尝试重连，code:', savedCode);
                    initWebSocket(savedCode);
                } else {
                    initWebSocket();
                }
            }, 3000);
        } else {
            // 连接正常断开，延迟重连
            reconnectTimer = setTimeout(() => {
                if (savedCode) {
                    console.log('尝试使用保存的code重连:', savedCode);
                    initWebSocket(savedCode);
                } else {
                    initWebSocket();
                }
            }, 2000);
        }
    };
}

// 通过 WebSocket 从 EasyCore 获取名单
function requestNamesFromEasyCore(token) {
    if (!socket || socket.readyState !== WebSocket.OPEN || !yuanchengma) {
        console.log('WebSocket 未连接，无法请求名单');
        return false;
    }

    try {
        // 通过 WebSocket 发送请求给 EasyCore
        wsSend({
            type: 'get_names_from_easycore',
            token: token,
            code: yuanchengma
        });
        console.log('已通过 WebSocket 请求名单，token:', token);
        return true;
    } catch (error) {
        console.error('发送名单请求失败:', error);
        return false;
    }
}

// 处理从 EasyCore 获取的名单
function handleNamesFromEasyCore(names) {
    if (!names || !Array.isArray(names) || names.length === 0) {
        showCustomAlert('获取的名单为空或格式错误');
        return false;
    }

    try {
        // 设置名单
        xingming = names;
        isNamesLoaded = true;

        // 保存到本地存储
        saveToLocalStorage();

        // 更新滑块的最大值
        updateSliderMax();

        // 名单已更新，重新缓存可用名单
        rebuildAvailableNamesCache();

        // 更新显示
        const xingmingxianshi = document.getElementById('xingmingxianshi');
        if (xingmingxianshi) {
            xingmingxianshi.textContent = '名单已就绪';
        }

        // 更新按钮状态
        updateButtonState();

        // 更新防重复保护池显示
        updateProtectionPoolDisplay();

        // 清除 URL 中的 token 参数
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);

        console.log('从 EasyCore 成功导入名单，数量:', names.length);
        return true;
    } catch (error) {
        console.error('处理名单失败:', error);
        showCustomAlert('导入名单失败：' + error.message);
        return false;
    }
}

// 从云名单导入名单
function importFromCloudList() {
    if (isLoggedIn) {
        showCloudListModal();
    } else {
        window.location.href = 'https://easyclass.zhrhello.top/easycore/';
    }
}

// 显示云名单选择面板
function showCloudListModal() {
    const modal = document.getElementById('cloudListModal');
    if (!modal) return;
    
    modal.style.display = 'block';
    modal.offsetHeight;
    modal.classList.add('show');
    
    fetchAndRenderCloudLists();
}

// 隐藏云名单选择面板
function hideCloudListModal() {
    const modal = document.getElementById('cloudListModal');
    const cloudListContent = modal.querySelector('.cloud-list-content');
    
    if (!modal) return;
    
    cloudListContent.style.animation = 'slideOut 0.3s ease-out forwards';
    modal.classList.add('hiding');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('hiding');
        cloudListContent.style.animation = '';
    }, 300);
}

// 获取云名单列表
async function fetchCloudLists() {
    try {
        const response = await fetch(`${getApiBasePath()}api/cloud-lists/list`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                isLoggedIn = false;
                currentUser = null;
                throw new Error('未登录');
            }
            throw new Error('获取云名单失败');
        }
        
        const data = await response.json();
        return {
            success: true,
            lists: data.lists || []
        };
    } catch (error) {
        console.error('获取云名单失败:', error);
        return {
            success: false,
            lists: [],
            error: error.message
        };
    }
}

// 获取并渲染云名单列表
async function fetchAndRenderCloudLists() {
    const container = document.getElementById('cloudListContainer');
    const emptyState = document.getElementById('cloudListEmpty');
    
    if (!container || !emptyState) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: #8f8f8f;">加载中...</div>';
    emptyState.classList.add('hidden');
    
    const result = await fetchCloudLists();
    
    if (!result.success) {
        if (result.error === '未登录') {
            hideCloudListModal();
            window.location.href = 'https://easyclass.zhrhello.top/easycore/';
            return;
        }
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #ff6b6b;">加载失败：' + escapeHtml(result.error) + '</div>';
        return;
    }
    
    renderCloudLists(result.lists);
}

// 渲染云名单列表
function renderCloudLists(lists) {
    const container = document.getElementById('cloudListContainer');
    const emptyState = document.getElementById('cloudListEmpty');
    
    if (!container || !emptyState) return;
    
    if (!lists || lists.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    container.innerHTML = lists.map(list => `
        <div class="cloud-list-item" data-list-id="${escapeHtml(list.list_id)}">
            <div class="cloud-list-name">${escapeHtml(list.name)}</div>
            <div class="cloud-list-info">
                <span>${list.item_count || 0}人</span>
            </div>
            <button class="cloud-list-select-btn" onclick="selectCloudList('${escapeHtml(list.list_id)}', this)">选择此名单</button>
        </div>
    `).join('');
}

// 选择云名单并导入
async function selectCloudList(listId, button) {
    if (!listId || !button) return;
    
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '导入中...';
    
    const listItem = button.closest('.cloud-list-item');
    if (listItem) {
        listItem.classList.add('loading');
    }
    
    try {
        const pickUrl = `${getApiBasePath()}api/cloud-lists/pick?list_id=${encodeURIComponent(listId)}`;
        const response = await fetch(pickUrl, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('选择名单失败');
        }
        
        const data = await response.json();
        
        if (!data.token) {
            throw new Error('未获取到token');
        }
        
        await importCloudListByToken(data.token);
        
        hideCloudListModal();
    } catch (error) {
        console.error('选择名单失败:', error);
        showCustomAlert('导入失败：' + error.message);
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
        const response = await fetch(`${getApiBasePath()}api/cloud-lists/get_names?token=${token}`, {
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
        
        xingming = data.names;
        isNamesLoaded = true;
        
        saveToLocalStorage();
        updateSliderMax();
        // 名单已更新，重新缓存可用名单
        rebuildAvailableNamesCache();
        
        const xingmingxianshi = document.getElementById('xingmingxianshi');
        if (xingmingxianshi) {
            xingmingxianshi.textContent = '名单已就绪';
        }
        
        updateButtonState();
        updateProtectionPoolDisplay();
        
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        console.log('成功导入云名单，数量:', data.names.length);
        
        return true;
    } catch (error) {
        console.error('导入名单失败:', error);
        throw error;
    }
}

// 检查URL中的cloud_list_token参数并获取名单
async function checkCloudListTokenAndImport() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('cloud_list_token');
    
    if (!token) {
        return false;
    }
    
    // 清除URL中的token
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
    
    try {
        const response = await fetch(`https://easyclass.zhrhello.top/easycore/api/cloud-lists/get_names?token=${token}`);
        if (!response.ok) {
            throw new Error('获取名单失败');
        }
        
        const data = await response.json();
        if (!data.names || !Array.isArray(data.names)) {
            showCustomAlert('获取名单失败：数据格式错误');
            return false;
        }
        
        if (data.names.length === 0) {
            showCustomAlert('获取的名单为空');
            return false;
        }
        
        // 直接设置云端名单，避免被本地保存的名单覆盖
        setNamesFromLocal(data.names);
        
        // 关闭名单选择弹窗（如果打开）
        const nameSelectModal = document.getElementById('nameSelectModal');
        if (nameSelectModal && nameSelectModal.classList.contains('show')) {
            hideNameSelectModal();
        }
        
        // 打开编辑名单弹窗显示云端名单
        setTimeout(() => openEditNamesModal(), 300);
        return true;
    } catch (error) {
        showCustomAlert('导入失败：' + error.message);
        return false;
    }
}

// 页面加载时获取遥控码和名单
window.addEventListener('load', async () => {
    document.body.classList.add('fade-in');
    // 显示加载遮罩
    showLoadingOverlay(true);

    // 先检查本地保存开关状态
    checkLocalStorageEnabled();

    // 尝试从本地存储加载数据
    const hasLocalData = loadFromLocalStorage();

    // 检查 URL 中是否有 cloud_list_token 参数（从云名单导入）
    const cloudListToken = await checkCloudListTokenAndImport();
    
    // 检查 URL 中是否有 token 参数（从 EasyCore 导入名单）
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('names_get_token');
    let importedFromToken = false;

    // 如果有 token，先保存起来，等 WebSocket 连接后再请求
    if (token) {
        console.log('检测到 token 参数，等待 WebSocket 连接后请求名单');
        importedFromToken = true;
    }

    // 如果没有从 token 导入，则继续正常流程
    if (!importedFromToken) {
        duquXingming();
    }

    initWebSocket();
    document.addEventListener('keydown', handleKeyDown);

    // 初始化设置功能（在名单加载完成后）
    initSettings();

    // 初始化点名播报开关并加载前缀
    initBroadcastSetting();
    loadBroadcastPrefixes();

    // 保存 token 以便在 WebSocket 连接后使用
    window.pendingToken = token;

    // 如果有本地数据，更新 UI
    if (hasLocalData && xingming.length > 0) {
        // 更新滑块的最大值
        updateSliderMax();

        // 更新显示
        const xingmingxianshi = document.getElementById('xingmingxianshi');
        if (xingmingxianshi) {
            xingmingxianshi.textContent = '名单已就绪';
        }

        // 更新按钮状态
        updateButtonState();
    }

    // 初始化防重复保护池显示
    updateProtectionPoolDisplay();

    // 初始化保护池列表滚动事件
    initProtectionPoolScroll();

    // 初始化名单输入弹窗事件
    initNameListModal();

    // 初始化名单选择弹窗事件
    initNameSelectModal();

    // 初始化云名单面板事件
    initCloudListModal();

    // 初始化二维码弹窗事件
    initQrModal();

    // 初始化通用弹窗事件
    initCustomModals();
    
    // 获取用户信息
    await fetchUserInfo();
    
    // 初始化用户头像和弹窗事件
    initUserAvatar();
    
    // 初始化遥控码点击刷新事件
    initRemoteCodeClickHandler();
});

// 初始化名单输入弹窗事件
function initNameListModal() {
    const inputNameListBtn = document.getElementById('inputNameListBtn');
    if (inputNameListBtn) {
        inputNameListBtn.addEventListener('click', () => {
            openEditNamesModal();
        });
    }
}

// 初始化名单选择弹窗事件
function initNameSelectModal() {
    const cloudListOption = document.getElementById('cloudListOption');
    const qrcodeOption = document.getElementById('qrcodeOption');

    if (cloudListOption) {
        cloudListOption.addEventListener('click', () => {
            hideNameSelectModal();
            importFromCloudList();
        });
    }

    if (qrcodeOption) {
        qrcodeOption.addEventListener('click', () => {
            hideNameSelectModal();
            setTimeout(() => showQrModal(), 300);
        });
    }
}

// 初始化云名单面板事件
function initCloudListModal() {
    const closeCloudListBtn = document.getElementById('closeCloudListBtn');
    const cloudListModal = document.getElementById('cloudListModal');
    
    if (closeCloudListBtn) {
        closeCloudListBtn.addEventListener('click', () => {
            hideCloudListModal();
        });
    }
    
    if (cloudListModal) {
        cloudListModal.addEventListener('click', (e) => {
            if (e.target === cloudListModal) {
                hideCloudListModal();
            }
        });
    }
}

// 初始化二维码弹窗事件
function initQrModal() {
    const backToSelectFromQrBtn = document.getElementById('backToSelectFromQrBtn');

    if (backToSelectFromQrBtn) {
        backToSelectFromQrBtn.addEventListener('click', () => {
            hideQrModal();
            setTimeout(() => showNameSelectModal(), 300);
        });
    }
}

// 初始化通用弹窗事件
function initCustomModals() {
    const customAlertModal = document.getElementById('customAlertModal');
    const customAlertBtn = document.getElementById('customAlertBtn');
    const customConfirmModal = document.getElementById('customConfirmModal');
    const customConfirmOkBtn = document.getElementById('customConfirmOkBtn');
    const customConfirmCancelBtn = document.getElementById('customConfirmCancelBtn');

    if (customAlertBtn) {
        customAlertBtn.addEventListener('click', closeCustomAlert);
    }

    if (customAlertModal) {
        customAlertModal.addEventListener('click', (e) => {
            if (e.target === customAlertModal) {
                closeCustomAlert();
            }
        });
    }

    if (customConfirmOkBtn) {
        customConfirmOkBtn.addEventListener('click', handleCustomConfirmOk);
    }

    if (customConfirmCancelBtn) {
        customConfirmCancelBtn.addEventListener('click', handleCustomConfirmCancel);
    }

    if (customConfirmModal) {
        customConfirmModal.addEventListener('click', (e) => {
            if (e.target === customConfirmModal) {
                handleCustomConfirmCancel();
            }
        });
    }
}

// 获取用户信息
async function fetchUserInfo() {
    try {
        const response = await fetch(`${getApiBasePath()}api/user/info`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.user) {
                isLoggedIn = true;
                currentUser = data.user;
                isGuest = !!(data.user.is_guest);
                updateUserAvatar();
            } else {
                isLoggedIn = false;
                isGuest = false;
                currentUser = null;
                updateUserAvatar();
            }
        } else {
            isLoggedIn = false;
            isGuest = false;
            currentUser = null;
            updateUserAvatar();
        }
    } catch (error) {
        console.error('获取用户信息失败:', error);
        isLoggedIn = false;
        isGuest = false;
        currentUser = null;
        updateUserAvatar();
    }
}

// 获取并渲染云名单列表（用于用户信息弹窗）
async function fetchAndRenderCloudListsForUser() {
    const container = document.getElementById('cloudListContainerUser');
    const emptyState = document.getElementById('cloudListEmptyUser');
    
    if (!container || !emptyState) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #8f8f8f;">加载中...</div>';
    emptyState.classList.add('hidden');
    
    try {
        const response = await fetch(`${getApiBasePath()}api/cloud-lists/list`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('获取云名单失败');
        }
        
        const data = await response.json();
        const lists = data.lists || [];
        
        if (!lists || lists.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }
        
        container.innerHTML = lists.map(list => `
            <div class="cloud-list-item-user" data-list-id="${escapeHtml(list.list_id)}">
                <div class="cloud-list-name-user">${escapeHtml(list.name)}</div>
                <div class="cloud-list-info-user">${list.item_count || 0}人</div>
                <button class="cloud-list-select-btn-user" onclick="selectCloudListForUser('${escapeHtml(list.list_id)}', this)">导入</button>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('获取云名单失败:', error);
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">加载失败：' + escapeHtml(error.message) + '</div>';
    }
}

// 选择云名单并导入（用于用户信息弹窗）
async function selectCloudListForUser(listId, button) {
    if (!listId || !button) return;
    
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '导入中...';
    
    const listItem = button.closest('.cloud-list-item-user');
    if (listItem) {
        listItem.classList.add('loading');
    }
    
    try {
        const pickUrl = `${getApiBasePath()}api/cloud-lists/pick?list_id=${encodeURIComponent(listId)}`;
        const response = await fetch(pickUrl, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('选择名单失败');
        }
        
        const data = await response.json();
        
        if (!data.token) {
            throw new Error('未获取到token');
        }
        
        await importCloudListByTokenForUser(data.token);
        
        hideUserInfoModal();
    } catch (error) {
        console.error('导入失败:', error);
        showCustomAlert('导入失败：' + error.message);
        button.disabled = false;
        button.textContent = originalText;
        if (listItem) {
            listItem.classList.remove('loading');
        }
    }
}

// 通过token导入云名单（用于用户信息弹窗）
async function importCloudListByTokenForUser(token) {
    try {
        const response = await fetch(`${getApiBasePath()}api/cloud-lists/get_names?token=${token}`, {
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
        
        xingming = data.names;
        isNamesLoaded = true;
        
        saveToLocalStorage();
        updateSliderMax();
        // 名单已更新，重新缓存可用名单
        rebuildAvailableNamesCache();
        
        const xingmingxianshi = document.getElementById('xingmingxianshi');
        if (xingmingxianshi) {
            xingmingxianshi.textContent = '名单已就绪';
        }
        
        updateButtonState();
        updateProtectionPoolDisplay();
        
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        console.log('成功导入云名单，数量:', data.names.length);
        showCustomAlert('成功导入 ' + data.names.length + ' 人', '提示');
        
        return true;
    } catch (error) {
        console.error('导入名单失败:', error);
        throw error;
    }
}

// 更新头像显示
function updateUserAvatar() {
    const userAvatar = document.getElementById('userAvatar');
    
    if (!userAvatar) return;
    
    if (isLoggedIn && currentUser && currentUser.avatar_url) {
        // 已登录且有头像
        userAvatar.innerHTML = `<img src="${currentUser.avatar_url}" alt="用户头像" onerror="this.style.display='none'; this.parentElement.innerHTML='<svg viewBox=\\'0 0 24 24\\'><path d=\\'M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z\\'/></svg>';">`;
        userAvatar.classList.add('logged-in');
    } else {
        // 未登录或无头像，显示默认图标
        userAvatar.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/></svg>';
        userAvatar.classList.remove('logged-in');
    }
}

// 显示用户信息弹窗
function showUserInfoModal() {
    const modal = document.getElementById('userInfoModal');
    const userInfoUsername = document.getElementById('userInfoUsername');
    const userInfoEmail = document.getElementById('userInfoEmail');
    const userInfoAvatar = document.getElementById('userInfoAvatar');
    const userLogoutBtn = document.getElementById('userLogoutBtn');
    const cloudListSectionUser = document.getElementById('cloudListSectionUser');

    if (!modal) return;

    // 更新弹窗中的用户信息
    if (isLoggedIn && currentUser && isGuest) {
        // 游客模式：显示游客标识 + 登录/注册引导
        userInfoUsername.textContent = '游客';
        userInfoEmail.textContent = '游客模式 · 登录可同步保存数据';
        userInfoAvatar.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/></svg>';
        if (userLogoutBtn) {
            userLogoutBtn.textContent = '登录 / 注册';
            userLogoutBtn.classList.remove('user-logout-btn');
            userLogoutBtn.classList.add('login-btn');
        }
        // 游客同样可使用云名单
        if (cloudListSectionUser) {
            cloudListSectionUser.classList.remove('hidden');
            fetchAndRenderCloudListsForUser();
        }
    } else if (isLoggedIn && currentUser) {
        userInfoUsername.textContent = currentUser.name || '未设置用户名';
        userInfoEmail.textContent = currentUser.email || '未设置邮箱';

        // 更新弹窗中的头像
        if (currentUser.avatar_url) {
            userInfoAvatar.innerHTML = `<img src="${currentUser.avatar_url}" alt="用户头像" onerror="this.style.display='none'; this.parentElement.innerHTML='<svg viewBox=\\'0 0 24 24\\'><path d=\\'M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z\\'/></svg>';">`;
        } else {
            userInfoAvatar.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/></svg>';
        }

        // 已登录：显示登出按钮和云名单导入区域
        if (userLogoutBtn) {
            userLogoutBtn.textContent = '登出';
            userLogoutBtn.classList.remove('login-btn');
            userLogoutBtn.classList.add('user-logout-btn');
        }
        
        // 显示云名单导入区域
        if (cloudListSectionUser) {
            cloudListSectionUser.classList.remove('hidden');
            fetchAndRenderCloudListsForUser();
        }
    } else {
        userInfoUsername.textContent = '未登录';
        userInfoEmail.textContent = '-';
        userInfoAvatar.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/></svg>';

        // 未登录：显示去登录按钮，隐藏云名单区域
        if (userLogoutBtn) {
            userLogoutBtn.textContent = '去登录';
            userLogoutBtn.classList.remove('user-logout-btn');
            userLogoutBtn.classList.add('login-btn');
        }
        
        if (cloudListSectionUser) {
            cloudListSectionUser.classList.add('hidden');
        }
    }

    modal.style.display = 'flex';
    modal.offsetHeight;
    modal.classList.add('show');
}

// 隐藏用户信息弹窗
function hideUserInfoModal() {
    const modal = document.getElementById('userInfoModal');
    const userInfoContent = modal.querySelector('.user-info-content');
    
    if (!modal) return;
    
    userInfoContent.style.animation = 'slideOut 0.3s ease-out forwards';
    modal.classList.add('hiding');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('hiding');
        userInfoContent.style.animation = '';
    }, 300);
}

// 登出功能（游客登出 = 放弃数据，先确认）
async function handleLogout() {
    if (isGuest && !window.confirm('退出游客模式将删除本机游客数据（名单、前缀等），确定退出吗？')) return;
    try {
        const response = await fetch(`${getApiBasePath()}api/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            isLoggedIn = false;
            isGuest = false;
            currentUser = null;
            updateUserAvatar();
            hideUserInfoModal();
            showCustomAlert('已成功登出', '提示');
        } else {
            showCustomAlert('登出失败，请重试', '错误');
        }
    } catch (error) {
        console.error('登出失败:', error);
        showCustomAlert('登出失败，请重试', '错误');
    }
}

// 初始化用户头像和弹窗事件
function initUserAvatar() {
    const userAvatarContainer = document.getElementById('userAvatarContainer');
    const userInfoModal = document.getElementById('userInfoModal');
    const closeUserInfoBtn = document.getElementById('closeUserInfoBtn');
    const userLogoutBtn = document.getElementById('userLogoutBtn');
    
    // 点击头像切换弹窗
    if (userAvatarContainer) {
        userAvatarContainer.addEventListener('click', () => {
            if (userInfoModal.classList.contains('show')) {
                hideUserInfoModal();
            } else {
                showUserInfoModal();
            }
        });
    }
    
    // 点击弹窗外部关闭
    if (userInfoModal) {
        userInfoModal.addEventListener('click', (e) => {
            if (e.target === userInfoModal) {
                hideUserInfoModal();
            }
        });
    }
    
    // 点击关闭按钮
    if (closeUserInfoBtn) {
        closeUserInfoBtn.addEventListener('click', hideUserInfoModal);
    }
    
    // 点击底部按钮（登出/去登录/游客升级）
    if (userLogoutBtn) {
        userLogoutBtn.addEventListener('click', () => {
            if (isLoggedIn && isGuest) {
                // 游客 -> 登录/注册正式账号（SSO 登录后可合并游客数据）
                window.location.href = `${getApiBasePath()}login`;
            } else if (isLoggedIn) {
                handleLogout();
            } else {
                window.location.href = 'https://easyclass.zhrhello.top/easycore/';
            }
        });
    }
}

// 初始化保护池列表滚动事件
function initProtectionPoolScroll() {
    const protectionPoolList = document.getElementById('protectionPoolList');
    if (!protectionPoolList) return;

    let isScrolling = false;
    let startY = 0;
    let startScrollTop = 0;

    // 鼠标滚轮事件
    protectionPoolList.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY || e.detail || e.wheelDelta;
        protectionPoolList.scrollTop += delta;
    }, { passive: false });

    // 触摸开始
    protectionPoolList.addEventListener('touchstart', (e) => {
        isScrolling = true;
        startY = e.touches[0].clientY;
        startScrollTop = protectionPoolList.scrollTop;
    }, { passive: true });

    // 触摸移动
    protectionPoolList.addEventListener('touchmove', (e) => {
        if (!isScrolling) return;
        const currentY = e.touches[0].clientY;
        const deltaY = startY - currentY;
        protectionPoolList.scrollTop = startScrollTop + deltaY;
    }, { passive: true });

    // 触摸结束
    protectionPoolList.addEventListener('touchend', () => {
        isScrolling = false;
    }, { passive: true });

    // 鼠标拖拽滚动（桌面端）
    let isMouseDown = false;
    let mouseStartY = 0;
    let mouseStartScrollTop = 0;

    protectionPoolList.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        mouseStartY = e.clientY;
        mouseStartScrollTop = protectionPoolList.scrollTop;
        protectionPoolList.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;
        const deltaY = mouseStartY - e.clientY;
        protectionPoolList.scrollTop = mouseStartScrollTop + deltaY;
    });

    document.addEventListener('mouseup', () => {
        if (isMouseDown) {
            isMouseDown = false;
            protectionPoolList.style.cursor = 'default';
        }
    });
}

// ============ 点名播报前缀 ============

// 初始化「自定义播报消息」开关（从 localStorage 读取，默认关闭）
function initBroadcastSetting() {
    const checkbox = document.getElementById('custom-broadcast-checkbox');
    if (!checkbox) return;

    // 读取保存的开关状态（默认关闭）
    const saved = localStorage.getItem('customBroadcastEnabled');
    broadcastEnabled = saved === 'true';
    checkbox.checked = broadcastEnabled;

    checkbox.addEventListener('change', () => {
        broadcastEnabled = checkbox.checked;
        if (broadcastEnabled) {
            localStorage.setItem('customBroadcastEnabled', 'true');
        } else {
            localStorage.setItem('customBroadcastEnabled', 'false');
        }
        // 若本地保存被关闭，则不持久化开关
        if (!localStorageEnabled) {
            localStorage.removeItem('customBroadcastEnabled');
        }
    });

    // 管理前缀列表：新标签页打开 EasyCore 前缀管理页
    const manageBtn = document.getElementById('manage-prefixes-btn');
    if (manageBtn) {
        manageBtn.addEventListener('click', () => {
            let base = getApiBasePath();
            // getApiBasePath() 返回以 /easycore/ 结尾的路径
            if (base && base !== '/') {
                window.open(base + '?tab=prefixes', '_blank');
            } else {
                window.open('https://easyclass.zhrhello.top/easycore/?tab=prefixes', '_blank');
            }
        });
    }

    // 遮罩点击关闭
    const overlay = document.getElementById('broadcastOverlay');
    if (overlay) {
        overlay.addEventListener('click', hideBroadcastOverlay);
    }
}

// 加载播报前缀列表：已登录走个人 API；未登录或接口异常时回退系统默认前缀公开接口
async function loadBroadcastPrefixes() {
    try {
        const base = getApiBasePath();
        let res = await fetch(base + 'api/prefixes');
        if (res.ok) {
            const data = await res.json();
            const defaults = (data.defaults || []).map(p => p.text);
            const customs = (data.customs || []).map(p => p.text);
            broadcastPrefixes = defaults.concat(customs);
            console.log('[Randamer] 已获取个人前缀列表:', broadcastPrefixes.length, '条');
            return;
        }
        // 未登录(401)或接口异常(404/500)：回退系统默认前缀公开接口
        console.warn('[Randamer] 个人前缀接口不可用 (status=' + res.status + ')，回退系统默认前缀');
        res = await fetch(base + 'api/prefixes/default');
        if (res.ok) {
            const data = await res.json();
            broadcastPrefixes = data.prefixes || [];
            console.log('[Randamer] 已获取系统默认前缀:', broadcastPrefixes.length, '条');
        } else {
            broadcastPrefixes = [];
            console.error('[Randamer] 系统默认前缀接口也失败 (status=' + res.status + ')');
        }
    } catch (e) {
        console.error('[Randamer] 加载播报前缀失败:', e);
        broadcastPrefixes = [];
    }
}

// 显示点名播报遮罩
function showBroadcastOverlay(name) {
    if (!broadcastEnabled || broadcastPrefixes.length === 0) {
        console.log('[Randamer] 播报跳过: broadcastEnabled=' + broadcastEnabled + ', prefixCount=' + broadcastPrefixes.length);
        return;
    }

    const overlay = document.getElementById('broadcastOverlay');
    const nameEl = document.getElementById('broadcastName');
    const msgEl = document.getElementById('broadcastMessage');
    if (!overlay || !nameEl || !msgEl) return;

    // 随机选一条前缀并替换 {name} 占位符
    const prefix = broadcastPrefixes[Math.floor(Math.random() * broadcastPrefixes.length)];
    const message = prefix.replaceAll('{name}', name);

    nameEl.textContent = name;
    msgEl.textContent = message;
    overlay.style.display = 'flex';
    isBroadcastOverlayVisible = true;
}

// 关闭点名播报遮罩
function hideBroadcastOverlay() {
    if (!isBroadcastOverlayVisible) return;
    const overlay = document.getElementById('broadcastOverlay');
    if (overlay) overlay.style.display = 'none';
    isBroadcastOverlayVisible = false;
}

// 初始化设置功能
function initSettings() {
    const settingsButton = document.getElementById('settings-button');
    const settingsModal = document.getElementById('settings-modal');
    const protectionPoolSizeInput = document.getElementById('protection-pool-size');
    const poolSizeValue = document.getElementById('pool-size-value');
    const localStorageCheckbox = document.getElementById('local-storage-checkbox');

    // 设置滑块的初始值
    protectionPoolSizeInput.value = protectionPoolSize;
    poolSizeValue.textContent = protectionPoolSize;
    updateSliderBackground(protectionPoolSizeInput);

    // 设置本地保存开关的初始状态
    if (localStorageCheckbox) {
        localStorageCheckbox.checked = localStorageEnabled;
        
        // 监听本地保存开关变化
        localStorageCheckbox.addEventListener('change', () => {
            localStorageEnabled = localStorageCheckbox.checked;
            saveToLocalStorage(); // 保存开关状态
            
            if (localStorageEnabled) {
                // 如果开启，立即保存当前数据
                saveToLocalStorage();
            } else {
                // 如果关闭，清除其他数据，只保留开关状态
                localStorage.setItem('localStorageEnabled', 'false');
                localStorage.removeItem('xingming');
                localStorage.removeItem('protectionPoolSize');
                localStorage.removeItem('isNamesLoaded');
            }
        });
    }

    // 滑块值变化时更新显示和设置
    protectionPoolSizeInput.addEventListener('input', () => {
        const currentValue = parseFloat(protectionPoolSizeInput.value);
        const maxSize = parseInt(protectionPoolSizeInput.max);
        const roundedValue = Math.round(currentValue);

        if (roundedValue >= 1 && roundedValue <= maxSize) {
            protectionPoolSize = roundedValue;
            poolSizeValue.textContent = roundedValue;
            updateSliderBackground(protectionPoolSizeInput);

            // 调整排除列表大小
            while (paichuleibiao.length > protectionPoolSize) {
                paichuleibiao.shift();
            }

            // 保护池更新，重新缓存可用名单
            rebuildAvailableNamesCache();

            // 更新防重复保护池显示
            updateProtectionPoolDisplay();
            
            // 保存到本地存储
            saveToLocalStorage();
        }
    });

    // 打开设置框
    settingsButton.addEventListener('click', () => {
        settingsModal.style.display = 'block';
        // 添加强制重排以确保动画生效
        settingsModal.offsetHeight;
        settingsModal.classList.add('show');
    });

    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            const settingsContent = settingsModal.querySelector('.settings-content');
            settingsContent.style.animation = 'slideOut 0.3s ease-out forwards';
            settingsModal.classList.add('hiding');
            settingsModal.classList.remove('show');
            setTimeout(() => {
                settingsModal.style.display = 'none';
                settingsModal.classList.remove('hiding');
                settingsContent.style.animation = '';
            }, 300);
        }

        const nameSelectModal = document.getElementById('nameSelectModal');
        if (nameSelectModal && e.target === nameSelectModal) {
            const nameSelectContent = nameSelectModal.querySelector('.name-select-content');
            nameSelectContent.style.animation = 'slideOut 0.3s ease-out forwards';
            nameSelectModal.classList.add('hiding');
            nameSelectModal.classList.remove('show');
            setTimeout(() => {
                nameSelectModal.style.display = 'none';
                nameSelectModal.classList.remove('hiding');
                nameSelectContent.style.animation = '';
            }, 300);
        }

        const qrModal = document.getElementById('qrModal');
        if (qrModal && e.target === qrModal) {
            hideQrModal();
            setTimeout(() => showNameSelectModal(), 300);
        }

        const cloudListModal = document.getElementById('cloudListModal');
        if (cloudListModal && e.target === cloudListModal) {
            hideCloudListModal();
        }
    });
}

// 更新滑块背景
function updateSliderBackground(slider) {
    const value = parseFloat(slider.value);
    const min = parseInt(slider.min) || 0;
    const max = parseInt(slider.max);
    const percentage = ((value - min) / (max - min)) * 100;

    // 只使用默认颜色
    const color = '#45f3ff';
    slider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percentage}%, #1c1c1c ${percentage}%, #1c1c1c 100%)`;
}

let fanyebeikaiguan = true; // 标记翻页笔遥控开关的状态
document.getElementById('fanyebeikaiguan-checkbox').addEventListener('change', () => {
    const fanyebeikaiguanCheckbox = document.getElementById('fanyebeikaiguan-checkbox');
    const fanyebeikaiguanText = document.getElementById('fanyebeikaiguan-text');

    if (fanyebeikaiguanCheckbox.checked) {
        fanyebeikaiguan = true;
        fanyebeikaiguanText.textContent = '翻页笔遥控已开启';
        // 重新添加键盘事件监听器
        document.addEventListener('keydown', handleKeyDown);
        // 显示提示弹窗
        showCustomAlert('您可以按下翻页笔上的"下一页"按钮来开始/停止随机点名。', '翻页笔遥控');
    } else {
        fanyebeikaiguan = false;
        fanyebeikaiguanText.textContent = '翻页笔遥控已关闭';
        // 移除键盘事件监听器
        document.removeEventListener('keydown', handleKeyDown);
    }
});

// 定义键盘事件处理函数
function handleKeyDown(event) {
    // 点名播报遮罩显示时：任意键关闭遮罩，不触发其他按键行为
    if (isBroadcastOverlayVisible) {
        hideBroadcastOverlay();
        return;
    }
    // 按下 PageDown、ArrowRight 或 ArrowDown 键时模拟按下按钮
    if (event.key === 'PageDown' || event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        if (shifouzaiyunxing) {
            document.getElementById('tingzhianniu').click();
        } else {
            document.getElementById('kaishianniu').click();
        }
    }
}

// 编辑名单弹窗相关变量
let editNamesModal = document.getElementById('editNamesModal');
let editNamesCardsContainer = document.getElementById('editNamesCardsContainer');
let saveNamesBtn = document.getElementById('saveNamesBtn');
let cancelEditNamesBtn = document.getElementById('cancelEditNamesBtn');
let addNameBtn = document.getElementById('addNameBtn');
let closeEditNamesBtn = document.getElementById('closeEditNamesBtn');
let batchSelectBtn = document.getElementById('batchSelectBtn');
let batchOperations = document.getElementById('batchOperations');
let singleOperations = document.getElementById('singleOperations');
let batchDeleteBtn = document.getElementById('batchDeleteBtn');
let cancelBatchBtn = document.getElementById('cancelBatchBtn');
let clearAllNamesBtn = document.getElementById('clearAllNamesBtn');
let batchAddNamesBtn = document.getElementById('batchAddNamesBtn');
let batchAddNamesModal = document.getElementById('batchAddNamesModal');
let batchAddNamesInput = document.getElementById('batchAddNamesInput');
let cancelBatchAddBtn = document.getElementById('cancelBatchAddBtn');
let confirmBatchAddBtn = document.getElementById('confirmBatchAddBtn');

let batchSelectMode = false;
let selectedCards = new Set();

// HTML 转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

    if (!isValidNameLength(name)) {
        showCustomAlert(`姓名长度需为 ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} 个字`);
        return;
    }

    // 检查是否重复
    const currentNames = getCurrentEditNames();
    if (currentNames.includes(name)) {
        showCustomAlert('该姓名已存在');
        return;
    }

    if (currentNames.length >= MAX_NAMES_COUNT) {
        showCustomAlert(`名单人数已达上限 (${MAX_NAMES_COUNT} 人)`);
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

        if (!isValidNameLength(newName)) {
            showCustomAlert(`姓名长度需为 ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} 个字`);
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

// 计算名单更改内容
function calculateNameChanges(newNames) {
    const oldNames = [...xingming];
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

// 保存编辑后的名单
function saveEditedNames() {
    const newNames = getCurrentEditNames();
    if (newNames.length === 0) {
        showCustomAlert('请输入至少一个有效的姓名');
        return;
    }

    // 名单人数上限校验
    if (newNames.length > MAX_NAMES_COUNT) {
        showCustomAlert(`名单人数超过上限 (${MAX_NAMES_COUNT} 人)`);
        return;
    }

    // 名字长度校验
    const invalidName = newNames.find(name => !isValidNameLength(name));
    if (invalidName) {
        showCustomAlert(`名字「${invalidName}」长度不合规（需 ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} 个字）`);
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
    const confirmMessage = `修改名单将重置保护池，是否继续？<br/>
<div style="font-size: 13px; color: #888; margin: 10px 0;">共 ${changes.removed.length + changes.added.length} 处更改：</div>
${changesHTML}`;

    showCustomConfirm(confirmMessage, (confirmed) => {
        if (!confirmed) {
            return;
        }

        // 更新名单
        xingming = newNames;
        isNamesLoaded = true;

        // 清空保护池
        paichuleibiao = [];
        rebuildAvailableNamesCache(); // 保护池更新，重新缓存可用名单
        updateProtectionPoolDisplay();

        // 保存到本地存储
        saveToLocalStorage();

        // 更新滑块的最大值为总人数
        updateSliderMax();

        // 更新显示
        const xingmingxianshi = document.getElementById('xingmingxianshi');
        if (xingmingxianshi && xingming.length > 0) {
            xingmingxianshi.textContent = '名单已更新';
        }

        // 更新按钮状态（启用按钮）
        updateButtonState();

        // 通知服务端名单已获取
        if (socket && socket.readyState === WebSocket.OPEN && yuanchengma) {
            wsSend({ type: 'is_names_geted', code: yuanchengma, is_geted: true });
        }

        // 关闭弹窗
        closeEditNamesModal();
    });
}

// 打开编辑名单弹窗
function openEditNamesModal() {
    // 初始化时将当前名单加载到卡片容器
    editNamesCardsContainer.innerHTML = '';
    xingming.forEach((name, index) => {
        const card = createEditNameCard(name, index);
        editNamesCardsContainer.appendChild(card);
    });

    // 重置多选模式
    batchSelectMode = false;
    selectedCards.clear();
    updateBatchModeUI();

    editNamesModal.style.display = 'flex';
    editNamesModal.offsetHeight;
    editNamesModal.classList.add('show');
}

// 关闭编辑名单弹窗
function closeEditNamesModal() {
    const panel = editNamesModal.querySelector('.edit-names-panel');
    panel.style.animation = 'slideOut 0.3s ease-out forwards';
    editNamesModal.classList.add('hiding');
    editNamesModal.classList.remove('show');
    setTimeout(() => {
        editNamesModal.style.display = 'none';
        editNamesModal.classList.remove('hiding');
        panel.style.animation = '';
    }, 300);
}

// 打开批量添加名字弹窗
function openBatchAddNamesModal() {
    batchAddNamesInput.value = '';
    batchAddNamesModal.style.display = 'flex';
    batchAddNamesModal.offsetHeight;
    batchAddNamesModal.classList.add('show');
    setTimeout(() => batchAddNamesInput.focus(), 100);
}

// 关闭批量添加名字弹窗
function closeBatchAddNamesModal() {
    const panel = batchAddNamesModal.querySelector('.prompt-panel');
    panel.style.animation = 'slideOut 0.3s ease-out forwards';
    batchAddNamesModal.classList.add('hiding');
    batchAddNamesModal.classList.remove('show');
    setTimeout(() => {
        batchAddNamesModal.style.display = 'none';
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

    // 过滤掉重复和长度不合规的名字
    const newNames = [];
    const duplicates = [];
    const invalidLengths = [];
    names.forEach(name => {
        if (currentNamesSet.has(name)) {
            duplicates.push(name);
        } else if (!isValidNameLength(name)) {
            invalidLengths.push(name);
        } else {
            newNames.push(name);
            currentNamesSet.add(name);
        }
    });

    // 数量上限：最多补充到 MAX_NAMES_COUNT
    const remainingSlots = MAX_NAMES_COUNT - currentNames.length;
    let overflowCount = 0;
    if (newNames.length > remainingSlots) {
        overflowCount = newNames.length - remainingSlots;
        newNames.length = Math.max(0, remainingSlots);
    }

    // 汇总跳过原因
    const skipMessages = [];
    if (duplicates.length > 0) {
        skipMessages.push(`以下名字已存在，已自动跳过：\n${duplicates.slice(0, 10).join('\n')}${duplicates.length > 10 ? `\n...等 ${duplicates.length} 个` : ''}`);
    }
    if (invalidLengths.length > 0) {
        skipMessages.push(`以下名字长度不合规（需 ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} 个字），已自动跳过：\n${invalidLengths.slice(0, 10).join('\n')}${invalidLengths.length > 10 ? `\n...等 ${invalidLengths.length} 个` : ''}`);
    }
    if (overflowCount > 0) {
        skipMessages.push(`名单人数已达上限 (${MAX_NAMES_COUNT} 人)，仅添加前 ${newNames.length} 个，剩余 ${overflowCount} 个被跳过`);
    }
    if (skipMessages.length > 0) {
        showCustomAlert(skipMessages.join('\n\n'));
    }

    // 添加新名字到列表
    newNames.forEach(name => {
        const card = createEditNameCard(name, currentNames.length);
        editNamesCardsContainer.appendChild(card);
    });

    closeBatchAddNamesModal();
    showCustomAlert(`成功添加 ${newNames.length} 个名字`);
}

// 初始化编辑名单弹窗事件
function initEditNamesModal() {
    // 将"手动输入名单"选项绑定到编辑名单弹窗
    const manualInputOption = document.getElementById('manualInputOption');
    if (manualInputOption) {
        manualInputOption.addEventListener('click', () => {
            hideNameSelectModal();
            setTimeout(() => openEditNamesModal(), 300);
        });
    }

    // 保存按钮
    if (saveNamesBtn) {
        saveNamesBtn.addEventListener('click', saveEditedNames);
    }

    // 取消按钮
    if (cancelEditNamesBtn) {
        cancelEditNamesBtn.addEventListener('click', closeEditNamesModal);
    }

    // 关闭按钮
    if (closeEditNamesBtn) {
        closeEditNamesBtn.addEventListener('click', closeEditNamesModal);
    }

    // 添加名字按钮
    if (addNameBtn) {
        addNameBtn.addEventListener('click', handleAddName);
    }

    // 多选按钮
    if (batchSelectBtn) {
        batchSelectBtn.addEventListener('click', toggleBatchSelectMode);
    }

    // 批量删除按钮
    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', batchDeleteSelected);
    }

    // 取消多选按钮
    if (cancelBatchBtn) {
        cancelBatchBtn.addEventListener('click', cancelBatchMode);
    }

    // 清空名单按钮
    if (clearAllNamesBtn) {
        clearAllNamesBtn.addEventListener('click', clearAllNames);
    }

    // 点击背景关闭
    if (editNamesModal) {
        editNamesModal.addEventListener('click', (e) => {
            if (e.target === editNamesModal) {
                closeEditNamesModal();
            }
        });
    }

    // 批量添加按钮
    if (batchAddNamesBtn) {
        batchAddNamesBtn.addEventListener('click', openBatchAddNamesModal);
    }

    // 批量添加弹窗取消按钮
    if (cancelBatchAddBtn) {
        cancelBatchAddBtn.addEventListener('click', closeBatchAddNamesModal);
    }

    // 批量添加弹窗确认按钮
    if (confirmBatchAddBtn) {
        confirmBatchAddBtn.addEventListener('click', batchAddNames);
    }

    // 批量添加弹窗背景关闭
    if (batchAddNamesModal) {
        batchAddNamesModal.addEventListener('click', (e) => {
            if (e.target === batchAddNamesModal) {
                closeBatchAddNamesModal();
            }
        });
    }

    // 批量添加弹窗 Ctrl+Enter 快捷键
    if (batchAddNamesInput) {
        batchAddNamesInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                batchAddNames();
            }
        });
    }

    // ESC 键关闭弹窗
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (batchAddNamesModal && batchAddNamesModal.classList.contains('show')) {
                closeBatchAddNamesModal();
            } else if (editNamesModal && editNamesModal.classList.contains('show')) {
                closeEditNamesModal();
            }
        }
    });
}

// 在 DOMContentLoaded 时初始化编辑名单弹窗事件
document.addEventListener('DOMContentLoaded', () => {
    initEditNamesModal();
    initSaveCloudNamesModal();
});

// 保存到云名单相关变量
let saveCloudSaveMode = null;
let saveCloudSelectedListId = null;

// 获取EasyCore API路径
function getEasyCoreApiPath() {
    return 'https://easyclass.zhrhello.top/easycore/';
}

// HTML转义
function escapeHtmlForSaveCloud(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// 初始化保存云名单弹窗事件
function initSaveCloudNamesModal() {
    const saveCloudNamesBtn = document.getElementById('saveCloudNamesBtn');
    const createNewListOption = document.getElementById('createNewListOption');
    const overwriteListOption = document.getElementById('overwriteListOption');
    const newListNameInput = document.getElementById('newListNameInput');
    const cancelSaveCloudBtn = document.getElementById('cancelSaveCloudBtn');
    const confirmSaveCloudBtn = document.getElementById('confirmSaveCloudBtn');
    const saveCloudNamesModal = document.getElementById('saveCloudNamesModal');

    if (saveCloudNamesBtn) {
        saveCloudNamesBtn.addEventListener('click', openSaveCloudNamesModal);
    }

    if (createNewListOption) {
        createNewListOption.addEventListener('click', handleSelectNewListMode);
    }

    if (overwriteListOption) {
        overwriteListOption.addEventListener('click', handleSelectOverwriteMode);
    }

    if (newListNameInput) {
        newListNameInput.addEventListener('input', updateSaveCloudConfirmButton);
    }

    if (cancelSaveCloudBtn) {
        cancelSaveCloudBtn.addEventListener('click', closeSaveCloudNamesModal);
    }

    if (confirmSaveCloudBtn) {
        confirmSaveCloudBtn.addEventListener('click', handleConfirmSaveCloud);
    }

    if (saveCloudNamesModal) {
        saveCloudNamesModal.addEventListener('click', (e) => {
            if (e.target === saveCloudNamesModal) {
                closeSaveCloudNamesModal();
            }
        });
    }

    // 更新用户头像时同步显示/隐藏云保存按钮
    const originalUpdateUserAvatar = updateUserAvatar;
    if (typeof originalUpdateUserAvatar === 'function') {
        updateUserAvatar = function() {
            originalUpdateUserAvatar();
            const btn = document.getElementById('saveCloudNamesBtn');
            if (btn) {
                if (isLoggedIn) {
                    btn.classList.remove('hidden');
                } else {
                    btn.classList.add('hidden');
                }
            }
        };
        // 初始化时调用一次
        updateUserAvatar();
    }
}

// 打开保存云名单弹窗
function openSaveCloudNamesModal() {
    if (!isLoggedIn) {
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
    document.getElementById('createNewListOption').classList.remove('selected');
    document.getElementById('overwriteListOption').classList.remove('selected');

    const modal = document.getElementById('saveCloudNamesModal');
    modal.style.display = 'flex';
    modal.offsetHeight;
    modal.classList.add('show');
}

// 关闭保存云名单弹窗
function closeSaveCloudNamesModal() {
    const modal = document.getElementById('saveCloudNamesModal');
    const promptPanel = modal.querySelector('.prompt-panel');
    promptPanel.style.animation = 'slideOut 0.3s ease-out forwards';
    modal.classList.add('hiding');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('show');
        modal.classList.remove('hiding');
        promptPanel.style.animation = '';
    }, 300);
}

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
            <div class="save-cloud-list-item" data-list-id="${escapeHtmlForSaveCloud(list.list_id)}" onclick="selectExistingList('${escapeHtmlForSaveCloud(list.list_id)}', this)">
                <div class="save-cloud-list-name">${escapeHtmlForSaveCloud(list.name)}</div>
                <div class="save-cloud-list-info">${escapeHtmlForSaveCloud(list.item_count || 0)}人</div>
            </div>
        `).join('');

    } catch (error) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);">加载失败：' + escapeHtmlForSaveCloud(error.message) + '</div>';
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

    // 名单人数上限校验（与云端 EasyCore 一致）
    if (names.length > MAX_NAMES_COUNT) {
        showCustomAlert(`名单人数超过上限 (${MAX_NAMES_COUNT} 人)，无法保存到云端`, '提示');
        return;
    }

    // 名字长度校验
    const invalidName = names.find(name => !isValidNameLength(name));
    if (invalidName) {
        showCustomAlert(`名字「${invalidName}」长度不合规（需 ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} 个字），无法保存到云端`, '提示');
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
