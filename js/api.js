// EWS - API 客户端
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8787'
  : 'https://ewsz.langaj.cc';
const SKU_UPLOAD_MAX_BYTES = 2_000_000;
const SKU_UPLOAD_TARGET_BYTES = 1_800_000;
const SKU_UPLOAD_MAX_PIXELS = 12_000_000;
const SKU_UPLOAD_JPEG_QUALITY = 0.88;

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function isJpegFile(file) {
  return /^image\/(jpeg|jpg)$/i.test(file?.type || '') || /\.jpe?g$/i.test(file?.name || '');
}

async function decodeLocalImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch (_) {
      try {
        const bitmap = await createImageBitmap(file);
        return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
      } catch (_) {}
    }
  }
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法读取 SKU 图片，请重新导出后上传')); };
    image.src = url;
  });
}

async function renderJpeg(source, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('当前浏览器不支持图片处理');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source.image, 0, 0, width, height);
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('SKU 图片转 JPG 失败')), 'image/jpeg', SKU_UPLOAD_JPEG_QUALITY));
  canvas.width = 1;
  canvas.height = 1;
  return blob;
}

async function prepareSkuUploadFile(file) {
  if (isJpegFile(file) && file.size <= SKU_UPLOAD_MAX_BYTES) return file;
  const source = await decodeLocalImage(file);
  try {
    const pixels = Number(source.width) * Number(source.height);
    if (!Number.isSafeInteger(pixels) || pixels < 1) throw new Error('无法读取 SKU 图片尺寸');
    if (pixels > SKU_UPLOAD_MAX_PIXELS) throw new Error('SKU图片像素过大，最大支持1200万像素');
    let width = source.width;
    let height = source.height;
    let output = await renderJpeg(source, width, height);
    if (output.size > SKU_UPLOAD_MAX_BYTES) {
      const scale = Math.min(0.98, Math.sqrt(SKU_UPLOAD_TARGET_BYTES / output.size));
      width = Math.max(1, Math.floor(width * scale));
      height = Math.max(1, Math.floor(height * scale));
      output = await renderJpeg(source, width, height);
    }
    if (output.size > SKU_UPLOAD_MAX_BYTES) throw new Error('SKU图片等比缩小后仍超过2MB，请上传尺寸更小的图片');
    const filename = String(file.name || 'sku-image').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([output], filename, { type: 'image/jpeg', lastModified: file.lastModified || Date.now() });
  } finally {
    source.close();
  }
}

function uploadId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

