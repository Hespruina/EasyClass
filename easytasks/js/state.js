// 应用状态（任务数据是云端快照在内存里的投影，浏览器不落盘）
let appState = {
    progress: {},          // 姓名 -> 0–100
    stars: {},             // 姓名 -> 0–5（0 = 未评分）
    mode: 'percent',       // 'percent' | 'steps' | 'once'
    steps: 3,              // 分次数制的总次数（2–20）
    searchMode: Storage.get('searchMode', 'permanent'), // 'permanent' 或 'modal'
    namesData: [],         // 从云端快照获取的排序后数据
    groupedByLetter: {},
    availableLetters: []
};
// 当前打开的任务 id；null = 停在任务列表页（键盘快捷键 / 写操作都要判它）
let currentTaskId = null;
// 当前打开学生弹窗的姓名；null = 弹窗未打开
let currentStudentName = null;
// DOM 元素
const mainApp = document.getElementById('mainApp');
const grid = document.getElementById('voteGrid');
const countingTaskName = document.getElementById('countingTaskName');
const overviewList = document.getElementById('overviewList');
const overviewDoneCount = document.getElementById('overviewDoneCount');
const overviewUndoneCount = document.getElementById('overviewUndoneCount');
const overviewTotalCount = document.getElementById('overviewTotalCount');
const overviewProgressPercent = document.getElementById('overviewProgressPercent');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const resetDataBtn = document.getElementById('resetDataBtn');
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

// 学生进度 / 星级弹窗
const studentModal = document.getElementById('studentModal');
const studentModalName = document.getElementById('studentModalName');
const studentProgressRange = document.getElementById('studentProgressRange');
const studentProgressScale = document.getElementById('studentProgressScale');
const studentProgressValue = document.getElementById('studentProgressValue');
const studentProgressLabel = document.getElementById('studentProgressLabel');
const studentStepOptions = document.getElementById('studentStepOptions');
const studentOnceOptions = document.getElementById('studentOnceOptions');
const studentOnceCheckbox = document.getElementById('studentOnceCheckbox');
const studentStatusLabel = document.getElementById('studentStatusLabel');
const studentStars = document.getElementById('studentStars');
const closeStudentModalBtn = document.getElementById('closeStudentModalBtn');

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
