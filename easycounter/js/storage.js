/*
 * 本地存储工具 —— 只存 UI 偏好，不再存任何计票数据。
 *
 * 2026-11-14 起 EasyCounter 改为纯云端模式：名单、票数、排名、拼音分组全部
 * 保存在 EasyCore 的 counter.db，每个操作即时落库并通过 WebSocket 多端同步。
 * 这里仅保留「操作模式 / 快速查找 / 外观主题」三项本机偏好。
 */
const Storage = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem('easyCounter_' + key);
            return item === null ? defaultValue : JSON.parse(item);
        } catch (e) {
            return defaultValue;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem('easyCounter_' + key, JSON.stringify(value));
        } catch (e) {
            console.error('Storage error:', e);
        }
    },
    remove(key) {
        try {
            localStorage.removeItem('easyCounter_' + key);
        } catch (e) {
            console.error('Storage remove error:', e);
        }
    }
};
