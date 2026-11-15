/* ==========================================================================
 * 易排座 · 职位（组长 / 副组长 / …）设置
 * 职位与「人」绑定（姓名 -> 职位），随排座结果一起存进 arrangement.roles，
 * 因此换座、重新随机排座都不会把职位弄丢。
 * ========================================================================== */

import { editMode, nameBySeatId, roleByName } from './state.js';
import { paintSeat } from './seat.js';
import { saveArrangement } from './arrange.js';
import { showMenu } from './menu.js';
import { toast } from './ui.js';

  export const ROLE_PRESETS = ['组长', '副组长', '课代表'];
  export const MAX_ROLE_LENGTH = 10;

  export function roleOfSeat(seat) {
    const name = seat ? nameBySeatId.get(seat.id) : '';
    return name ? (roleByName.get(name) || '') : '';
  }

  // 写入职位并立即保存（空字符串 = 清除）。保存失败不还原本地状态：
  // arrangement 的写入有同步通道，下一轮远端快照会把它纠正回来。
  export async function setSeatRole(seat, role) {
    const name = seat ? nameBySeatId.get(seat.id) : '';
    if (!name) return false;

    const text = String(role || '').trim().slice(0, MAX_ROLE_LENGTH);
    if (text) roleByName.set(name, text);
    else roleByName.delete(name);

    paintSeat(seat);

    const doneMsg = text
      ? '已把「' + text + '」设为 ' + name + ' 的职位'
      : '已清除 ' + name + ' 的职位';
    return saveArrangement(doneMsg);
  }

  function promptCustomRole(seat) {
    const name = nameBySeatId.get(seat.id) || '';
    const current = roleOfSeat(seat);
    const input = prompt('设置「' + name + '」的职位（留空表示清除，最多 '
                         + MAX_ROLE_LENGTH + ' 个字）：', current);
    if (input === null) return;          // 取消
    setSeatRole(seat, input);
  }

  // 在画布坐标处弹出职位菜单（排座模式右键 / 长按菜单里都能进）
  export function openRoleMenu(seat, x, y) {
    if (editMode) return;                // 格局编辑模式下座位没有姓名，无职位可言
    const name = nameBySeatId.get(seat.id);
    if (!name) { toast('这个座位还没有排人', true); return; }

    const current = roleOfSeat(seat);
    const items = ROLE_PRESETS.map(role => ({
      label: '设为「' + role + '」' + (current === role ? '（当前）' : ''),
      onClick: () => { if (current !== role) setSeatRole(seat, role); }
    }));
    items.push({ label: '自定义职位…', onClick: () => promptCustomRole(seat) });
    if (current) {
      items.push({ label: '清除职位', danger: true, onClick: () => setSeatRole(seat, '') });
    }
    items.push({ label: '当前：' + name + (current ? '（' + current + '）' : '（无职位）'), note: true });

    showMenu(x, y, items);
  }
