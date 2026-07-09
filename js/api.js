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
  async getTasks(platform) { return this._get('/api/tasks' + (platform ? '?platform=' + platform : '')); },
  async getTask(id) { return this._get(`/api/tasks/${id}`); },
  async initTask(platform) { return this._post('/api/tasks/init', { platform: platform || 'jst' }); },
  async updateTask(id, data) { return this._put(`/api/tasks/${id}`, data); },
  async deleteTask(id) { return this._del(`/api/tasks/${id}`); },
  async exportTask(id) { return this._get(`/api/tasks/${id}/export`); },
  async pushTask(id, testMode) { return this._post(`/api/tasks/${id}/push`, testMode ? { test_mode: true } : {}); },
  async retryPlan(taskId, planId) { return this._post(`/api/tasks/${taskId}/plans/${planId}/retry`, {}); },
  async getPushPlans(id) { return this._get(`/api/tasks/${id}/plans`); },
  async getUsers() { return this._get('/api/users'); },
  async createUser(username, password, role) { return this._post('/api/users', { username, password, role }); },
  async toggleUser(id) { return this._put(`/api/users/${id}/toggle`, {}); },
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
  return true;
}

async function refreshNavCredits() {
  const el = document.getElementById('navCredits'); if (!el) return;
  const res = await API.getMyCredits();
  if (res.success) el.textContent = res.credits ?? 0;
}

// ========== 登录弹窗 ==========
let loginModalEl = null;

function showLoginModal() {
  if (loginModalEl) { loginModalEl.classList.add('show'); return; }
  loginModalEl = document.createElement('div');
  loginModalEl.className = 'modal-overlay show';
  loginModalEl.style.cssText = 'z-index:9999;background:linear-gradient(135deg,#667eea,#764ba2)';
  loginModalEl.innerHTML = `<div class="login-card" style="margin:auto">
    <div class="login-title">EWS</div>
    <div class="login-subtitle">电商套图批量生成系统</div>
    <form onsubmit="handleLogin(event)" style="max-width:360px;margin:0 auto">
      <div class="form-group"><label class="form-label">用户名</label><input type="text" class="form-input" id="loginUsername" value="admin" style="width:100%"></div>
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
    if (res.user) { localStorage.setItem('ews_username', res.user.username || ''); localStorage.setItem('ews_role', res.user.role || 'user'); }
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
