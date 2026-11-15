// 易积分 · 学生卡片渲染 + 拼音索引条 + 搜索 + 批量多选
import { state } from './state.js';
import { cmpName, pinyinLetterOf, nameInitials, PINYIN_LETTERS } from './pinyin.js';
import { openModal } from './modal.js';
import { toast } from './ui.js';

let cardsContainer, alphaIndex, searchInput, operateBody;

export function initCards(refs) {
  cardsContainer = refs.cardsContainer;
  alphaIndex = refs.alphaIndex;
  searchInput = refs.searchInput;
  operateBody = refs.operateBody;
  buildAlphaIndex();
  searchInput.addEventListener('input', () => { applyFilter(); updateAlphaIndex(); });
}

function genderClass(g) {
  return g === 'male' ? 'male' : (g === 'female' ? 'female' : 'neutral');
}

function createCard(b) {
  const card = document.createElement('div');
  card.className = 'student-card';
  card.dataset.itemId = String(b.item_id);
  card.dataset.name = b.name;
  card.dataset.gender = b.gender || '';

  const avatar = document.createElement('div');
  avatar.className = 's-avatar ' + genderClass(b.gender);
  avatar.textContent = (b.name || '?').charAt(0);

  const name = document.createElement('div');
  name.className = 's-name';
  name.textContent = b.name;

  const score = document.createElement('div');
  score.className = 's-score';
  score.innerHTML = scoreMarkup(b);

  card.appendChild(avatar);
  card.appendChild(name);
  card.appendChild(score);

  if (state.selectedItems.has(b.item_id)) card.classList.add('batch-selected');
  card.addEventListener('click', () => onCardClick(b, card));
  return card;
}

/* 卡片右侧分数：
 * - 默认两池分列（+加分 / −扣分）；
 * - 「直接抵消」模式下两池不会同时有值，只显示有值的那个，两边都空则显示 0。 */
function scoreMarkup(b) {
  const add = b.add_score || 0;
  const deduct = b.deduct_score || 0;
  if (!state.directOffset) {
    return '<span class="pos">+' + add + '</span><span class="neg">−' + deduct + '</span>';
  }
  const net = add - deduct;
  if (net > 0) return '<span class="pos">+' + net + '</span>';
  if (net < 0) return '<span class="neg">−' + (-net) + '</span>';
  return '<span class="zero">0</span>';
}

function onCardClick(b, card) {
  if (state.batchMode) {
    toggleSelect(b, card);
  } else {
    openModal([b]);
  }
}

function toggleSelect(b, card) {
  if (state.selectedItems.has(b.item_id)) {
    state.selectedItems.delete(b.item_id);
    card.classList.remove('batch-selected');
  } else {
    state.selectedItems.add(b.item_id);
    card.classList.add('batch-selected');
  }
  updateBatchCount();
}

export function renderCards() {
  cardsContainer.innerHTML = '';
  const sorted = [...state.balances].sort((a, b) => cmpName(a.name, b.name));
  let lastLetter = null;
  sorted.forEach(b => {
    const letter = pinyinLetterOf(b.name) || '#';
    if (letter !== lastLetter) {
      const head = document.createElement('div');
      head.className = 'name-group-head';
      head.dataset.letter = letter;
      head.textContent = letter;
      cardsContainer.appendChild(head);
      lastLetter = letter;
    }
    cardsContainer.appendChild(createCard(b));
  });
  applyFilter();
}

function applyFilter() {
  const q = searchInput.value.trim().toLowerCase();
  const qInitials = q.toUpperCase().replace(/[^A-Z]/g, '');
  cardsContainer.querySelectorAll('.student-card').forEach(c => {
    const name = c.dataset.name || '';
    let hit = !q || name.toLowerCase().includes(q);
    if (!hit && qInitials) hit = nameInitials(name).includes(qInitials);
    c.style.display = hit ? '' : 'none';
  });
  refreshGroupHeads();
}

function refreshGroupHeads() {
  cardsContainer.querySelectorAll('.name-group-head').forEach(head => {
    let node = head.nextElementSibling, hasVisible = false;
    while (node && !node.classList.contains('name-group-head')) {
      if (node.classList.contains('student-card') && node.style.display !== 'none') {
        hasVisible = true;
        break;
      }
      node = node.nextElementSibling;
    }
    head.style.display = hasVisible ? '' : 'none';
  });
}

