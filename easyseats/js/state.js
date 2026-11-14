/* ==========================================================================
 * 易排座 · 共享状态：常量、模式参数、DOM 引用、跨模块可变状态与派生判断
 * 拆分自原 index.html 内联脚本，逻辑逐字保留。
 * ========================================================================== */

  /* ==================== 常量 ==================== */
  export const SEAT = 46;
  export const CELL = 56;
  export const PAD  = (CELL - SEAT) / 2;
  export const GROUP_COLORS = ['#e57373','#64b5f6','#81c784','#ffb74d','#ba68c8',
                        '#4db6ac','#f06292','#9575cd','#aed581','#4fc3f7',
                        '#ffd54f','#a1887f'];
  export const MIN_SCALE = 0.25;
  export const MAX_SCALE = 4;
  export const WORLD_MARGIN = 4000;

  // EasyCore 云端接口（同源，Cookie 直接带上）
  export const API_BASE = '/easycore/api';
  export const CONSOLE_URL = '/easycore/?tab=seats';
  // 保存按钮的原始内容（SVG + 文案）在 DOM 就绪后抓取，保存失败 / 完成时用它还原
  export let SAVE_LABEL = '';

  // 本机这条座位表同步 WS 连接的 id（服务端 hello 下发）。写格局 / 排座结果的
  // 请求把它带给服务端，广播据此跳过本机连接，不回声。同步逻辑见 js/sync.js。
  export let wsConnId = null;

  /* ==================== 模式 ==================== */
  export const params = new URLSearchParams(window.location.search);
  // 当前选项卡。带 ?mode=edit_cloud_seats_set&cloud_seats_id=X 进来停在「格局编辑」，
  // 其余情况（排座位入口）直接进入「排座位」，并且默认就是手动排座。
  // 用 id 而非一次性 code，长时间编排不会超时。
  export let editMode = params.get('mode') === 'edit_cloud_seats_set';
  export const initChartId = parseInt(params.get('cloud_seats_id') || '0', 10) || 0;

  /* ==================== DOM ==================== */
  export const canvas      = document.getElementById('canvas');
  export const world       = document.getElementById('world');
  export const bottomBar   = document.getElementById('bottomBar');
  export const seatSource  = document.getElementById('seatSource');
  export const zoomHint    = document.getElementById('zoomHint');
  export const ribbon      = document.getElementById('ribbon');
  export const tabSeat     = document.getElementById('tabSeat');
  export const tabLayout   = document.getElementById('tabLayout');
  export const gridSwitchWrap = document.getElementById('gridSwitchWrap');
  export const manualGroupBtn = document.getElementById('manualGroupBtn');
  export const manualActions  = document.getElementById('manualActions');
  export const finishBtn   = document.getElementById('finishBtn');
  export const cancelBtn   = document.getElementById('cancelBtn');
  export const fillSeatsBtn = document.getElementById('fillSeatsBtn');
  export const allowEmptyBtn = document.getElementById('allowEmptyBtn');
  export const saveBtn     = document.getElementById('saveBtn');
  export const backBtn     = document.getElementById('backBtn');
  export const arrangeBtn  = document.getElementById('arrangeBtn');
  export const reloadBtn   = document.getElementById('reloadBtn');
  export const chartSelect = document.getElementById('chartSelect');
  export const seatCountHint = document.getElementById('seatCountHint');
  export const groupOverviewBtn = document.getElementById('groupOverviewBtn');
  export const groupPanel  = document.getElementById('groupPanel');
  export const groupPanelBody = document.getElementById('groupPanelBody');
  export const groupPanelClose = document.getElementById('groupPanelClose');
  export const gpTitle     = document.getElementById('gpTitle');
  export const notice      = document.getElementById('notice');
  export const noticeTitle = document.getElementById('noticeTitle');
  export const noticeText  = document.getElementById('noticeText');
  export const noticeGoBtn = document.getElementById('noticeGoBtn');
  export const noticeReloadBtn = document.getElementById('noticeReloadBtn');
  export const loadingEl   = document.getElementById('loading');
  export const loadingText = document.getElementById('loadingText');
  export const toastEl     = document.getElementById('toast');
  export const clearNamesBtn  = document.getElementById('clearNamesBtn');
  export const exportBtn      = document.getElementById('exportBtn');
  export const namePicker  = document.getElementById('namePicker');
  export const namePickerClose = document.getElementById('namePickerClose');
  export const npTitle     = document.getElementById('npTitle');
  export const npSub       = document.getElementById('npSub');
  export const npSearch    = document.getElementById('npSearch');
  export const npBody      = document.getElementById('npBody');
  export const toastText   = document.getElementById('toastText');
  export const opHintMouse = document.getElementById('opHintMouse');
  export const opHintTouch = document.getElementById('opHintTouch');

  // 实时同步状态（底栏，js/sync.js 维护）
  export const syncStatus  = document.getElementById('syncStatus');

  // 手动排座搜索（ribbon「搜索」按钮 + 画布顶部浮动搜索条，js/search.js）
  export const searchBtn   = document.getElementById('searchBtn');
  export const seatSearch  = document.getElementById('seatSearch');
  export const seatSearchInput = document.getElementById('seatSearchInput');
  export const seatSearchResults = document.getElementById('seatSearchResults');
  export const seatSearchClose = document.getElementById('seatSearchClose');

  /* ==================== 状态 ==================== */
  export let seats = [];                 // {id, x, y, col, row, groupId, el}
  export let groups = [];                // {id, name, color}
  export let seatSeq = 0;
  export let groupSeq = 0;
  export let nameBySeatId = new Map();   // 排座结果：座位 id -> 姓名

  export let gridAlign = true;
  export let manualGrouping = false;
  export let manualSelected = new Set();

  // 手动排座（仅排座模式）：点座位 → 选人 / 换座
  export let manualSeating = false;
  export let pickedSeat = null;        // 当前点中的座位（picked 高亮）
  export let swapSourceSeat = null;    // 换座源：已点「与其他同学换座」，等第二个座位
  export let pickerSeat = null;        // 正在为哪个座位挑名字
  export let seatFlying = false;       // 飞行动画进行中，期间锁住点击
  export let highlightedGroupId = null;

  export let currentMenu = null;

  export let scale = 1;
  export let offsetX = 0;
  export let offsetY = 0;

  // 云端数据
  export let chart = null;               // 当前座位表（含 list_name / list_item_count / has_layout / allow_empty 等）
  export let chartList = [];             // 排座模式的座位表列表
  export let listItems = [];             // 绑定名单的名单项 [{name, gender}]
  export let cloudLoaded = false;        // 是否已成功加载一个「可用于操作」的座位表

  /* ---------- 「允许空座」规则 ---------- */

  // 缺省按「允许」处理，和后端 seats_db.seats_fit() 的默认值保持一致
  export function allowEmptySeats() { return !chart || chart.allow_empty !== false; }

  // 座位数是否满足名单人数（与后端 seats_db.seats_fit 同一条规则）
  export function seatsFitFor(allowEmpty, seatN, itemN) {
    return allowEmpty ? seatN >= itemN : seatN === itemN;
  }
  export function seatsFit(seatN, itemN) { return seatsFitFor(allowEmptySeats(), seatN, itemN); }

  export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ================================================================
   *  触屏手势总控
   *   单指落在座位  → 移动座位（仅编辑模式；座位自己的 handler 负责）
   *   单指落在空白  → 编辑模式拉出选框；排座模式平移画布
   *   双指          → 平移画布 + 捏合缩放
   *   手势粘连      → 双指退化成单指后，剩下的那根手指不接管任何操作，
   *                    必须全部抬起再重新落下，避免松手瞬间画布 / 座位乱跳。
   *  实现要点：一律用 e.touches 而不是自维护的触点表 —— 落在座位上的手指会被
   *  座位 handler stopPropagation 掉，自己数会漏一个，而 e.touches 永远是全屏触点全集。
   * ================================================================ */

  export let pinch = null;           // { dist, scale, midX, midY, ox, oy }
  export let twoFinger = false;      // 本轮触摸里出现过双指（粘连标志）
  export let marquee = null;         // 进行中的框选
  export let cancelSeatDrag = null;  // 进行中的座位拖拽的「撤销」句柄
  export let touchPan = null;        // 进行中的单指平移（排座模式）

  /* ================================================================
   *  一键铺座：把缺的座位按 6 列网格补齐
   *  （新建的座位表要从 0 个摆到名单人数个，纯手拖太费劲；已有座位不动）
   * ================================================================ */

  export const FILL_COLS = 6;

  export let toastTimer = null;

  /* ---------- 选人面板 ---------- */
  export let npCurrent = [];   // 面板里当前渲染出的名单（点击按 idx 取名字，避开属性里的引号问题）

  /* ---------- 拖动学生换座（排座模式） ----------
   * 排座位下按住一个有人的座位拖到另一个座位松手：
   *   目标有人 → 两人互换；目标空座 → 直接搬过去（「空座」是允许空座模式下的常态）
   * 只拖「名字」，座位格局不动；拖到空白处松手 = 取消。
   * 状态放在 dragSwap 里，鼠标与触屏共用同一套。
   * ------------------------------------------------------------ */
  export let dragSwap = null;   // { from, ghost, target }

  /* ================================================================
   *  导出 A4 座位表图片（手动排座模式）
   *  纯 Canvas 绘制，不依赖任何外部库：
   *    · 纯白背景 + 浅灰描边座位 + 深色姓名，打印 / 投屏都清晰
   *    · 按 A4 纸张比例（210×297mm）出图，根据座位整体形状自动选横版 / 竖版
   *    · 内容整体居中缩放，姓名自动折行缩放字号
   * ================================================================ */

  export const A4_SHORT = 1240;                                  // A4 短边像素（≈150dpi）
  export const A4_LONG  = Math.round(A4_SHORT * 297 / 210);      // A4 长边像素
  export const EXPORT_FONT = '"Noto Sans SC","PingFang SC","Microsoft YaHei","Helvetica Neue",Arial,sans-serif';

  /* ================================================================
   *  模式：排座位 ⇄ 格局编辑
   *  · 进「排座位」= 直接就是手动排座（点座位选名字 / 换座），不用再点一次开关
   *  · 「格局编辑」负责摆座位、分组、吸附，两者用顶部选项卡切换
   * ================================================================ */

  export let savedLayoutSignature = '';   // 已加载 / 已保存的格局指纹，用来判断有没有未保存的改动
  export let bootToastShown = false;      // 「已进入手动排座」只提示一次

  /* ================================================================
   *  返回控制台：任何情况下都先保存一次再走
   *  · 格局编辑：把当前格局存回云端（不满足保存条件 / 保存失败时明确告知，由用户决定走不走）
   *  · 排座位：把当前排座结果再写一次（正常每次改动都已即时保存，这里只是兜底）
   * ================================================================ */

  export let leavingForConsole = false;   // 防止连点 / 保存途中重复触发

