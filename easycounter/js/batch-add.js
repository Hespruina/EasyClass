// 批量添加名字的 DOM 引用和事件监听（在 DOM 加载后）
const batchAddNamesBtn = document.getElementById('batchAddNamesBtn');
const batchAddNamesModal = document.getElementById('batchAddNamesModal');
const batchAddNamesInput = document.getElementById('batchAddNamesInput');
const cancelBatchAddBtn = document.getElementById('cancelBatchAddBtn');
const confirmBatchAddBtn = document.getElementById('confirmBatchAddBtn');

batchAddNamesBtn.addEventListener('click', openBatchAddNamesModal);
cancelBatchAddBtn.addEventListener('click', closeBatchAddNamesModal);
confirmBatchAddBtn.addEventListener('click', batchAddNames);
batchAddNamesModal.addEventListener('click', (e) => {
if (e.target === batchAddNamesModal) {
closeBatchAddNamesModal();
}
});
batchAddNamesInput.addEventListener('keydown', (e) => {
if (e.key === 'Enter' && e.ctrlKey) {
batchAddNames();
}
});