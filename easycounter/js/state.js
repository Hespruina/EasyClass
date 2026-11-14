// 应用状态（计票数据是云端快照在内存里的投影，浏览器不落盘）
let appState = {
    votes: {},
    totalVotes: 0,
    touchMode: Storage.get('touchMode', 'mouse'),
    searchMode: Storage.get('searchMode', 'permanent'), // 'permanent' 或 'modal'
    namesData: [], // 从云端快照获取的排序后数据
    groupedByLetter: {},
    availableLetters: []
};
// 当前打开的计票任务 id；null = 停在任务列表页（键盘快捷键 / 写操作都要判它）
let currentTaskId = null;
let sessionState = {
    suppressMismatchPrompt: false,
    modalJustOpened: false
};
let activeTouches = new Map();
let lastRankOrder = [];
let rankItemMap = new Map();
// DOM 元素
const nameInputScreen = document.getElementById('nameInputScreen');
const mainApp = document.getElementById('mainApp');
const grid = document.getElementById('voteGrid');
const rankList = document.getElementById('rankList');
const totalEl = document.getElementById('totalScore');
const rankPanel = document.getElementById('rankPanel');
const resizeHandle = document.getElementById('resizeHandle');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const resetDataBtn = document.getElementById('resetDataBtn');
const modeMouseBtn = document.getElementById('modeMouse');
const modeTouchBtn = document.getElementById('modeTouch');
const searchPermanentBtn = document.getElementById('searchPermanent');
const searchModalBtn = document.getElementById('searchModal');
const themeSystemBtn = document.getElementById('themeSystem');
const themeLightBtn = document.getElementById('themeLight');
const themeDarkBtn = document.getElementById('themeDark');
const searchBtn = document.getElementById('searchBtn');
const letterSearchModal = document.getElementById('letterSearchModal');
const letterGrid = document.getElementById('letterGrid');
const quickSearchContainer = document.getElementById('quickSearchContainer');
const quickSearchGrid = document.getElementById('quickSearchGrid');
const inputModeModal = document.getElementById('inputModeModal');
const selectTouchMode = document.getElementById('selectTouchMode');
const selectMouseMode = document.getElementById('selectMouseMode');
const confirmInputModeBtn = document.getElementById('confirmInputModeBtn');
const modeMismatchModal = document.getElementById('modeMismatchModal');
const modeMismatchText = document.getElementById('modeMismatchText');
const keepCurrentModeBtn = document.getElementById('keepCurrentModeBtn');
const switchModeBtn = document.getElementById('switchModeBtn');
const suppressMismatchPromptCheckbox = document.getElementById('suppressMismatchPrompt');
const editNamesBtn = document.getElementById('editNamesBtn');
const editNamesModal = document.getElementById('editNamesModal');
const editNamesCardsContainer = document.getElementById('editNamesCardsContainer');
const saveNamesBtn = document.getElementById('saveNamesBtn');
const cancelEditNamesBtn = document.getElementById('cancelEditNamesBtn');
const addNameBtn = document.getElementById('addNameBtn');
const closeEditNamesBtn = document.getElementById('closeEditNamesBtn');
const batchSelectBtn = document.getElementById('batchSelectBtn');
const batchOperations = document.getElementById('batchOperations');
const singleOperations = document.getElementById('singleOperations');
const batchDeleteBtn = document.getElementById('batchDeleteBtn');
const cancelBatchBtn = document.getElementById('cancelBatchBtn');
const clearAllNamesBtn = document.getElementById('clearAllNamesBtn');
const finishBtn = document.getElementById('finishBtn');
const posterBox = document.getElementById('posterBox');

// 海报编辑页面DOM元素
const posterEditModal = document.getElementById('posterEditModal');
const closePosterEditBtn = document.getElementById('closePosterEditBtn');
const posterPreviewImage = document.getElementById('posterPreviewImage');
const posterTitleInput = document.getElementById('posterTitleInput');
const posterTitleColor = document.getElementById('posterTitleColor');
const posterTitleColorValue = document.getElementById('posterTitleColorValue');
const posterBgColor = document.getElementById('posterBgColor');
const posterBgColorValue = document.getElementById('posterBgColorValue');
const posterRankColor = document.getElementById('posterRankColor');
const posterRankColorValue = document.getElementById('posterRankColorValue');
const posterScoreColor = document.getElementById('posterScoreColor');
const posterScoreColorValue = document.getElementById('posterScoreColorValue');
const posterTopCount = document.getElementById('posterTopCount');
const posterTopCountValue = document.getElementById('posterTopCountValue');
const regeneratePosterBtn = document.getElementById('regeneratePosterBtn');
const downloadPosterBtn = document.getElementById('downloadPosterBtn');
const posterThemeSelect = document.getElementById('posterThemeSelect');

// 导出方式选择弹窗DOM元素
const exportModal = document.getElementById('exportModal');
const exportExcelOption = document.getElementById('exportExcelOption');
const exportPosterOption = document.getElementById('exportPosterOption');
const exportBothOption = document.getElementById('exportBothOption');
const cancelExportBtn = document.getElementById('cancelExportBtn');

// 通用弹窗DOM元素
const customAlertModal = document.getElementById('customAlertModal');
const customAlertTitle = document.getElementById('customAlertTitle');
const customAlertText = document.getElementById('customAlertText');
const customAlertBtn = document.getElementById('customAlertBtn');
const customConfirmModal = document.getElementById('customConfirmModal');
const customConfirmTitle = document.getElementById('customConfirmTitle');
const customConfirmText = document.getElementById('customConfirmText');
const customConfirmOkBtn = document.getElementById('customConfirmOkBtn');
const customConfirmCancelBtn = document.getElementById('customConfirmCancelBtn');