const API = {
  async login(password, username) { return this._post('/api/auth/login', { password, username }); },
  async verify() { return this._get('/api/auth/verify'); },
  async changePassword(oldPwd, newPwd) { return this._put('/api/auth/password', { old_password: oldPwd, new_password: newPwd }); },
  async getConfig(platform) { return this._get('/api/config' + (platform ? '?platform=' + platform : '')); },
  async updateConfig(config, platform) { const d = { ...config, _platform: platform || '' }; return this._put('/api/config', d); },
  async getGroups() { return this._get('/api/groups'); },
  async createGroup(name) { return this._post('/api/groups', { name }); },
  async updateGroup(id, data) { return this._put(`/api/groups/${id}`, data); },
  async updateGroupTemplates(id, templateProfileIds) { return this._put(`/api/groups/${id}/templates`, { template_profile_ids: templateProfileIds || [] }); },
  async getTasks(platform, page, limit) {
    const params = new URLSearchParams();
    if (platform) params.set('platform', platform);
    if (page) params.set('page', page);
    if (limit) params.set('limit', limit);
    const query = params.toString();
    return this._get('/api/tasks' + (query ? '?' + query : ''));
  },
  async getTask(id) { return this._get(`/api/tasks/${id}`); },
  async initTask(platform) { return this._post('/api/tasks/init', { platform: platform || 'jst' }); },
  async updateTask(id, data) { return this._put(`/api/tasks/${id}`, data); },
  async switchShopeeTaskTemplate(id, templateProfileId) { return this._put(`/api/tasks/${id}/template`, { template_profile_id: templateProfileId }); },
  async deleteTask(id) { return this._del(`/api/tasks/${id}`); },
  async exportTask(id) {
    try {
      const response = await fetch(API_BASE + `/api/tasks/${id}/export`, { headers: this._getAuthHeaders() });
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        const disposition = response.headers.get('Content-Disposition') || '';
        const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
        return { success: response.ok, export_format: 'shopee-xlsx', blob: await response.blob(), filename: encodedName ? decodeURIComponent(encodedName) : 'Shopee_export.xlsx' };
      }
      return await response.json();
    } catch (e) { return { success: false, error: '导出失败: ' + e.message }; }
  },
  async pushTask(id, testMode) { return this._post(`/api/tasks/${id}/push`, testMode ? { test_mode: true } : {}); },
  async retryPlan(taskId, planId) { return this._post(`/api/tasks/${taskId}/plans/${planId}/retry`, {}); },
  async getPushPlans(id) { return this._get(`/api/tasks/${id}/plans`); },
  async getShopeeTemplateProfiles() { return this._get('/api/shopee/template-profiles'); },
  async getShopeeTemplateProfile(id) { return this._get(`/api/shopee/template-profiles/${id}`); },
  async uploadShopeeTemplateProfile(alias, note, file, profileId, isFavorite) {
    const fd = new FormData();
    fd.append('alias', alias || ''); fd.append('note', note || ''); fd.append('is_favorite', isFavorite ? '1' : '0'); fd.append('file', file);
    if (profileId) fd.append('profile_id', profileId);
    return _upload('/api/shopee/template-profiles', fd);
  },
  async updateShopeeTemplateMeta(id, alias, note, isFavorite) { return this._put(`/api/shopee/template-profiles/${id}/meta`, { alias: alias || '', note: note || '', is_favorite: !!isFavorite }); },
  async updateShopeeTemplateProfile(id, data) { return this._put(`/api/shopee/template-profiles/${id}`, data); },
  async updateShopeeTemplateGroups(id, groupIds) { return this._put(`/api/shopee/template-profiles/${id}/groups`, { group_ids: groupIds || [] }); },
  async mapShopeeTemplateField(profileId, versionId, token, semanticKey) { return this._put(`/api/shopee/template-profiles/${profileId}/versions/${versionId}/fields/${encodeURIComponent(token)}`, { semantic_key: semanticKey }); },
  async deleteShopeeTemplateProfile(id) { return this._del(`/api/shopee/template-profiles/${id}`); },
  async getUsers() { return this._get('/api/users'); },
  async createUser(username, password, role, platformAccess, imageConcurrencyLimit, groupId) { return this._post('/api/users', { username, password, role, platform_access: platformAccess || 'allow', image_concurrency_limit: imageConcurrencyLimit || 20, group_id: groupId || 'default' }); },
  async toggleUser(id) { return this._put(`/api/users/${id}/toggle`, {}); },
  async resetPassword(id) { return this._put(`/api/users/${id}/reset-password`, {}); },
  async deleteUser(id) { return this._del(`/api/users/${id}`); },
  async updateUserPlatform(id, platformAccess) { return this._put(`/api/users/${id}/platform`, { platform_access: platformAccess || 'allow' }); },
  async updateUserConcurrency(id, imageConcurrencyLimit) { return this._put(`/api/users/${id}/concurrency`, { image_concurrency_limit: imageConcurrencyLimit }); },
  async updateUserGroup(id, groupId) { return this._put(`/api/users/${id}/group`, { group_id: groupId }); },
  async updateUserCredits(id, action, amount) { return this._put(`/api/users/${id}/credits`, { action, amount }); },
  async getMyCredits() { return this._get('/api/users/me/credits'); },
  async getUserWebhook(id) { return this._get(`/api/users/${id}/webhook`); },
  async updateUserWebhook(id, cfg) { return this._put(`/api/users/${id}/webhook`, cfg); },
  async uploadFile(taskId, file, folder) {
    const targetFolder = folder || 'uploads';
    const maxBytes = targetFolder === 'size-chart' ? 2 * 1024 * 1024 : 10 * 1024 * 1024;
    if (!file || typeof file.size !== 'number') return { success: false, error: '请选择有效文件' };
    if (file.size > maxBytes) return { success: false, error: targetFolder === 'size-chart' ? '尺码表文件不能超过 2MB' : '文件大小不能超过 10MB' };
    if (targetFolder === 'sku-upload' && file.type && !/^image\/(jpeg|jpg|png)$/i.test(file.type) && file.type !== 'application/octet-stream') return { success: false, error: 'SKU成品图仅支持 JPG 或 PNG' };
    let preparedFile = file;
    if (targetFolder === 'sku-upload') {
      try { preparedFile = await prepareSkuUploadFile(file); }
      catch (error) { return { success: false, error: error.message || 'SKU图片处理失败' }; }
    }
    const fd = new FormData(); fd.append('file', preparedFile); fd.append('task_id', taskId); fd.append('folder', targetFolder); fd.append('upload_id', uploadId());
    if (targetFolder === 'sku-upload') fd.append('client_processed', '1');
    return _upload(`/api/upload`, fd);
  },
  // 内部方法
  _get(url) { return _handleResponse(fetch(API_BASE + url, { headers: this._getAuthHeaders() })); },
  _post(url, data) { return _handleResponse(fetch(API_BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...this._getAuthHeaders() }, body: JSON.stringify(data) })); },
  _put(url, data) { return _handleResponse(fetch(API_BASE + url, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...this._getAuthHeaders() }, body: JSON.stringify(data) })); },
  _del(url) { return _handleResponse(fetch(API_BASE + url, { method: 'DELETE', headers: this._getAuthHeaders() })); },
  _getAuthHeaders() { const t = localStorage.getItem('ews_token'); return t ? { 'Authorization': 'Bearer ' + t } : {}; },
  _setToken(token) { localStorage.setItem('ews_token', token); document.cookie = `ews_token=${encodeURIComponent(token)}; path=/; max-age=86400; SameSite=Lax`; },
  _clearToken() { localStorage.removeItem('ews_token'); document.cookie = 'ews_token=; path=/; max-age=0'; },
  _getToken() { return localStorage.getItem('ews_token'); },
};

