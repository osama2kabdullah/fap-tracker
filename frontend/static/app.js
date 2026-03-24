// ── CONFIG ──────────────────────────────────────────────
const API = 'https://fap-tracker-api.osama-abdullah.com';

// ── AUTH ─────────────────────────────────────────────────
const Auth = {
  get token()   { return localStorage.getItem('ft_token'); },
  get refresh()  { return localStorage.getItem('ft_refresh'); },
  get user()     {
    try { return JSON.parse(localStorage.getItem('ft_user') || 'null'); }
    catch { return null; }
  },

  save(token, refreshToken, user) {
    localStorage.setItem('ft_token',   token);
    localStorage.setItem('ft_refresh', refreshToken);
    localStorage.setItem('ft_user',    JSON.stringify(user));
  },

  clear() {
    localStorage.removeItem('ft_token');
    localStorage.removeItem('ft_refresh');
    localStorage.removeItem('ft_user');
  },

  isLoggedIn() { return !!this.token; },

  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }
};

// ── HTTP CLIENT ──────────────────────────────────────────
const http = {
  async request(method, path, body, retry = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (Auth.token) headers['Authorization'] = `Bearer ${Auth.token}`;

    const res = await fetch(API + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Auto-refresh if 401
    if (res.status === 401 && retry && Auth.refresh) {
      const ok = await this.tryRefresh();
      if (ok) return this.request(method, path, body, false);
      Auth.clear();
      window.location.href = 'index.html';
      return null;
    }

    return res.json();
  },

  async tryRefresh() {
    try {
      const res = await fetch(API + '/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: Auth.refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('ft_token',   data.data.token);
        localStorage.setItem('ft_refresh', data.data.refreshToken);
        return true;
      }
      return false;
    } catch { return false; }
  },

  get(path)         { return this.request('GET',    path); },
  post(path, body)  { return this.request('POST',   path, body); },
  patch(path, body) { return this.request('PATCH',  path, body); },
  del(path)         { return this.request('DELETE', path); },
};

// ── TOAST ────────────────────────────────────────────────
function showToast(msg, type = 'ok', duration = 3000) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.classList.remove('show'); }, duration);
}

// ── NAV USER CHIP ────────────────────────────────────────
function initNav() {
  const user = Auth.user;
  if (!user) return;

  const chip = document.querySelector('.user-chip');
  if (!chip) return;
  const avatar = chip.querySelector('.user-avatar');
  const name   = chip.querySelector('.user-name');
  if (avatar) avatar.textContent = (user.username || user.email || '?')[0].toUpperCase();
  if (name)   name.textContent   = user.username || user.email;
}

// ── DATE HELPERS ─────────────────────────────────────────
const DateUtils = {
  today()   { return new Date().toISOString().split('T')[0]; },
  ymd(d)    {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
  label(ymd) {
    const [y, m, d] = ymd.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  },
  monthName(year, month) {
    return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  },
  daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  },
  firstDayOfMonth(year, month) {
    return new Date(year, month - 1, 1).getDay(); // 0=Sun
  }
};

// ── LOGOUT ───────────────────────────────────────────────
async function logout() {
  try { await http.post('/auth/logout', { refreshToken: Auth.refresh }); } catch {}
  Auth.clear();
  window.location.href = 'index.html';
}

// ── REDIRECT IF ALREADY LOGGED IN ───────────────────────
function redirectIfLoggedIn() {
  if (Auth.isLoggedIn()) window.location.href = 'calendar.html';
}

// -- MENU TOGGLE FOR MOBILE ---
const menuToggle = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.sidebar');
const drawerOverlay = document.querySelector('.drawer-overlay');
const drawerClose = document.querySelector('.drawer-close');

function openDrawer() {
  sidebar.classList.add('open');
  drawerOverlay.classList.add('active');
  drawerOverlay.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  sidebar.classList.remove('open');
  drawerOverlay.classList.remove('active');
  setTimeout(() => {
    drawerOverlay.style.display = 'none';
  }, 300);
  document.body.style.overflow = '';
}

if (menuToggle) {
  menuToggle.addEventListener('click', openDrawer);
}

if (drawerClose) {
  drawerClose.addEventListener('click', closeDrawer);
}

if (drawerOverlay) {
  drawerOverlay.addEventListener('click', closeDrawer);
}

// Close drawer when clicking a nav link (optional)
const navLinks = document.querySelectorAll('.nav-item');
navLinks.forEach(link => {
  link.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      closeDrawer();
    }
  });
});

// Handle window resize - close drawer if resizing to desktop
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    closeDrawer();
  }
});
