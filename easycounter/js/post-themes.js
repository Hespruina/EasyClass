/* ==========================================================================
 * 海报主题（单文件）
 * --------------------------------------------------------------------------
 * 全部主题集中在本文件，不再有独立的主题文件：
 *   1. POSTER_THEMES  主题注册表：id / 名称 / CSS 变量 / 默认取色 / 版式函数
 *   2. 版式函数       每个主题一个 render(config)，返回海报 HTML
 *   3. 公共辅助       posterCtx() 一次取齐榜单数据与配色，votesOf() 统一读票数
 *   4. 分发器         buildPosterHTML() 按 themeId 选版式
 *   5. 选择器 UI      populateThemeSelect() / updateCustomThemeSelectDisplay()
 *
 * 新增主题只需在 POSTER_THEMES 里加一项并实现 render()，无需改动其它文件，
 * 也不会产生任何网络请求：全部主题在首次加载时即随本文件进入内存。
 * ========================================================================== */

const POSTER_THEMES = [
  {
    id: 'default',
    name: '默认',
    render: buildDefaultPosterHTML,
    cssVars: {
      '--poster-bg': '#23242a',
      '--poster-title-color': '#45f3ff',
      '--poster-title-shadow': '0 0 10px rgba(69, 243, 255, 0.5)',
      '--poster-time-color': '#8f8f8f',
      '--poster-rank-color': '#ffffff',
      '--poster-score-color': '#45f3ff',
      '--poster-item-bg': 'rgba(255, 255, 255, 0.05)',
      '--poster-item-border': 'transparent',
      '--poster-item-shadow': 'none',
      '--poster-gold': '#ffd700',
      '--poster-silver': '#c0c0c0',
      '--poster-bronze': '#cd7f32',
      '--poster-top1-bg': 'linear-gradient(90deg, rgba(255, 215, 0, 0.1), transparent)',
      '--poster-footer-color': '#8f8f8f',
      '--poster-footer-border': 'rgba(255, 255, 255, 0.1)',
      '--poster-total-color': '#8f8f8f',
      '--poster-total-value-color': '#45f3ff',
      '--poster-card-radius': '8px',
      '--poster-font-title': "'ZCOOL KuaiLe', cursive",
    },
    defaultColors: {
      bgColor: '#23242a',
      titleColor: '#45f3ff',
      rankColor: '#ffffff',
      scoreColor: '#45f3ff',
    },
  },
  {
    id: 'plain',
    name: '极简',
    cssVars: {},
    isPlain: true,
    defaultColors: {
      bgColor: '#ffffff',
      titleColor: '#333333',
      rankColor: '#333333',
      scoreColor: '#555555',
    },
  },
  {
    id: 'elegant-blue',
    name: '白兰',
    render: buildElegantBluePosterHTML,
    cssVars: {
      '--poster-bg': 'linear-gradient(135deg, #f0f4f8, #e1e8f0)',
      '--poster-title-color': '#4a607a',
      '--poster-title-shadow': 'none',
      '--poster-time-color': '#7a8a9a',
      '--poster-rank-color': '#2d3748',
      '--poster-score-color': '#3b6d8c',
      '--poster-item-bg': '#ffffff',
      '--poster-item-border': 'rgba(74, 96, 122, 0.18)',
      '--poster-item-shadow': '0 2px 10px rgba(0, 0, 0, 0.08)',
      '--poster-gold': '#b8860b',
      '--poster-silver': '#708090',
      '--poster-bronze': '#8b4513',
      '--poster-top1-bg': 'linear-gradient(90deg, rgba(184, 134, 11, 0.08), transparent)',
      '--poster-footer-color': '#7a8a9a',
      '--poster-footer-border': 'rgba(0, 0, 0, 0.1)',
      '--poster-total-color': '#7a8a9a',
      '--poster-total-value-color': '#4a607a',
      '--poster-card-radius': '10px',
      '--poster-font-title': "'Noto Sans SC', sans-serif",
    },
    defaultColors: {
      bgColor: '#f0f4f8',
      titleColor: '#4a607a',
      rankColor: '#2d3748',
      scoreColor: '#3b6d8c',
    },
  },
  {
    id: 'noble-gold',
    name: '雅贵',
    render: buildNobleGoldPosterHTML,
    cssVars: {
      '--poster-bg': '#1c2230',
      '--poster-title-color': '#f6d365',
      '--poster-title-shadow': 'none',
      '--poster-time-color': '#8a8a9a',
      '--poster-rank-color': '#e8e0d0',
      '--poster-score-color': '#ffd700',
      '--poster-item-bg': 'rgba(255, 255, 255, 0.03)',
      '--poster-item-border': 'rgba(255, 215, 0, 0.2)',
      '--poster-item-shadow': '0 2px 12px rgba(0, 0, 0, 0.3)',
      '--poster-gold': '#ffd700',
      '--poster-silver': '#c0c0c0',
      '--poster-bronze': '#cd7f32',
      '--poster-top1-bg': 'linear-gradient(90deg, rgba(255, 215, 0, 0.08), transparent)',
      '--poster-footer-color': '#8a8a9a',
      '--poster-footer-border': 'rgba(255, 215, 0, 0.15)',
      '--poster-total-color': '#8a8a9a',
      '--poster-total-value-color': '#ffd700',
      '--poster-card-radius': '8px',
      '--poster-font-title': "'ZCOOL KuaiLe', cursive",
    },
    defaultColors: {
      bgColor: '#1c2230',
      titleColor: '#f6d365',
      rankColor: '#e8e0d0',
      scoreColor: '#ffd700',
    },
  },
  {
    id: 'sakura-pink',
    name: '樱花柔粉',
    render: buildSakuraPinkPosterHTML,
    cssVars: {
      '--poster-bg': 'linear-gradient(135deg, #fff5f7, #fce4ec, #f8e8f0)',
      '--poster-title-color': '#9c5f75',
      '--poster-title-shadow': 'none',
      '--poster-time-color': '#a88a95',
      '--poster-rank-color': '#4a3035',
      '--poster-score-color': '#b55a70',
      '--poster-item-bg': 'rgba(255, 255, 255, 0.92)',
      '--poster-item-border': 'rgba(156, 95, 117, 0.2)',
      '--poster-item-shadow': '0 2px 10px rgba(156, 95, 117, 0.12)',
      '--poster-gold': '#d4a574',
      '--poster-silver': '#b8a9c9',
      '--poster-bronze': '#c48b9f',
      '--poster-top1-bg': 'linear-gradient(90deg, rgba(212, 165, 116, 0.08), transparent)',
      '--poster-footer-color': '#a88a95',
      '--poster-footer-border': 'rgba(156, 95, 117, 0.2)',
      '--poster-total-color': '#a88a95',
      '--poster-total-value-color': '#9c5f75',
      '--poster-card-radius': '12px',
      '--poster-font-title': "'Noto Sans SC', sans-serif",
    },
    defaultColors: {
      bgColor: '#fff5f7',
      titleColor: '#9c5f75',
      rankColor: '#4a3035',
      scoreColor: '#b55a70',
    },
  },
  {
    id: 'matcha-latte',
    name: '抹茶拿铁',
    render: buildMatchaLattePosterHTML,
    cssVars: {
      '--poster-bg': 'linear-gradient(135deg, #f5f0e8, #e8e0d0, #f0ebe0)',
      '--poster-title-color': '#4a5c35',
      '--poster-title-shadow': 'none',
      '--poster-time-color': '#7a8a6b',
      '--poster-rank-color': '#3a3025',
      '--poster-score-color': '#4f6638',
      '--poster-item-bg': 'rgba(255, 255, 255, 0.92)',
      '--poster-item-border': 'rgba(74, 92, 53, 0.18)',
      '--poster-item-shadow': '0 2px 8px rgba(74, 92, 53, 0.1)',
      '--poster-gold': '#b8860b',
      '--poster-silver': '#9e8e7e',
      '--poster-bronze': '#8b7355',
      '--poster-top1-bg': 'linear-gradient(90deg, rgba(184, 134, 11, 0.06), transparent)',
      '--poster-footer-color': '#7a8a6b',
      '--poster-footer-border': 'rgba(74, 92, 53, 0.18)',
      '--poster-total-color': '#7a8a6b',
      '--poster-total-value-color': '#4a5c35',
      '--poster-card-radius': '10px',
      '--poster-font-title': "'Noto Sans SC', sans-serif",
    },
    defaultColors: {
      bgColor: '#f5f0e8',
      titleColor: '#4a5c35',
      rankColor: '#3a3025',
      scoreColor: '#4f6638',
    },
  },
  {
    id: 'haze-blue',
    name: '雾霾蓝',
    render: buildHazeBluePosterHTML,
    cssVars: {
      '--poster-bg': 'linear-gradient(135deg, #e8eef4, #d4e0ed, #e0e8f0)',
      '--poster-title-color': '#3d5a78',
      '--poster-title-shadow': 'none',
      '--poster-time-color': '#7a90a8',
      '--poster-rank-color': '#2c4358',
      '--poster-score-color': '#3a6a8f',
      '--poster-item-bg': 'rgba(255, 255, 255, 0.92)',
      '--poster-item-border': 'rgba(61, 90, 120, 0.18)',
      '--poster-item-shadow': '0 2px 10px rgba(61, 90, 120, 0.1)',
      '--poster-gold': '#b8860b',
      '--poster-silver': '#7a9bb5',
      '--poster-bronze': '#8b7355',
      '--poster-top1-bg': 'linear-gradient(90deg, rgba(184, 134, 11, 0.06), transparent)',
      '--poster-footer-color': '#7a90a8',
      '--poster-footer-border': 'rgba(61, 90, 120, 0.18)',
      '--poster-total-color': '#7a90a8',
      '--poster-total-value-color': '#3d5a78',
      '--poster-card-radius': '10px',
      '--poster-font-title': "'Noto Sans SC', sans-serif",
    },
    defaultColors: {
      bgColor: '#e8eef4',
      titleColor: '#3d5a78',
      rankColor: '#2c4358',
      scoreColor: '#3a6a8f',
    },
  },
  {
    id: 'cream-yellow',
    name: '奶油暖黄',
    render: buildCreamYellowPosterHTML,
    cssVars: {
      '--poster-bg': 'linear-gradient(135deg, #fef9ef, #fdf3e0, #fef5ea)',
      '--poster-title-color': '#8f6a2e',
      '--poster-title-shadow': 'none',
      '--poster-time-color': '#9a8565',
      '--poster-rank-color': '#4a3a2a',
      '--poster-score-color': '#8f6a2e',
      '--poster-item-bg': 'rgba(255, 255, 255, 0.92)',
      '--poster-item-border': 'rgba(143, 106, 46, 0.18)',
      '--poster-item-shadow': '0 2px 10px rgba(143, 106, 46, 0.1)',
      '--poster-gold': '#d4a44a',
      '--poster-silver': '#b8a898',
      '--poster-bronze': '#a88868',
      '--poster-top1-bg': 'linear-gradient(90deg, rgba(212, 164, 74, 0.08), transparent)',
      '--poster-footer-color': '#9a8565',
      '--poster-footer-border': 'rgba(143, 106, 46, 0.18)',
      '--poster-total-color': '#9a8565',
      '--poster-total-value-color': '#8f6a2e',
      '--poster-card-radius': '10px',
      '--poster-font-title': "'Noto Sans SC', sans-serif",
    },
    defaultColors: {
      bgColor: '#fef9ef',
      titleColor: '#8f6a2e',
      rankColor: '#4a3a2a',
      scoreColor: '#8f6a2e',
    },
  },
];

