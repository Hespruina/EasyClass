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
  // 当前表是否「加分直接抵消扣分」（offset_mode = 'direct'），由 main.js 的 applyTable 写入。
  // 该模式下两池不会同时非零（每笔落库立刻对冲），所以正分/负分只有一个有值：
  // 界面统一按单值展示——卡片只显示一个数，总览只出总分榜。
  // 特意存成对象字段而不是新导出一个函数：静态资源走 CDN 时，部署瞬间可能出现
  // 「新 JS + 旧 state.js」，跨模块 import 少一个导出会直接抛 SyntaxError 整页白屏；
  // 读对象字段最坏只是 undefined（退回两榜），不会炸。
  directOffset: false,
};
