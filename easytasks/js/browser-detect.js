// 禁止按下 F12 以及相关快捷键
document.addEventListener('keydown', function(event) {
// 禁止 F12
if (event.key === 'F12' || (event.key === 'F12' && event.code === 'F12')) {
event.preventDefault();
}
// 禁止 Ctrl+Shift+I
if (event.ctrlKey && event.shiftKey && event.key === 'I') {
event.preventDefault();
}
// 禁止 Ctrl+Shift+J
if (event.ctrlKey && event.shiftKey && event.key === 'J') {
event.preventDefault();
}
// 禁止 Ctrl+U
if (event.ctrlKey && event.key === 'U') {
event.preventDefault();
}
// 禁止 F12（另一种检测方式）
if (event.keyCode === 123) {
event.preventDefault();
}
// 禁止 Ctrl+Shift+I（另一种检测方式）
if (event.keyCode === 73 && event.ctrlKey && event.shiftKey) {
event.preventDefault();
}
// 禁止 Ctrl+Shift+J（另一种检测方式）
if (event.keyCode === 74 && event.ctrlKey && event.shiftKey) {
event.preventDefault();
}
// 禁止 Ctrl+U（另一种检测方式）
if (event.keyCode === 85 && event.ctrlKey) {
event.preventDefault();
}
});
document.addEventListener('DOMContentLoaded', function() {
// 检测用户代理字符串
const userAgent = navigator.userAgent.toLowerCase();
// 检测是否为 Chrome 或 Firefox
const isChrome = /chrome/.test(userAgent) && /google inc/.test(navigator.vendor.toLowerCase());
const isFirefox = /firefox/.test(userAgent);
// 如果不是 Chrome 或 Firefox，弹出警告框
if (!isChrome && !isFirefox) {
alert("您的浏览器内核不符合要求，请使用 Chrome、Microsoft Edge 或 Firefox 浏览器以获得最佳体验！（在此类设备中出现任何问题概不负责）");
}
// 检测用户代理字符串
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
// 如果是移动设备，弹出提示框
if (isMobile) {
alert("您似乎正在使用移动设备访问，为避免影响使用的 bug 出现，请使用电脑设备！（在此类设备中出现任何问题概不负责）");
}
});
// 检测浏览器内核版本
function checkBrowserVersion() {
const userAgent = navigator.userAgent;
const chromeAgent = userAgent.indexOf("Chrome") > -1;
const edgeAgent = userAgent.indexOf("Edg") > -1; // Edge (Chromium-based)
const safariAgent = userAgent.indexOf("Safari") > -1 && userAgent.indexOf("Chrome") == -1 && userAgent.indexOf("Edg") == -1;
const firefoxAgent = userAgent.indexOf("Firefox") > -1;
let browserName = "Unknown";
let fullVersion = "Unknown";
if (chromeAgent || edgeAgent) {
const temp = userAgent.split(/(?:Chrome|Edg|Safari)[\/]+(\d+\.\d+\.\d+\.\d+)/)[1];
if (temp) {
fullVersion = temp;
browserName = chromeAgent ? "Chrome" : "Edge";
}
} else if (firefoxAgent) {
const temp = userAgent.split(/Firefox\/(\d+\.\d+)/)[1];
if (temp) {
fullVersion = temp;
browserName = "Firefox";
}
} else if (safariAgent) {
const temp = userAgent.split(/Version\/(\d+\.\d+\.\d+)/)[1];
if (temp) {
fullVersion = temp;
browserName = "Safari";
}
}
const versionNumber = parseInt(fullVersion.split('.')[0], 10);
// 设置最低版本要求
const minVersion = 80;
if (browserName === "Chrome" && versionNumber < minVersion) {
alert(`您的 Chrome 浏览器版本过低，请升级到至少版本 ${minVersion} 以获得最佳体验。`);
} else if (browserName === "Edge" && versionNumber < minVersion) {
alert(`您的 Edge 浏览器版本过低，请升级到至少版本 ${minVersion} 以获得最佳体验。`);
}
}
// 页面加载完成后执行检测
window.onload = function() {
checkBrowserVersion();
};