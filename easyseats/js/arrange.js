/* ==========================================================================
 * 易排座 · 排座算法：全班随机、组内随机、落座结果保存
 * 拆分自原 index.html 内联脚本，逻辑逐字保留。
 * ========================================================================== */

import { chart, cloudLoaded, groups, listItems, nameBySeatId, seats, setNameBySeatId } from './state.js';
import { paintSeat, updateSeatCountHint } from './seat.js';
import { collectArrangement } from './layout.js';
import { apiPost } from './api.js';
import { busyToast, toast } from './ui.js';

  /* ================================================================
   *  排座算法
   * ================================================================ */

  // 先上后下、先左后右（同一排内按 x 排序）
  export function sortSeatsByPosition(list) {
    return [...list].sort((a, b) => {
      const dy = a.y - b.y;
      if (Math.abs(dy) > 1) return dy;
      return a.x - b.x;
    });
  }

  export function shuffled(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  export function applyAssignment(pairs) {
    setNameBySeatId(new Map());
    pairs.forEach(([sid, name]) => {
      if (name) nameBySeatId.set(sid, name);
    });
    seats.forEach(paintSeat);
    updateSeatCountHint();
  }

  // 全班随机：所有名字打乱后按座位视觉顺序（上→下、左→右）依次落座
  export function arrangeWholeClass() {
    const names = shuffled(listItems.map(i => i.name));
    const ordered = sortSeatsByPosition(seats);
    applyAssignment(ordered.map((s, i) => [s.id, names[i] || '']));
  }

  // 组 → 座位分桶（「未分组」的座位单独一桶）。
  // 桶的先后按「组内最靠前的座位」决定，保证分配顺序与视觉顺序一致。
  export function seatGroupBuckets() {
    const buckets = [];
    groups.forEach(g => {
      const members = sortSeatsByPosition(seats.filter(s => s.groupId === g.id));
      if (members.length) buckets.push({ name: g.name, seats: members });
    });
    const rest = sortSeatsByPosition(seats.filter(s => !s.groupId || !groups.some(g => g.id === s.groupId)));
    if (rest.length) buckets.push({ name: '未分组', seats: rest });

    buckets.sort((a, b) => {
      const ka = a.seats[0], kb = b.seats[0];
      const dy = ka.y - kb.y;
      if (Math.abs(dy) > 1) return dy;
      return ka.x - kb.x;
    });
    return buckets;
  }

  // 组内随机排座：**学生不跨组**。
  // 每个组当前坐着的人，只在本组座位之间打乱重排；组框与组内座位划分完全不动。
  // 组内空位（新加进名单的人、之前被清空的座位）从「名单里还没排到座位的人」轮转补齐，
  // 轮转是为了不偏向任何一个组（否则前面的组会先把人吃光）。
  export function arrangeWithinGroups() {
    const buckets = seatGroupBuckets();
    const listed = new Set(listItems.map(i => i.name));

    // 1) 每个组「当前坐着的人」，顺带统计每个名字已被占用的份数
    //    （同名同姓按份数算，避免两个「张伟」被当成一个人）
    const usedCount = new Map();
    buckets.forEach(b => {
      b.names = [];
      b.seats.forEach(s => {
        const n = nameBySeatId.get(s.id);
        if (!n || !listed.has(n)) return;          // 已被移出名单的旧名字丢弃
        b.names.push(n);
        usedCount.set(n, (usedCount.get(n) || 0) + 1);
      });
    });

    // 2) 名单里有、但没排到座位的名字（按份数扣减）
    const wantCount = new Map();
    listItems.forEach(i => wantCount.set(i.name, (wantCount.get(i.name) || 0) + 1));
    const leftovers = [];
    wantCount.forEach((want, name) => {
      const used = usedCount.get(name) || 0;
      for (let k = used; k < want; k++) leftovers.push(name);
    });
    const pool = shuffled(leftovers);

    let cursor = 0;
    let progressed = true;
    while (cursor < pool.length && progressed) {
      progressed = false;
      for (const b of buckets) {
        if (cursor >= pool.length) break;
        if (b.names.length < b.seats.length) { b.names.push(pool[cursor++]); progressed = true; }
      }
    }
    const unplaced = pool.length - cursor;   // 座位不够时的剩余人数（正常不会出现）

    // 3) 组内打乱后落座
    const pairs = [];
    buckets.forEach(b => {
      const inner = shuffled(b.names);
      b.seats.forEach((s, i) => pairs.push([s.id, inner[i] || '']));
    });
    applyAssignment(pairs);
    return { groupCount: buckets.length, unplaced };
  }

  // 统一的排座结果上传：提交期间在底部提示区显示「转圈 + 正在保存修改…」
  export async function saveArrangement(doneMsg) {
    if (!cloudLoaded || !chart) { toast('请先选择一个已就绪的座位表', true); return false; }
    busyToast('正在保存修改…');
    try {
      await apiPost('/seat-charts/' + chart.chart_id + '/arrangement', { arrangement: collectArrangement() });
      toast(doneMsg || '已保存到云端');
      updateSeatCountHint();
      return true;
    } catch (err) {
      toast(err.message || '排座结果保存失败', true);
      return false;
    }
  }

  // 排座后自动保存最新结果到云端
  export async function arrangeAndSave(kind) {
    if (!cloudLoaded || !chart) { toast('请先选择一个已就绪的座位表', true); return; }
    if (!listItems.length) { toast('绑定的名单里还没有学生', true); return; }

    if (kind === 'group') {
      if (!groups.length) { toast('这个座位表还没有小组，无法组内随机排座', true); return; }
      const r = arrangeWithinGroups();
      await saveArrangement('组内随机排座完成，已保存到云端'
        + (r.unplaced ? '（有 ' + r.unplaced + ' 人没排上，座位不足）' : ''));
    } else {
      arrangeWholeClass();
      await saveArrangement('全班随机排座完成，已保存到云端');
    }
  }
