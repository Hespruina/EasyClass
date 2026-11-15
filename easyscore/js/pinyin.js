// 易积分 · 拼音分桶与排序（复刻 EasyCore 云名单编辑器，逻辑逐字保留）

export const PINYIN_LETTERS = 'ABCDEFGHJKLMNOPQRSTWXYZ';
export const PINYIN_BOUNDARIES = ['阿','八','嚓','哒','蛾','发','噶','哈','击','喀','垃','妈','拿','哦','啪','期','然','撒','塌','挖','昔','压','匝'];

export const zhCollator = (() => {
  try { return new Intl.Collator('zh-Hans-CN-u-co-pinyin'); } catch (e) { return null; }
})();

// 单个字符的拼音首字母：拉丁字母直接返回；汉字按边界字比对分桶
export function pinyinCharLetter(ch) {
  if (/[a-zA-Z]/.test(ch)) return ch.toUpperCase();
  if (/[\u4e00-\u9fff]/.test(ch)) {
    let letter = '';
    for (let i = 0; i < PINYIN_BOUNDARIES.length; i++) {
      if (ch.localeCompare(PINYIN_BOUNDARIES[i], 'zh-Hans-CN-u-co-pinyin') < 0) break;
      letter = PINYIN_LETTERS.charAt(i);
    }
    return letter;
  }
  return '';
}

export function pinyinLetterOf(name) {
  const ch = (name || '').trim().charAt(0);
  return ch ? pinyinCharLetter(ch) : '';
}

const initialsCache = new Map();
export function nameInitials(name) {
  if (initialsCache.has(name)) return initialsCache.get(name);
  let out = '';
  for (const ch of (name || '')) out += pinyinCharLetter(ch);
  initialsCache.set(name, out);
  return out;
}

export function nameLetterRank(name) {
  const letter = pinyinLetterOf(name);
  return letter ? letter.charCodeAt(0) - 64 : 0;
}

export function cmpName(a, b) {
  const ra = nameLetterRank(a), rb = nameLetterRank(b);
  if (ra !== rb) return ra - rb;
  if (zhCollator) { const r = zhCollator.compare(a, b); if (r !== 0) return r; }
  return a.localeCompare(b);
}