function getThemeConfig(themeId) {
  return POSTER_THEMES.find(t => t.id === themeId) || POSTER_THEMES[0];
}

function applyThemeToPosterBox(themeConfig) {
  const posterBox = document.getElementById('posterBox');
  posterBox.style.cssText = '';
  Object.entries(themeConfig.cssVars).forEach(([prop, value]) => {
    posterBox.style.setProperty(prop, value);
  });
}

/* ---------------- 公共辅助 ---------------- */

// 一次取齐版式所需上下文：榜单数据（topItems / timeStr）+ 主题配色，
// 避免 8 套版式各写一遍 getPosterData + getThemeColors 两行样板
function posterCtx(config) {
  return Object.assign({}, getPosterData(config), getThemeColors(config));
}

// 统一票数读取：缺省按 0 处理（原代码在各版式里重复写了 30 余次 appState.votes[x] || 0）
function votesOf(name) {
  return appState.votes[name] || 0;
}

/* ---------------- 主题数据与取色 ---------------- */

let currentTimeStr = '';

function getPosterData(config) {
const rankedData = getRankedData();
const topItems = rankedData.slice(0, config.topCount);
const now = new Date();
const timeStr = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()} ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
currentTimeStr = timeStr;
return { rankedData, topItems, timeStr };
}

