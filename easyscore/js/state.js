// 易积分 · 共享状态
export const state = {
  tableId: null,          // 当前积分表 id（URL ?score_id=）
  table: null,            // 积分表配置（含 balances）
  balances: [],           // 按拼音排序后的学生余额列表
  activeTab: 'operate',   // overview | operate | ledger
  batchMode: false,
  selectedItems: new Set(),  // 选中的 item_id 集合
  drafts: new Map(),         // item_id -> { kind, value, reason }（取消关闭保留的草稿）
  connId: null,              // WS hello 下发的连接 id
};
