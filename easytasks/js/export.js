// 导出当前任务的完成情况为 CSV（UTF-8 BOM，Excel 可直接打开）
function csvCell(value) {
    const text = String(value === undefined || value === null ? '' : value);
    return '"' + text.replace(/"/g, '""') + '"';
}

function exportToExcel(taskName) {
    if (!appState.namesData || appState.namesData.length === 0) {
        showCustomAlert('暂无可导出的任务数据');
        return;
    }

    const BOM = '\uFEFF';
    let csvContent = BOM + '姓名,进度(%),星级,状态\n';

    appState.namesData.forEach(function (item) {
        const progress = getProgress(item.name);
        const stars = getStars(item.name);
        csvContent += [
            csvCell(item.name),
            progress,
            stars,
            getStudentStatus(item.name) === 'done' ? '已完成'
                : (getStudentStatus(item.name) === 'doing' ? '进行中' : '未开始')
        ].join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const now = new Date();
    const timeStr = now.getFullYear() +
        pad2(now.getMonth() + 1) + pad2(now.getDate()) + '_' +
        pad2(now.getHours()) + pad2(now.getMinutes());
    const namePart = (taskName || currentTaskName || '任务').replace(/[\\/:*?"<>|]/g, '_');
    link.download = '任务结果_' + namePart + '_' + timeStr + '.csv';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
}