function getThemeColors(config) {
const theme = getThemeConfig(config.themeId || 'default');
const vars = theme.cssVars;

const titleColor = config.titleColor || vars['--poster-title-color'] || '#fff';
const timeColor = vars['--poster-time-color'] || '#8f8f8f';
const rankColor = config.rankColor || vars['--poster-rank-color'] || '#fff';
const scoreColor = config.scoreColor || vars['--poster-score-color'] || '#fff';
const goldColor = vars['--poster-gold'] || '#ffd700';
const silverColor = vars['--poster-silver'] || '#c0c0c0';
const bronzeColor = vars['--poster-bronze'] || '#cd7f32';
const footerColor = vars['--poster-footer-color'] || '#8f8f8f';
const totalColor = vars['--poster-total-color'] || '#8f8f8f';
const totalValueColor = vars['--poster-total-value-color'] || scoreColor;
const headerBorderColor = scoreColor;

return { titleColor, timeColor, rankColor, scoreColor, goldColor, silverColor, bronzeColor, footerColor, totalColor, totalValueColor, headerBorderColor };
}

/* ---------------- 8 套版式 ---------------- */

function buildDefaultPosterHTML(config) {
const { topItems, timeStr, titleColor, timeColor, rankColor, scoreColor, goldColor, silverColor, bronzeColor, footerColor, totalColor, totalValueColor, headerBorderColor } = posterCtx(config);

let html = `
<div style="text-align: center; margin-bottom: 35px; padding-bottom: 25px; border-bottom: 3px solid ${headerBorderColor}; position: relative;">
<div style="font-size: 42px; font-weight: bold; color: ${titleColor}; text-shadow: 0 0 20px ${titleColor}; margin-bottom: 12px; letter-spacing: 2px;">${config.title}</div>
<div style="color: ${timeColor}; font-size: 15px; opacity: 0.8;">${timeStr}</div>
</div>
<div style="display: flex; flex-direction: column; gap: 12px;">
`;

topItems.forEach((item, idx) => {
let accentColor = 'transparent';
let rankBg = 'rgba(255,255,255,0.05)';
let glowEffect = 'none';

if (idx === 0) {
accentColor = goldColor;
rankBg = `linear-gradient(135deg, ${goldColor}22, transparent)`;
glowEffect = `0 0 15px ${goldColor}40`;
} else if (idx === 1) {
accentColor = silverColor;
rankBg = `linear-gradient(135deg, ${silverColor}22, transparent)`;
} else if (idx === 2) {
accentColor = bronzeColor;
rankBg = `linear-gradient(135deg, ${bronzeColor}22, transparent)`;
} else {
rankBg = 'rgba(255,255,255,0.03)';
}

const votes = votesOf(item.name);

html += `
<div style="display: flex; align-items: center; background: ${rankBg}; padding: 18px 20px; border-radius: 12px; border-left: 6px solid ${accentColor}; box-shadow: ${glowEffect}; transition: all 0.3s;">
<div style="width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: ${accentColor}; background: ${accentColor}15; border-radius: 12px; margin-right: 18px;">${idx + 1}</div>
<div style="flex: 1; font-size: 20px; font-weight: 500; color: ${rankColor}; letter-spacing: 1px;">${item.name}</div>
<div style="font-size: 26px; font-weight: bold; color: ${scoreColor}; padding: 8px 16px; background: ${scoreColor}10; border-radius: 8px;">${votes}</div>
<div style="font-size: 14px; color: ${timeColor}; margin-left: 8px;">票</div>
</div>
`;
});

html += `
</div>
<div style="text-align: center; margin-top: 30px; padding: 20px; background: rgba(255,255,255,0.03); border-radius: 12px; font-size: 16px; color: ${totalColor};">
总票数：<span style="color: ${totalValueColor}; font-weight: bold; font-size: 24px;">${appState.totalVotes}</span>
</div>
<div style="margin-top: 25px; text-align: center; color: ${footerColor}; font-size: 12px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); opacity: 0.7;">
由易计票创建 - https://jipiao.zhrhello.top
</div>
`;

return html;
}