/* ---------------- 状态写入口 ---------------- */
// ES 模块的导入绑定只读，跨模块修改共享状态必须走 setter，
// 漏改会被 JS 解析器直接判为语法错误（Assignment to constant variable 的静态版本）。
export function setSaveLabel(v) { SAVE_LABEL = v; }
export function setEditMode(v) { editMode = v; }
export function setSeats(v) { seats = v; }
export function setGroups(v) { groups = v; }
export function setSeatSeq(v) { seatSeq = v; }
export function setGroupSeq(v) { groupSeq = v; }
export function setNameBySeatId(v) { nameBySeatId = v; }
export function writeGridAlign(v) { gridAlign = v; }
export function setManualGrouping(v) { manualGrouping = v; }
export function setManualSelected(v) { manualSelected = v; }
export function setManualSeating(v) { manualSeating = v; }
export function writePickedSeat(v) { pickedSeat = v; }
export function setSwapSourceSeat(v) { swapSourceSeat = v; }
export function setPickerSeat(v) { pickerSeat = v; }
export function setSeatFlying(v) { seatFlying = v; }
export function setHighlightedGroupId(v) { highlightedGroupId = v; }
export function setCurrentMenu(v) { currentMenu = v; }
export function setScale(v) { scale = v; }
export function setOffsetX(v) { offsetX = v; }
export function setOffsetY(v) { offsetY = v; }
export function setChart(v) { chart = v; }
export function setChartList(v) { chartList = v; }
export function setListItems(v) { listItems = v; }
export function setCloudLoaded(v) { cloudLoaded = v; }
export function setPinch(v) { pinch = v; }
export function setTwoFinger(v) { twoFinger = v; }
export function setMarquee(v) { marquee = v; }
export function setCancelSeatDrag(v) { cancelSeatDrag = v; }
export function setTouchPan(v) { touchPan = v; }
export function setToastTimer(v) { toastTimer = v; }
export function setNpCurrent(v) { npCurrent = v; }
export function setDragSwap(v) { dragSwap = v; }
export function setSavedLayoutSignature(v) { savedLayoutSignature = v; }
export function setBootToastShown(v) { bootToastShown = v; }
export function setLeavingForConsole(v) { leavingForConsole = v; }
export function setWsConnId(v) { wsConnId = v; }

// 「先自增再取新值」的表达式场景（原代码 seat.js 里 id || (++seatSeq)）
export function nextSeatSeq() { return ++seatSeq; }
