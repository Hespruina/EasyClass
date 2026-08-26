// 导出Excel功能
function exportToExcel() {
const rankedData = getRankedData();
if (rankedData.length === 0) {
showCustomAlert('暂无计票数据');
return;
}

// 构建CSV内容（UTF-8 BOM 以支持中文）
const BOM = '\uFEFF';
let csvContent = BOM;

// 添加表头
csvContent += '排名,姓名,得票数\n';

// 添加数据
rankedData.forEach((item, index) => {
const rank = index + 1;
const name = item.name;
const votes = appState.votes[item.name] || 0;
csvContent += `${rank},${name},${votes}\n`;
});

// 创建Blob并下载
const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
const link = document.createElement('a');
const now = new Date();
const timeStr = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
link.download = `计票结果_${timeStr}.csv`;
link.href = URL.createObjectURL(blob);
link.click();
URL.revokeObjectURL(link.href);
}

// 打开导出方式选择弹窗
function openExportModal() {
if (appState.namesData.length === 0) {
showCustomAlert('暂无计票数据');
return;
}
exportModal.classList.add('show');
}

// 关闭导出方式选择弹窗
function closeExportModal() {
	exportModal.classList.add('hiding');
	setTimeout(() => {
		exportModal.classList.remove('show');
		exportModal.classList.remove('hiding');
	}, 300);
}

// 处理导出选项点击
function handleExportExcel() {
closeExportModal();
exportToExcel();
}

function handleExportPoster() {
closeExportModal();
openPosterEdit();
}

async function handleExportBoth() {
closeExportModal();
// 先导出Excel
exportToExcel();
// 再打开海报编辑
await openPosterEdit();
}