function buildPlainPosterHTML(config) {
const { topItems, timeStr } = getPosterData(config);

let html = `<div style="font-family: sans-serif; padding: 20px;">`;
html += `<h1 style="font-size: 24px; margin-bottom: 10px;">${config.title}</h1>`;
html += `<p style="color: #888; font-size: 14px; margin-bottom: 20px;">${timeStr}</p>`;
html += `<ol style="padding-left: 20px; line-height: 2;">`;

topItems.forEach((item) => {
html += `<li style="font-size: 16px;">${item.name} - ${votesOf(item.name)}票</li>`;
});

html += `</ol>`;
html += `<p style="margin-top: 20px; font-size: 14px; color: #666;">总票数：${appState.totalVotes}</p>`;
html += `<p style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">由易计票创建 - https://jipiao.zhrhello.top</p>`;
html += `</div>`;
return html;
}

function buildElegantBluePosterHTML(config) {
    const { topItems, timeStr, titleColor, timeColor, rankColor, scoreColor, goldColor, silverColor, bronzeColor, footerColor, totalColor, totalValueColor, headerBorderColor } = posterCtx(config);
    
    // 极简风格：去背景，去边框，靠排版和线条
    let html = `
    <div style="text-align: left; padding: 40px 20px; max-width: 700px; margin: 0 auto;">
        <div style="border-bottom: 1px solid ${rankColor}30; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: end;">
            <div>
                <div style="font-size: 32px; font-weight: 300; color: ${titleColor}; letter-spacing: 4px; text-transform: uppercase;">${config.title}</div>
                <div style="color: ${timeColor}; font-size: 12px; margin-top: 5px; letter-spacing: 1px;">REPORT / ${timeStr}</div>
            </div>
            <div style="font-size: 48px; font-weight: 100; color: ${scoreColor}; opacity: 0.2;">TOP ${topItems.length}</div>
        </div>
    `;

    topItems.forEach((item, idx) => {
        const votes = votesOf(item.name);
        let rankStyle = `color: ${timeColor}; font-weight: normal;`;
        if (idx === 0) rankStyle = `color: ${goldColor}; font-weight: bold; font-size slightly larger;`;
        
        html += `
        <div style="display: flex; align-items: baseline; padding: 15px 0; border-bottom: 1px dashed ${rankColor}15; transition: all 0.3s;">
            <div style="width: 30px; font-size: 14px; ${rankStyle}">${String(idx + 1).padStart(2, '0')}</div>
            <div style="flex: 1; font-size: 18px; color: ${rankColor}; font-weight: 400; padding-left: 20px;">${item.name}</div>
            <div style="font-size: 18px; font-weight: 300; color: ${scoreColor}; font-family: monospace;">${votes}</div>
        </div>
        `;
    });

    html += `
        <div style="margin-top: 40px; text-align: right; font-size: 12px; color: ${footerColor};">
            TOTAL VOTES: <span style="color: ${totalValueColor}; font-size: 14px;">${appState.totalVotes}</span>
        </div>
        <div style="margin-top: 10px; text-align: center; color: ${footerColor}; font-size: 10px; opacity: 0.5;">
            jipiao.zhrhello.top
        </div>
    </div>
    `;
    return html;
}