function buildAlphaIndex() {
  PINYIN_LETTERS.split('').forEach(letter => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'alpha-letter';
    btn.textContent = letter;
    btn.dataset.letter = letter;
    btn.addEventListener('click', () => scrollToLetter(letter));
    alphaIndex.appendChild(btn);
  });
  initDock();
}

function updateAlphaIndex() {
  const present = new Set();
  cardsContainer.querySelectorAll('.student-card').forEach(c => {
    if (c.style.display === 'none') return;
    const letter = pinyinLetterOf(c.dataset.name);
    if (letter) present.add(letter);
  });
  const searching = !!searchInput.value.trim();
  alphaIndex.querySelectorAll('.alpha-letter').forEach(btn => {
    btn.disabled = searching || !present.has(btn.dataset.letter);
  });
}

let highlightTimer = null;
function scrollToLetter(letter) {
  const matches = [...cardsContainer.querySelectorAll('.student-card')]
    .filter(c => c.style.display !== 'none' && pinyinLetterOf(c.dataset.name) === letter);
  if (!matches.length) return;
  highlightCards(matches);
  operateBody.scrollTo({
    top: operateBody.scrollTop + matches[0].getBoundingClientRect().top
         - operateBody.getBoundingClientRect().top - 14,
    behavior: 'smooth',
  });
}

function highlightCards(cards) {
  cardsContainer.querySelectorAll('.student-card.letter-highlight')
    .forEach(c => c.classList.remove('letter-highlight'));
  if (highlightTimer) clearTimeout(highlightTimer);
  cards.forEach(c => c.classList.add('letter-highlight'));
  highlightTimer = setTimeout(() => {
    cards.forEach(c => c.classList.remove('letter-highlight'));
    highlightTimer = null;
  }, 1500);
}

/* 字母条 Dock 放大（复刻云名单编辑器） */
const DOCK = { max: 1.85, radius: 120 };
const dockReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function initDock() {
  if (dockReducedMotion) return;
  alphaIndex.addEventListener('mousemove', (e) => magnifyDock(e));
  alphaIndex.addEventListener('mouseleave', () => {
    alphaIndex.classList.remove('is-magnifying');
    [...alphaIndex.children].forEach(l => (l.style.transform = ''));
  });
}
function magnifyDock(event) {
  if (dockReducedMotion) return;
  const letters = [...alphaIndex.children];
  if (!letters.length) return;
  const pointerY = event.clientY - alphaIndex.getBoundingClientRect().top;
  const centers = letters.map(n => n.offsetTop + n.offsetHeight / 2);
  const heights = letters.map(n => n.offsetHeight);
  const gap = centers.length > 1 ? centers[1] - centers[0] - (heights[0] + heights[1]) / 2 : 0;
  const scales = centers.map(center => {
    const d = Math.abs(pointerY - center);
    if (d >= DOCK.radius) return 1;
    const f = 1 - d / DOCK.radius;
    return 1 + (DOCK.max - 1) * f * f;
  });
  const raw = [];
  let cursor = 0;
  for (let i = 0; i < letters.length; i++) {
    const size = heights[i] * scales[i];
    raw.push(cursor + size / 2);
    cursor += size + gap;
  }
  let ws = 0, weighted = 0;
  scales.forEach((s, i) => { const w = (s - 1) ** 2; ws += w; weighted += w * raw[i]; });
  const offset = ws > 1e-6 ? pointerY - weighted / ws : 0;
  alphaIndex.classList.add('is-magnifying');
  letters.forEach((n, i) => {
    const shift = raw[i] + offset - centers[i];
    n.style.transform = 'translateY(' + shift.toFixed(2) + 'px) scale(' + scales[i].toFixed(3) + ')';
  });
}

/* ============ 批量多选 ============ */
export function setBatchMode(on) {
  state.batchMode = on;
  if (!on) {
    state.selectedItems.clear();
    cardsContainer.querySelectorAll('.student-card').forEach(c => c.classList.remove('batch-selected'));
  }
  document.body.classList.toggle('batch-mode', on);
  updateBatchCount();
}

export function getSelectedItemIds() {
  return [...state.selectedItems];
}

function updateBatchCount() {
  const el = document.getElementById('btCount');
  if (el) el.textContent = '已选 ' + state.selectedItems.size + ' 人';
}
