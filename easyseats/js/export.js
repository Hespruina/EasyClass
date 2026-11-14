/* ==========================================================================
 * 易排座 · 导出 A4 座位表图片
 * 拆分自原 index.html 内联脚本，逻辑逐字保留。
 * ========================================================================== */

import {
  A4_LONG, A4_SHORT, EXPORT_FONT, PAD, SEAT, chart, clamp, exportBtn, groups, nameBySeatId,
  seatFlying, seats
} from './state.js';
import { toast } from './ui.js';

  // 圆角矩形路径（兼容不支持 ctx.roundRect 的浏览器）
  export function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y,     x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x,     y + h, rr);
    ctx.arcTo(x,     y + h, x,     y,     rr);
    ctx.arcTo(x,     y,     x + w, y,     rr);
    ctx.closePath();
  }

  // 在座位方块里绘制姓名：按宽度折行，放不下就逐步缩字号
  export function drawSeatName(ctx, text, cx, cy, boxW, boxH) {
    const maxW = boxW * 0.84;
    const maxH = boxH * 0.84;

    let fs = Math.max(6, boxW * 0.26);
    let lines = [text];

    for (;;) {
      const perLine = Math.max(1, Math.floor(maxW / (fs * 1.04)));
      lines = [];
      for (let i = 0; i < text.length; i += perLine) {
        lines.push(text.slice(i, i + perLine));
      }
      if (lines.length * fs * 1.16 <= maxH + 0.5 || fs <= 6) break;
      fs *= 0.9;
    }

    const lineH = fs * 1.16;
    const startY = cy - (lines.length * lineH) / 2 + lineH / 2;

    ctx.save();
    ctx.font = '600 ' + fs.toFixed(2) + 'px ' + EXPORT_FONT;
    ctx.fillStyle = '#1b1f24';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((ln, i) => ctx.fillText(ln, cx, startY + i * lineH));
    ctx.restore();
  }

  // 计算某个纸张方向下的版面参数与缩放比
  export function exportMetrics(portrait, bw, bh) {
    const W = portrait ? A4_SHORT : A4_LONG;
    const H = portrait ? A4_LONG  : A4_SHORT;

    const margin = Math.round(W * 0.055);           // 页面四周留白
    const titleH = Math.round(Math.min(H * 0.11, 150)); // 顶部标题区高度

    const contentX = margin;
    const contentY = margin + titleH;
    const contentW = W - margin * 2;
    const contentH = H - contentY - margin;

    const PAD = 30;                                  // 内容与版心边界的最小间距
    let k = Math.min((contentW - PAD * 2) / bw, (contentH - PAD * 2) / bh);
    k = clamp(k, 0.15, 3.2);

    return { W, H, margin, titleH, contentX, contentY, contentW, contentH, k };
  }

  // 把当前座位表画到一张离屏 canvas 上，返回该 canvas
  export function renderSeatChartCanvas() {
    // ---- 1. 座位整体包围盒 ----
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    seats.forEach(s => {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + SEAT);
      maxY = Math.max(maxY, s.y + SEAT);
    });
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);

    // ---- 2. 选 A4 横版 / 竖版：内容明显横向铺开时用横版，否则竖版 ----
    const landscape = bw > bh * 1.25;
    const M = exportMetrics(!landscape, bw, bh);

    const cv = document.createElement('canvas');
    cv.width = M.W;
    cv.height = M.H;
    const ctx = cv.getContext('2d');

    // 纯白底
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, M.W, M.H);

    // ---- 3. 坐标换算（内容在版心内居中） ----
    const drawW = bw * M.k;
    const drawH = bh * M.k;
    const originX = M.contentX + (M.contentW - drawW) / 2 - minX * M.k;
    const originY = M.contentY + (M.contentH - drawH) / 2 - minY * M.k;
    const tx = x => originX + x * M.k;
    const ty = y => originY + y * M.k;
    const seatSize = SEAT * M.k;

    // ---- 4. 小组虚线框（画在座位下层，浅色不抢眼） ----
    groups.forEach(g => {
      const members = seats.filter(s => s.groupId === g.id);
      if (!members.length) return;

      let gx1 = Infinity, gy1 = Infinity, gx2 = -Infinity, gy2 = -Infinity;
      members.forEach(s => {
        gx1 = Math.min(gx1, tx(s.x));
        gy1 = Math.min(gy1, ty(s.y));
        gx2 = Math.max(gx2, tx(s.x) + seatSize);
        gy2 = Math.max(gy2, ty(s.y) + seatSize);
      });

      const p = Math.max(5, seatSize * 0.16);
      const x = gx1 - p, y = gy1 - p, w = gx2 - gx1 + p * 2, h = gy2 - gy1 + p * 2;

      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = g.color;
      ctx.lineWidth = Math.max(1.5, seatSize * 0.028);
      ctx.setLineDash([Math.max(5, seatSize * 0.13), Math.max(4, seatSize * 0.09)]);
      roundRectPath(ctx, x, y, w, h, Math.max(6, seatSize * 0.14));
      ctx.stroke();
      ctx.restore();

      // 组名标签：贴在框的左上角
      const fs = Math.max(10, seatSize * 0.2);
      ctx.save();
      ctx.font = '600 ' + fs.toFixed(2) + 'px ' + EXPORT_FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(g.name).width;
      const lw = tw + fs * 1.3;
      const lh = fs * 1.75;
      ctx.fillStyle = g.color;
      roundRectPath(ctx, x, y - lh / 2, lw, lh, lh / 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(g.name, x + fs * 0.65, y + 1);
      ctx.restore();
    });

    // ---- 5. 座位与姓名 ----
    const radius = Math.max(3, seatSize * 0.12);

    seats.forEach(s => {
      const x = tx(s.x), y = ty(s.y);
      const name = nameBySeatId.get(s.id) || '';

      ctx.save();
      roundRectPath(ctx, x, y, seatSize, seatSize, radius);
      if (name) {
        // 有人的座位：白底 + 实线描边
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = Math.max(1.2, seatSize * 0.028);
        ctx.strokeStyle = '#c3c8d0';
        ctx.stroke();
      } else {
        // 空座：极浅灰底 + 虚线描边
        ctx.fillStyle = '#f6f7f9';
        ctx.fill();
        ctx.lineWidth = Math.max(1, seatSize * 0.022);
        ctx.strokeStyle = '#e4e7ec';
        ctx.setLineDash([Math.max(4, seatSize * 0.08), Math.max(3, seatSize * 0.06)]);
        ctx.stroke();
      }
      ctx.restore();

      if (name) {
        drawSeatName(ctx, name, x + seatSize / 2, y + seatSize / 2, seatSize, seatSize);
      } else {
        // 空座中央一条短横线
        const half = seatSize * 0.13;
        ctx.save();
        ctx.strokeStyle = '#d8dce2';
        ctx.lineWidth = Math.max(1.4, seatSize * 0.035);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + seatSize / 2 - half, y + seatSize / 2);
        ctx.lineTo(x + seatSize / 2 + half, y + seatSize / 2);
        ctx.stroke();
        ctx.restore();
      }
    });

    // ---- 6. 页眉标题 / 页脚 ----
    const title = (chart && chart.name) ? chart.name : '座位表';
    const now = new Date();
    const arranged = seats.filter(s => nameBySeatId.get(s.id)).length;
    const emptyCount = seats.length - arranged;
    const subtitle = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日'
      + ' · 共 ' + seats.length + ' 个座位 · 已排座 ' + arranged + ' 人'
      + (emptyCount > 0 ? ' · 空座 ' + emptyCount + ' 个' : '');

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const tSize = Math.max(26, Math.min(44, M.W * 0.03));
    ctx.fillStyle = '#15181c';
    ctx.font = '600 ' + tSize.toFixed(2) + 'px ' + EXPORT_FONT;
    ctx.fillText(title, M.W / 2, M.margin + tSize * 0.85, M.W - M.margin * 2);

    const sSize = Math.max(16, Math.min(23, M.W * 0.016));
    ctx.fillStyle = '#8d939c';
    ctx.font = '400 ' + sSize.toFixed(2) + 'px ' + EXPORT_FONT;
    ctx.fillText(subtitle, M.W / 2, M.margin + tSize * 0.85 + sSize * 2.1, M.W - M.margin * 2);

    // 标题下的细分割线
    ctx.strokeStyle = '#edeff2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(M.margin, M.contentY - 16);
    ctx.lineTo(M.W - M.margin, M.contentY - 16);
    ctx.stroke();

    // 页脚
    ctx.fillStyle = '#c9ced5';
    ctx.font = '400 17px ' + EXPORT_FONT;
    ctx.fillText('易排座 · easyclass.zhrhello.top', M.W / 2, M.H - M.margin * 0.55);
    ctx.restore();

    return cv;
  }

  export function safeFileName(name) {
    return String(name).replace(/[\\/:*?"<>|\r\n\t]+/g, '_').slice(0, 80);
  }

  export async function exportSeatImage() {
    if (!seats.length) { toast('当前没有座位可以导出', true); return; }
    if (seatFlying) { toast('正在换座动画中，请稍后再导出', true); return; }

    const oldLabel = exportBtn.innerHTML;
    exportBtn.disabled = true;
    exportBtn.textContent = '生成中…';

    try {
      // 等中文字体就绪（最多等 800ms），否则可能用默认字体绘制
      await Promise.race([
        (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve(),
        new Promise(r => setTimeout(r, 800))
      ]);

      const cv = renderSeatChartCanvas();
      const blob = await new Promise(resolve => cv.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('图片生成失败，请重试');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = safeFileName(((chart && chart.name) ? chart.name : '座位表') + '-座位表.png');
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      toast('已导出 A4 座位表图片');
    } catch (err) {
      toast((err && err.message) ? err.message : '导出失败，请重试', true);
    } finally {
      exportBtn.disabled = false;
      exportBtn.innerHTML = oldLabel;
    }
  }