function buildNobleGoldPosterHTML(config) {
    const { topItems, timeStr, titleColor, timeColor, rankColor, scoreColor, goldColor, silverColor, bronzeColor, footerColor, totalColor, totalValueColor, headerBorderColor } = posterCtx(config);

    // 贵族风格：强调第一名，中心对称，深色背景高光
    const firstItem = topItems[0];
    const restItems = topItems.slice(1);
    const firstVotes = firstItem ? votesOf(firstItem.name) : 0;

    let html = `
    <div style="text-align: center; padding: 30px; background: radial-gradient(circle at center, ${goldColor}10, transparent 70%);">
        <div style="font-size: 14px; color: ${goldColor}; letter-spacing: 6px; margin-bottom: 10px; text-transform: uppercase;">Winner</div>
        <div style="font-size: 48px; font-weight: bold; color: ${titleColor}; text-shadow: 0 0 30px ${goldColor}40; margin-bottom: 5px;">${firstItem ? firstItem.name : 'None'}</div>
        <div style="font-size: 64px; font-weight: 900; color: ${goldColor}; line-height: 1; margin: 10px 0;">${firstVotes}</div>
        <div style="width: 100px; height: 2px; background: linear-gradient(90deg, transparent, ${goldColor}, transparent); margin: 20px auto;"></div>
        <div style="color: ${timeColor}; font-size: 12px; margin-bottom: 30px;">${timeStr}</div>
    `;

    if (restItems.length > 0) {
        html += `<div style="text-align: left; background: rgba(0,0,0,0.2); border-radius: 12px; padding: 20px; border: 1px solid ${goldColor}20;">`;
        restItems.forEach((item, idx) => {
            const votes = votesOf(item.name);
            const realIdx = idx + 2;
            let medalColor = realIdx === 2 ? silverColor : (realIdx === 3 ? bronzeColor : rankColor);
            
            html += `
            <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid ${medalColor}; color: ${medalColor}; display: flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 15px;">${realIdx}</div>
                <div style="flex: 1; color: ${rankColor}; font-size: 16px;">${item.name}</div>
                <div style="color: ${scoreColor}; font-weight: bold;">${votes}</div>
            </div>
            `;
        });
        html += `</div>`;
    }

    html += `
        <div style="margin-top: 25px; color: ${footerColor}; font-size: 12px;">
            Total: ${appState.totalVotes} | jipiao.zhrhello.top
        </div>
    </div>
    `;
    return html;
}

