// 当前海报配置
let currentPosterConfig = {
themeId: 'default',
title: '易计票 结果',
titleColor: '#45f3ff',
bgColor: '#23242a',
rankColor: '#ffffff',
scoreColor: '#45f3ff',
topCount: 10
};
let currentPosterDataUrl = '';

let posterLoadingSpinner = null;

function showPosterLoading() {
posterPreviewImage.classList.add('poster-loading');
posterLoadingSpinner = document.createElement('div');
posterLoadingSpinner.className = 'poster-loading-spinner';
posterPreviewImage.parentNode.classList.add('poster-loading-wrapper');
posterPreviewImage.parentNode.appendChild(posterLoadingSpinner);
}

function hidePosterLoading() {
posterPreviewImage.classList.remove('poster-loading');
if (posterLoadingSpinner && posterLoadingSpinner.parentNode) {
posterLoadingSpinner.parentNode.removeChild(posterLoadingSpinner);
posterLoadingSpinner = null;
}
posterPreviewImage.parentNode.classList.remove('poster-loading-wrapper');
}

async function generatePosterImage(config) {
const theme = getThemeConfig(config.themeId || 'default');
const html = buildPosterHTML(config);
posterBox.innerHTML = html;

applyThemeToPosterBox(theme);

posterBox.style.padding = '40px';
posterBox.style.width = '800px';
posterBox.style.fontFamily = "'Noto Sans SC', sans-serif";

const bgVar = theme.cssVars['--poster-bg'] || config.bgColor || '#23242a';
const isGradient = bgVar.includes('linear-gradient');
posterBox.style.background = bgVar;

const canvas = await html2canvas(posterBox, {
backgroundColor: isGradient ? null : bgVar,
scale: 2,
useCORS: true,
width: 800,
height: posterBox.scrollHeight
});

return canvas.toDataURL('image/png');
}

// 打开海报编辑页面
async function openPosterEdit() {
if (appState.namesData.length === 0) {
showCustomAlert('暂无计票数据');
return;
}

finishBtn.disabled = true;
finishBtn.textContent = '生成中...';

try {
// 同步颜色选择器显示值与 currentPosterConfig 一致
posterTitleColor.value = currentPosterConfig.titleColor;
posterTitleColorValue.textContent = currentPosterConfig.titleColor;
posterBgColor.value = currentPosterConfig.bgColor;
posterBgColorValue.textContent = currentPosterConfig.bgColor;
posterRankColor.value = currentPosterConfig.rankColor;
posterRankColorValue.textContent = currentPosterConfig.rankColor;
posterScoreColor.value = currentPosterConfig.scoreColor;
posterScoreColorValue.textContent = currentPosterConfig.scoreColor;

// 同步自定义主题下拉菜单的选中状态
updateCustomThemeSelectDisplay();

showPosterLoading();
// 生成初始海报
const dataUrl = await generatePosterImage(currentPosterConfig);
currentPosterDataUrl = dataUrl;
posterPreviewImage.src = dataUrl;
hidePosterLoading();

// 显示编辑页面
posterEditModal.classList.add('show');
finishBtn.disabled = false;
finishBtn.textContent = '完成计票';
} catch (err) {
hidePosterLoading();
showCustomAlert('生成失败：' + err);
finishBtn.disabled = false;
finishBtn.textContent = '完成计票';
}
}

// 关闭海报编辑页面
function closePosterEdit() {
	posterEditModal.classList.add('hiding');
	setTimeout(() => {
		posterEditModal.classList.remove('show');
		posterEditModal.classList.remove('hiding');
	}, 300);
}

// 更新海报预览
async function updatePosterPreview() {
showPosterLoading();
try {
const dataUrl = await generatePosterImage(currentPosterConfig);
currentPosterDataUrl = dataUrl;
posterPreviewImage.src = dataUrl;
} catch (err) {
console.error('更新海报失败:', err);
} finally {
hidePosterLoading();
}
}

// 下载海报
function downloadPoster() {
if (!currentPosterDataUrl) return;

// currentTimeStr 由 post-themes.js 的 getPosterData() 写入（声明也在该文件）
const link = document.createElement('a');
link.download = `计票结果_${currentTimeStr.replace(/:/g, '-')}.png`;
link.href = currentPosterDataUrl;
link.click();
}

// 生成海报（旧函数，保留兼容性）
function genPoster() {
	openPosterEdit();
}

