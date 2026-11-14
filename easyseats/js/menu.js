/* ==========================================================================
 * 易排座 · 右键 / 长按菜单
 * 拆分自原 index.html 内联脚本，逻辑逐字保留。
 * ========================================================================== */

import { currentMenu, setCurrentMenu } from './state.js';

  /* ================================================================
   *  菜单
   * ================================================================ */

  export function closeMenu() {
    if (currentMenu) {
      currentMenu.remove();
      setCurrentMenu(null);
    }
  }

  export function showMenu(x, y, items) {
    closeMenu();

    const menu = document.createElement('div');
    menu.className = 'menu';

    items.forEach(it => {
      const d = document.createElement('div');
      d.className = 'menu-item' + (it.danger ? ' danger' : '') + (it.note ? ' note' : '');
      d.textContent = it.label;
      if (!it.note) {
        d.addEventListener('click', ev => {
          ev.stopPropagation();
          closeMenu();
          it.onClick();
        });
      }
      menu.appendChild(d);
    });

    document.body.appendChild(menu);

    const r = menu.getBoundingClientRect();
    if (x + r.width  > window.innerWidth)  x = window.innerWidth  - r.width  - 8;
    if (y + r.height > window.innerHeight) y = window.innerHeight - r.height - 8;
    menu.style.left = Math.max(4, x) + 'px';
    menu.style.top  = Math.max(4, y) + 'px';

    setCurrentMenu(menu);
  }