function buildSakuraPinkPosterHTML(config) {
    const { topItems, timeStr, titleColor, timeColor, rankColor, scoreColor, goldColor, silverColor, bronzeColor, footerColor, totalColor, totalValueColor, headerBorderColor } = posterCtx(config);

    // 樱花风格：网格布局，卡片化，柔和阴影，像便签
    let html = `
    <div style="padding: 20px;">
        <div style="text-align: center; margin-bottom: 25px;">
            <span style="font-size: 24px; color: ${titleColor}; font-weight: bold; background: #fff; padding: 5px 15px; border-radius: 20px; box-shadow: 0 4px 10px rgba(156, 95, 117, 0.1);">🌸 ${config.title}</span>
            <div style="color: ${timeColor}; font-size: 12px; margin-top: 8px;">${timeStr}</div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
    `;

    topItems.forEach((item, idx) => {
        const votes = votesOf(item.name);
        let borderColor = 'rgba(156, 95, 117, 0.1)';
        let bgAccent = '#fff';
        let rankColorLocal = rankColor;
        
        if (idx === 0) { borderColor = goldColor; bgAccent = 'linear-gradient(135deg, #fff, #fffdf5)'; rankColorLocal = goldColor; }
        else if (idx === 1) { borderColor = silverColor; rankColorLocal = silverColor; }
        else if (idx === 2) { borderColor = bronzeColor; rankColorLocal = bronzeColor; }

        html += `
        <div style="background: ${bgAccent}; border: 2px solid ${borderColor}; border-radius: 16px; padding: 15px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(156, 95, 117, 0.05); position: relative; overflow: hidden;">
            <div style="position: absolute; top: -10px; right: -10px; font-size: 40px; opacity: 0.05; transform: rotate(15deg);">#${idx + 1}</div>
            <div style="font-size: 14px; color: ${timeColor}; margin-bottom: 5px;">NO.${idx + 1}</div>
            <div style="font-size: 16px; font-weight: bold; color: ${rankColorLocal}; margin-bottom: 8px; text-align: center; word-break: break-all;">${item.name}</div>
            <div style="font-size: 24px; font-weight: 800; color: ${scoreColor};">${votes}</div>
        </div>
        `;
    });

    html += `
        </div>
        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: ${footerColor}; background: rgba(255,255,255,0.5); padding: 8px; border-radius: 8px;">
            Total Votes: ${appState.totalVotes} • jipiao.zhrhello.top
        </div>
    </div>
    `;
    return html;
}

