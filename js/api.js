// EWS - API 客户端
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8787'
  : 'https://ewsz.langaj.cc';

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
    const fd = new FormData(); fd.append('file', file); fd.append('task_id', taskId); fd.append('folder', folder || 'uploads');
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
  try { const res = await fetch(API_BASE + url, { method: 'POST', headers, body: formData }); return await res.json(); }
  catch (e) { return { success: false, error: '上传失败: ' + e.message }; }
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