async function _handleResponse(promise) {
  try { const res = await promise; const data = await res.json(); return data; }
  catch (e) { return { success: false, error: '网络错误: ' + e.message }; }
}
async function _upload(url, formData) {
  const token = localStorage.getItem('ews_token');
  const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
  let lastError = null;
  const retryDelays = [0, 1200, 3000, 6000];
  for (let attempt = 0; attempt < retryDelays.length; attempt++) {
    if (retryDelays[attempt]) await wait(retryDelays[attempt]);
    try {
      const res = await fetch(API_BASE + url, { method: 'POST', headers, body: formData });
      const text = await res.text();
      try {
        const result = JSON.parse(text);
        if (res.status >= 500 && attempt < retryDelays.length - 1) { lastError = new Error(result.error || `HTTP ${res.status}`); continue; }
        return result;
      }
      catch (_) {
        if (res.status >= 500 && attempt < retryDelays.length - 1) { lastError = new Error(`HTTP ${res.status}`); continue; }
        return { success: false, error: `上传失败: HTTP ${res.status}${text ? '，服务器未返回有效 JSON' : ''}` };
      }
    } catch (e) {
      lastError = e;
    }
  }
  return { success: false, error: '上传失败，已自动重试: ' + (lastError?.message || '网络连接异常') };
}

// 全局认证检查
async function requireAuth() {
  const token = localStorage.getItem('ews_token');
  if (!token) { showLoginModal(); return false; }
  const res = await API.verify();
  if (!res.success) { showLoginModal(); return false; }
  localStorage.setItem('ews_role', res.role || 'user');
  localStorage.setItem('ews_username', res.username || '');
  localStorage.setItem('ews_platform_access', res.platform_access || 'allow');
  if (window.renderEwsNav) window.renderEwsNav();
  return true;
}

async function refreshNavCredits() {
  const el = document.getElementById('navCredits'); if (!el) return;
  const btn = document.getElementById('navRefreshCredits');
  const oldText = btn ? btn.textContent : '';
  if (btn?.dataset.loading === '1') return;
  if (btn) { btn.dataset.loading = '1'; btn.textContent = '刷新中'; btn.classList.add('is-loading'); }
  try {
    const res = await API.getMyCredits();
    if (res.success) el.textContent = res.credits ?? 0;
    else showToast(res.error || '算力刷新失败', 'error');
  } catch (e) {
    showToast('算力刷新失败: ' + e.message, 'error');
  } finally {
    if (btn) { btn.dataset.loading = '0'; btn.textContent = oldText || '刷新'; btn.classList.remove('is-loading'); }
  }
}

// ========== 登录弹窗 ==========
let loginModalEl = null;

function showLoginModal() {
  if (loginModalEl) { loginModalEl.classList.add('show'); return; }
  loginModalEl = document.createElement('div');
  loginModalEl.className = 'modal-overlay show';
  loginModalEl.style.zIndex = '9999';
  loginModalEl.innerHTML = `<div class="login-card" style="margin:auto">
    <div class="login-title">EWS</div>
    <div class="login-subtitle">电商套图批量生成系统</div>
    <form onsubmit="handleLogin(event)" style="max-width:360px;margin:0 auto">
      <div class="form-group"><label class="form-label">用户名</label><input type="text" class="form-input" id="loginUsername" style="width:100%"></div>
      <div class="form-group"><label class="form-label">密码</label><input type="password" class="form-input" id="loginPassword" style="width:100%"></div>
      <button type="submit" class="btn btn-primary" id="loginBtn" style="width:100%;justify-content:center">登录</button>
      <div id="loginError" style="color:var(--danger);font-size:13px;margin-top:8px;text-align:center"></div>
    </form>
  </div>`;
  document.body.appendChild(loginModalEl);
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim() || 'admin';
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn'); btn.disabled = true; btn.textContent = '登录中...';
  const res = await API.login(password, username);
  if (res.success) {
    API._setToken(res.token);
    if (res.user) { localStorage.setItem('ews_username', res.user.username || ''); localStorage.setItem('ews_role', res.user.role || 'user'); localStorage.setItem('ews_platform_access', res.user.platform_access || 'allow'); }
    hideLoginModal();
    location.reload();
  } else {
    document.getElementById('loginError').textContent = res.error || '登录失败';
    btn.disabled = false; btn.textContent = '登录';
  }
}

function hideLoginModal() { if (loginModalEl) { loginModalEl.classList.remove('show'); loginModalEl.remove(); loginModalEl = null; } }

function handleLogout() {
  API._clearToken();
  localStorage.removeItem('ews_role');
  localStorage.removeItem('ews_username');
  localStorage.removeItem('ews_platform_access');
  location.reload();
}

function showToast(msg, type) {
  const t = document.createElement('div');
  t.className = 'toast toast-' + (type || 'info');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

window.API = API;
window.requireAuth = requireAuth;
window.refreshNavCredits = refreshNavCredits;
window.showLoginModal = showLoginModal;
window.handleLogin = handleLogin;
window.hideLoginModal = hideLoginModal;
window.handleLogout = handleLogout;
window.showToast = showToast;