function buildMatchaLattePosterHTML(config) {
    const { topItems, timeStr, titleColor, timeColor, rankColor, scoreColor, goldColor, silverColor, bronzeColor, footerColor, totalColor, totalValueColor, headerBorderColor } = posterCtx(config);

    // 抹茶风格：清单/收据风格，强调进度条，左对齐，无框
    const maxVotes = Math.max(...topItems.map(i => votesOf(i.name)), 1);

    let html = `
    <div style="padding: 30px; background-image: radial-gradient(${scoreColor}10 1px, transparent 1px); background-size: 20px 20px;">
        <div style="font-family: monospace; font-size: 20px; color: ${titleColor}; margin-bottom: 5px;">:: ${config.title}</div>
        <div style="font-family: monospace; font-size: 12px; color: ${timeColor}; margin-bottom: 25px;">DATE: ${timeStr}</div>
    `;

    topItems.forEach((item, idx) => {
        const votes = votesOf(item.name);
        const percent = (votes / maxVotes) * 100;
        let barColor = scoreColor;
        if (idx === 0) barColor = goldColor;
        else if (idx === 1) barColor = silverColor;
        else if (idx === 2) barColor = bronzeColor;

        html += `
        <div style="margin-bottom: 18px;">
            <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 6px; font-family: monospace;">
                <span style="color: ${rankColor};"><span style="color: ${barColor};">#${idx + 1}</span> ${item.name}</span>
                <span style="color: ${scoreColor}; font-weight: bold;">${votes}</span>
            </div>
            <div style="height: 6px; background: rgba(74, 92, 53, 0.1); border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; width: ${percent}%; background: ${barColor}; border-radius: 3px; transition: width 1s ease;"></div>
            </div>
        </div>
        `;
    });

    html += `
        <div style="margin-top: 30px; border-top: 2px dashed ${rankColor}30; padding-top: 15px; display: flex; justify-content: space-between; font-family: monospace; font-size: 14px; color: ${footerColor};">
            <span>TOTAL</span>
            <span style="color: ${totalValueColor}; font-weight: bold;">${appState.totalVotes}</span>
        </div>
        <div style="text-align: center; margin-top: 15px; font-size: 10px; color: ${timeColor}; opacity: 0.6;">
            GENERATED BY JIPIAO
        </div>
    </div>
    `;
    return html;
}

function buildHazeBluePosterHTML(config) {
    const { topItems, timeStr, titleColor, timeColor, rankColor, scoreColor, goldColor, silverColor, bronzeColor, footerColor, totalColor, totalValueColor, headerBorderColor } = posterCtx(config);

    // 雾霾蓝：iOS风格，大圆角，毛玻璃感（模拟），悬浮卡片
    let html = `
    <div style="padding: 25px;">
        <div style="background: rgba(255,255,255,0.6); backdrop-filter: blur(10px); border-radius: 20px; padding: 20px; margin-bottom: 20px; box-shadow: 0 8px 32px rgba(31, 38, 135, 0.05); border: 1px solid rgba(255, 255, 255, 0.18); text-align: center;">
            <div style="font-size: 24px; font-weight: 600; color: ${titleColor};">${config.title}</div>
            <div style="font-size: 12px; color: ${timeColor}; margin-top: 5px;">${timeStr}</div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
    `;

    topItems.forEach((item, idx) => {
        const votes = votesOf(item.name);
        let iconBg = 'rgba(91, 127, 165, 0.1)';
        let iconColor = '#5b7fa5';
        
        if (idx === 0) { iconBg = goldColor; iconColor = '#fff'; }
        else if (idx === 1) { iconBg = silverColor; iconColor = '#fff'; }
        else if (idx === 2) { iconBg = bronzeColor; iconColor = '#fff'; }

        html += `
        <div style="display: flex; align-items: center; background: rgba(255,255,255,0.8); padding: 15px; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: ${iconBg}; color: ${iconColor}; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; margin-right: 15px; flex-shrink: 0;">
                ${idx + 1}
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="font-size: 16px; font-weight: 500; color: ${rankColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
            </div>
            <div style="font-size: 18px; font-weight: 700; color: ${scoreColor}; margin-left: 10px;">${votes}</div>
        </div>
        `;
    });

    html += `
        </div>
        <div style="text-align: center; margin-top: 20px; color: ${footerColor}; font-size: 12px;">
            Total: ${appState.totalVotes}
        </div>
    </div>
    `;
    return html;
}

