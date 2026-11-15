// 易积分 · API 封装与常量
export const API_BASE = '/easycore/api';
export const CONSOLE_URL = '/easycore/?tab=score';

async function request(path, options = {}) {
  const res = await fetch(path, { credentials: 'include', ...options });
  let data = null;
  try { data = await res.json(); } catch (e) { /* 非 JSON 响应 */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || ('请求失败 (' + res.status + ')'));
    err.status = res.status;
    throw err;
  }
  return data;
}

export function apiGet(path) {
  return request(path);
}
export function apiPost(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
}
export function apiPut(path, body) {
  return request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
}