function buildCreamYellowPosterHTML(config) {
    const { topItems, timeStr, titleColor, timeColor, rankColor, scoreColor, goldColor, silverColor, bronzeColor, footerColor, totalColor, totalValueColor, headerBorderColor } = posterCtx(config);

    // 奶油黄：复古徽章风格，左侧大数字，右侧内容，类似证书
    let html = `
    <div style="padding: 30px; border: 4px double ${titleColor}40; border-radius: 8px; height: 100%; box-sizing: border-box;">
        <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 14px; color: ${timeColor}; letter-spacing: 2px; margin-bottom: 5px;">RANKING BOARD</div>
            <div style="font-size: 28px; font-weight: 900; color: ${titleColor}; font-family: serif;">${config.title}</div>
        </div>
    `;

    topItems.forEach((item, idx) => {
        const votes = votesOf(item.name);
        let badgeBorder = `2px solid ${rankColor}30`;
        let badgeColor = rankColor;
        
        if (idx === 0) { badgeBorder = `3px solid ${goldColor}`; badgeColor = goldColor; }
        else if (idx === 1) { badgeBorder = `2px solid ${silverColor}`; badgeColor = silverColor; }
        else if (idx === 2) { badgeBorder = `2px solid ${bronzeColor}`; badgeColor = bronzeColor; }

        html += `
        <div style="display: flex; align-items: center; margin-bottom: 15px; background: #fff; padding: 10px; border-radius: 8px; box-shadow: 2px 2px 0px rgba(0,0,0,0.05);">
            <div style="width: 50px; height: 50px; border-radius: 50%; border: ${badgeBorder}; color: ${badgeColor}; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; font-family: serif; margin-right: 20px; flex-shrink: 0;">
                ${idx + 1}
            </div>
            <div style="flex: 1; border-bottom: 1px dotted ${rankColor}30; padding-bottom: 5px; margin-right: 10px;">
                <div style="font-size: 18px; color: ${rankColor}; font-weight: 500;">${item.name}</div>
            </div>
            <div style="font-size: 20px; font-weight: bold; color: ${scoreColor}; font-family: serif;">${votes}</div>
        </div>
        `;
    });

    html += `
        <div style="margin-top: 25px; text-align: right; font-family: serif; font-style: italic; color: ${footerColor}; font-size: 14px;">
            Sum: ${appState.totalVotes}
        </div>
        <div style="text-align: center; margin-top: 10px; font-size: 10px; color: ${timeColor};">
            jipiao.zhrhello.top
        </div>
    </div>
    `;
    return html;
}

/* ---------------- 版式分发 ---------------- */

function buildPosterHTML(config) {
  const theme = getThemeConfig(config.themeId || 'default');
  if (theme.isPlain) return buildPlainPosterHTML(config);
  if (typeof theme.render === 'function') return theme.render(config);
  return buildDefaultPosterHTML(config);
}

/* ---------------- 主题选择器 UI ---------------- */

function populateThemeSelect() {
  const dropdown = document.getElementById('posterThemeDropdown');
  const trigger = document.getElementById('posterThemeSelect');
  const triggerIcon = trigger.querySelector('.custom-select-theme-icon');
  const triggerText = trigger.querySelector('.custom-select-text');
  
  if (!dropdown) return;
  
  dropdown.innerHTML = '';
  
  POSTER_THEMES.forEach(theme => {
    const option = document.createElement('div');
    option.className = 'custom-select-option';
    option.value = theme.id;
    
    let colorPreview = '';
    if (theme.defaultColors) {
      const colors = [
        theme.defaultColors.titleColor,
        theme.defaultColors.scoreColor,
        theme.defaultColors.bgColor,
      ].slice(0, 3);
      
      const dots = colors.map(c => 
        `<span class="theme-color-dot" style="background:${c}"></span>`
      ).join('');
      colorPreview = `<span class="theme-color-preview">${dots}</span>`;
    }
    
    option.innerHTML = `
      <span class="custom-select-option-icon" style="background: linear-gradient(135deg, ${theme.defaultColors?.titleColor || '#888'}, ${theme.defaultColors?.scoreColor || '#888'})"></span>
      <span class="custom-select-option-name">${theme.name}</span>
      ${colorPreview}
      <svg class="custom-select-option-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    
    dropdown.appendChild(option);
  });
  
  updateCustomThemeSelectDisplay();
}

function updateCustomThemeSelectDisplay() {
  const trigger = document.getElementById('posterThemeSelect');
  const triggerIcon = trigger?.querySelector('.custom-select-theme-icon');
  const triggerText = trigger?.querySelector('.custom-select-text');
  
  if (!trigger || !triggerIcon || !triggerText) return;
  
  const currentTheme = getThemeConfig(currentPosterConfig.themeId || 'default');
  triggerText.textContent = currentTheme.name;
  triggerIcon.style.background = `linear-gradient(135deg, ${currentTheme.defaultColors?.titleColor || '#888'}, ${currentTheme.defaultColors?.scoreColor || '#888'})`;
  
  document.querySelectorAll('.custom-select-option').forEach(opt => {
    opt.classList.toggle('selected', opt.value === currentPosterConfig.themeId);
  });
}
