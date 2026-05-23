/**
 * SSE Live Exchange Ticker — app.js v7
 * Auth is now OPTIONAL for browsing; gated for star/chart actions.
 */

'use strict';

// ─── Translations & Language ────────────────────────────────────────────────────
const translations = {
  en: {
    'searchPlaceholder': 'Search symbol or company…',
    'tabAll': 'All',
    'tabWatchlist': '⭐ Watchlist',
    'tabGainers': 'Gainers',
    'tabLosers': 'Losers',
    'colSymbol': 'Symbol',
    'colCompany': 'Company',
    'colSector': 'Sector',
    'colPrice': 'Price',
    'colChange': 'Change',
    'colChangePct': 'Change %',
    'colVolume': 'Volume',
    'colTrend': 'Trend',
    'statGainers': 'Gainers',
    'statLosers': 'Losers',
    'statUpdates': 'Updates',
    'emptySearch': 'No stocks match your search.',
    'footerSimulated': 'Prices are simulated via a random-walk algorithm',
    'menuLogin': 'Login / Register',
    'menuLogout': 'Logout',
    'menuPortfolio': '💼 Portfolio',
    'menuTheme': '🎨 Theme',
    'menuLanguage': '🌍 Language (EN)'
  },
  tr: {
    'searchPlaceholder': 'Sembol veya şirket ara…',
    'tabAll': 'Tümü',
    'tabWatchlist': '⭐ İzleme Listem',
    'tabGainers': 'Kazananlar',
    'tabLosers': 'Kaybedenler',
    'colSymbol': 'Sembol',
    'colCompany': 'Şirket',
    'colSector': 'Sektör',
    'colPrice': 'Fiyat (USD)',
    'colChange': 'Değişim',
    'colChangePct': 'Değişim %',
    'colVolume': 'Hacim',
    'colTrend': 'Grafik',
    'statGainers': 'Yükselen',
    'statLosers': 'Düşen',
    'statUpdates': 'Güncelleme',
    'emptySearch': 'Aramanızla eşleşen hisse bulunamadı.',
    'footerSimulated': 'Fiyatlar rastgele yürüyüş algoritması ile simüle edilmiştir',
    'menuLogin': 'Giriş / Kayıt',
    'menuLogout': 'Çıkış Yap',
    'menuPortfolio': '💼 Portföyüm',
    'menuTheme': '🎨 Tema',
    'menuLanguage': '🌍 Dil (TR)'
  }
};

let currentLang = localStorage.getItem('lang') || 'en';

function setLanguage(lang) {
  if (!translations[lang]) return;
  currentLang = lang;
  localStorage.setItem('lang', lang);
  
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) {
      if (el.tagName === 'INPUT' && el.placeholder !== undefined) {
        el.placeholder = translations[lang][key];
      } else {
        // Keep potential child elements like sort arrows if necessary,
        // but for pure text elements just set textContent.
        // If it's a sort button, we only replace the text node before the arrow span.
        if (el.classList.contains('sort-btn')) {
          el.childNodes[0].nodeValue = translations[lang][key] + ' ';
        } else {
          el.innerHTML = translations[lang][key]; // innerHTML supports <strong> tags e.g in footer
        }
      }
    }
  });

  // Update menu language text
  const langBtnText = document.getElementById('menuLangText');
  if (langBtnText) langBtnText.textContent = translations[lang]['menuLanguage'];
  
  updateUserArea(); // Refresh login/logout text
}

// ─── State ────────────────────────────────────────────────────────────────────
let authToken = localStorage.getItem('token');
let refreshToken = localStorage.getItem('refreshToken');

// ─── Theme ────────────────────────────────────────────────────────────────────
(function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  // mark active option once DOM is ready
  document.addEventListener('DOMContentLoaded', () => highlightThemeOption(saved));
})();

function highlightThemeOption(theme) {
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

document.querySelectorAll('.theme-option').forEach(btn => {
  btn.addEventListener('click', () => {
    const theme = btn.dataset.theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    highlightThemeOption(theme);
    // Let the body click handler or explicit hamburger logic close the menu
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    if (hamburgerMenu) hamburgerMenu.classList.remove('open');
  });
});

// ─── Header & Menu ────────────────────────────────────────────────────────────

// The user area logic gets absorbed into the Hamburger menu items.
function updateUserArea() {
  const menuAuthBtn = document.getElementById('menuAuthBtn');
  if (!menuAuthBtn) return;
  
  if (authToken) {
    const email = localStorage.getItem('userEmail') || '?';
    menuAuthBtn.innerHTML = `👤 ${translations[currentLang]['menuLogout']} (${email.split('@')[0]})`;
    menuAuthBtn.onclick = async () => {
      const tokenToRevoke = refreshToken;
      if (tokenToRevoke) {
        await authedFetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: tokenToRevoke })
        }).catch(() => {});
      }
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userEmail');
      authToken = null;
      refreshToken = null;
      favorites = new Set();
      alerts = [];
      updateUserArea();
      applyFilterAndSort();
    };
  } else {
    menuAuthBtn.innerHTML = `👤 ${translations[currentLang]['menuLogin']}`;
    menuAuthBtn.onclick = () => {
      openAuthModal();
      document.getElementById('hamburgerMenu').classList.remove('open');
    };
  }
}

async function refreshSession() {
  if (!refreshToken) return false;

  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  if (!res.ok) return false;

  const data = await res.json();
  authToken = data.access_token || data.token;
  refreshToken = data.refresh_token;
  localStorage.setItem('token', authToken);
  localStorage.setItem('refreshToken', refreshToken);
  return true;
}

async function authedFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);

  let res = await fetch(url, { ...options, headers });
  if ((res.status === 401 || res.status === 403) && await refreshSession()) {
    const retryHeaders = new Headers(options.headers || {});
    retryHeaders.set('Authorization', `Bearer ${authToken}`);
    res = await fetch(url, { ...options, headers: retryHeaders });
  }
  return res;
}

// Menu toggle logic
const hamburgerBtn = document.getElementById('hamburgerBtn');
const hamburgerMenu = document.getElementById('hamburgerMenu');

hamburgerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  hamburgerMenu.classList.toggle('open');
});

document.addEventListener('click', (e) => {
  if (hamburgerMenu && !hamburgerMenu.contains(e.target) && e.target !== hamburgerBtn) {
    hamburgerMenu.classList.remove('open');
  }
});

// Menu item events
document.getElementById('menuPortfolioBtn').addEventListener('click', () => {
  if (!authToken) openAuthModal('Sign in to view Portfolio 💼');
  else alert('Portfolio feature coming soon!');
});

document.getElementById('menuLangBtn').addEventListener('click', () => {
  setLanguage(currentLang === 'en' ? 'tr' : 'en');
});

// ─── In-App Auth Modal ────────────────────────────────────────────────────────
const authModal             = document.getElementById('authModal');
const closeAuthModal        = document.getElementById('closeAuthModal');
const modalAuthForm         = document.getElementById('modalAuthForm');
const modalEmail            = document.getElementById('modalEmail');
const modalPassword         = document.getElementById('modalPassword');
const modalConfirmPassword  = document.getElementById('modalConfirmPassword');
const confirmPasswordGroup  = document.getElementById('confirmPasswordGroup');
const modalFormError        = document.getElementById('modalFormError');
const modalSubmitBtn        = document.getElementById('modalSubmitBtn');
const authModalHint         = document.getElementById('authModalHint');
const authSwitchLink        = document.getElementById('authSwitchLink');
const authForgotLink        = document.getElementById('authForgotLink');
const authGoogleBtn         = document.getElementById('authGoogleBtn');

// New UI Elements
const authModalTitle    = document.getElementById('authModalTitle');
const authModalSubtitle = document.getElementById('authModalSubtitle');
const authIconLogin     = document.getElementById('authIconLogin');
const authIconRegister  = document.getElementById('authIconRegister');

let authMode = 'login'; // 'login' | 'register'

function openAuthModal(message) {
  modalFormError.textContent = message || '';
  modalEmail.value = '';
  modalPassword.value = '';
  modalConfirmPassword.value = '';
  authModal.classList.add('active');
  modalEmail.focus();
}

function closeModal() {
  authModal.classList.remove('active');
}

closeAuthModal.addEventListener('click', closeModal);
authModal.addEventListener('click', (e) => {
  if (e.target === authModal) closeModal();
});

function setAuthMode(mode) {
  authMode = mode;
  modalFormError.textContent = '';
  
  if (mode === 'login') {
    authModalTitle.textContent = 'Welcome back';
    authModalSubtitle.textContent = 'Log in to your account';
    authIconLogin.style.display = 'block';
    authIconRegister.style.display = 'none';
    
    confirmPasswordGroup.style.display = 'none';
    modalConfirmPassword.removeAttribute('required');
    authForgotLink.style.display = 'block';
    
    modalSubmitBtn.textContent = 'Log in';
    authModalHint.innerHTML = `Don't have an account? <a href="#" id="authSwitchLink">Create one</a>`;
  } else {
    authModalTitle.textContent = 'Create your account';
    authModalSubtitle.textContent = 'Sign up to get started';
    authIconLogin.style.display = 'none';
    authIconRegister.style.display = 'block';
    
    confirmPasswordGroup.style.display = 'block';
    modalConfirmPassword.setAttribute('required', 'true');
    authForgotLink.style.display = 'none';
    
    modalSubmitBtn.textContent = 'Create account';
    authModalHint.innerHTML = `Already have an account? <a href="#" id="authSwitchLink">Log in</a>`;
  }
  
  // re-bind the switch link after innerHTML change
  document.getElementById('authSwitchLink').addEventListener('click', (e) => {
    e.preventDefault();
    setAuthMode(authMode === 'login' ? 'register' : 'login');
  });
}

authSwitchLink.addEventListener('click', (e) => {
  e.preventDefault();
  setAuthMode(authMode === 'login' ? 'register' : 'login');
});

authGoogleBtn.addEventListener('click', () => {
  alert('Google OAuth integration coming soon! Please use email/password for the demo.');
});

modalAuthForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email    = modalEmail.value.trim();
  const password = modalPassword.value;
  
  if (authMode === 'register') {
    const confirmPassword = modalConfirmPassword.value;
    if (password !== confirmPassword) {
      modalFormError.textContent = 'Passwords do not match.';
      return;
    }
  }

  modalFormError.textContent = '';
  modalSubmitBtn.textContent = authMode === 'login' ? 'Logging in…' : 'Creating account…';
  modalSubmitBtn.disabled = true;

  try {
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      authToken = data.access_token || data.token;
      refreshToken = data.refresh_token;
      localStorage.setItem('token', authToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('userEmail', email);
      closeModal();
      updateUserArea();
      // load user data now that we're authed
      Promise.all([loadFavorites(), loadAlerts()]).then(() => applyFilterAndSort());
    } else {
      modalFormError.textContent = data.error || data.message || 'Something went wrong.';
    }
  } catch (err) {
    modalFormError.textContent = 'Network error — please try again.';
  } finally {
    modalSubmitBtn.textContent = authMode === 'login' ? 'Log in' : 'Create account';
    modalSubmitBtn.disabled = false;
  }
});

// ─── State ────────────────────────────────────────────────────────────────────
let stockData    = [];
let filteredData = [];
let sortCol      = 'symbol';
let sortDir      = 'asc';
let updateCount  = 0;
let searchQuery  = '';
let currentTab   = 'all';
let source       = null;
let favorites    = new Set();
const isReportCaptureMode = new URLSearchParams(window.location.search).has('capture');

async function loadFavorites() {
  if (!authToken) return;
  try {
    const res = await authedFetch('/api/favorites');
    if (res.ok) favorites = new Set(await res.json());
  } catch (err) {}
}

window.toggleFavorite = async function(symbol) {
  if (!authToken) {
    openAuthModal('Sign in to save favorites ⭐');
    return;
  }
  const isFav = favorites.has(symbol);
  const method = isFav ? 'DELETE' : 'POST';
  try {
    const res = await authedFetch(`/api/favorites/${symbol}`, { method });
    if (res.ok) {
      if (isFav) favorites.delete(symbol);
      else favorites.add(symbol);
      applyFilterAndSort();
    }
  } catch (err) {}
};

let alerts = [];

async function loadAlerts() {
  if (!authToken) return;
  try {
    const res = await authedFetch('/api/alerts');
    if (res.ok) alerts = await res.json();
  } catch (err) {}
}

window.deleteAlert = async function(id) {
  try {
    const res = await authedFetch(`/api/alerts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      alerts = alerts.filter(a => a.id !== id);
      renderAlertsList();
    }
  } catch (e) {}
};

async function checkAlerts(data) {
  if (!authToken || Notification.permission !== 'granted') return;
  for (let i = alerts.length - 1; i >= 0; i--) {
    const alert = alerts[i];
    const stock = data.find(s => s.symbol === alert.symbol);
    if (!stock) continue;
    const triggered =
      (alert.direction === 'above' && stock.price >= alert.target_price) ||
      (alert.direction === 'below' && stock.price <= alert.target_price);
    if (triggered) {
      new Notification(`Alert: ${alert.symbol}`, {
        body: `${alert.symbol} crossed ${alert.target_price} (Current: $${stock.price})`,
        icon: '📈'
      });
      await authedFetch(`/api/alerts/${alert.id}`, { method: 'DELETE' });
      alerts.splice(i, 1);
    }
  }
}

// ─── Mini history per symbol ──────────────────────────────────────────────────
const priceHistory = {};
const ICONS = {
  star: `<svg class="action-icon star-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.65 5.37 5.92.86-4.28 4.17 1.01 5.89L12 17l-5.3 2.79 1.01-5.89-4.28-4.17 5.92-.86L12 3.5Z"/></svg>`,
  bell: `<svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
};

// ─── DOM References ───────────────────────────────────────────────────────────
const tbody       = document.getElementById('tickerBody');
const emptyState  = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const statusPill  = document.getElementById('statusPill');
const statusDot   = document.getElementById('statusDot');
const statusText  = document.getElementById('statusText');
const clockEl     = document.getElementById('clock');
const statGainers = document.getElementById('statGainers');
const statLosers  = document.getElementById('statLosers');
const statUpdates = document.getElementById('statUpdates');
const sortButtons = document.querySelectorAll('.sort-btn');

// ─── Clock ────────────────────────────────────────────────────────────────────
function updateClock() {
  clockEl.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// ─── SSE Connection ───────────────────────────────────────────────────────────
function connect() {
  setStatus('connecting');
  source = new EventSource('/events');

  source.onopen = () => {
    setStatus('connected');
  };

  source.onmessage = (e) => {
    try {
      handleUpdate(JSON.parse(e.data));
    } catch (err) {
      console.error('[SSE] Parse error:', err);
    }
  };

  source.onerror = () => {
    if (isReportCaptureMode && stockData.length > 0) {
      setStatus('connected');
      return;
    }
    setStatus('error');
  };
}

function setStatus(state) {
  statusPill.className = 'status-pill ' + (state === 'connected' ? 'connected' : state === 'error' ? 'error' : '');
  statusText.textContent =
    state === 'connected' ? 'Live' :
    state === 'error'     ? 'Reconnecting…' :
                            'Connecting…';
}

// ─── Data Handler ─────────────────────────────────────────────────────────────
let chartLastTime = Math.floor(Date.now() / 1000);
window.fullChartHistory = {};

function handleUpdate(data) {
  chartLastTime += 2;
  const nowT = chartLastTime;

  data.forEach(s => {
    if (!priceHistory[s.symbol]) priceHistory[s.symbol] = [];
    priceHistory[s.symbol].push(s.price);
    if (priceHistory[s.symbol].length > 20) priceHistory[s.symbol].shift();

    if (!window.fullChartHistory[s.symbol]) {
      let fakeData = [];
      let currentClose = s.price;
      for (let i = 0; i < 60; i++) {
        let currentOpen = currentClose * (1 + (Math.random() - 0.5) * 0.01);
        let high = Math.max(currentOpen, currentClose) * (1 + Math.random() * 0.002);
        let low  = Math.min(currentOpen, currentClose) * (1 - Math.random() * 0.002);
        fakeData.unshift({ time: nowT - (i + 1) * 2, open: currentOpen, high, low, close: currentClose });
        currentClose = currentOpen;
      }
      window.fullChartHistory[s.symbol] = fakeData;
    }

    const lastP  = window.fullChartHistory[s.symbol][window.fullChartHistory[s.symbol].length - 1];
    const nOpen  = lastP ? lastP.close : s.price;
    const nClose = s.price;
    const nHigh  = Math.max(nOpen, nClose) * (1 + Math.random() * 0.001);
    const nLow   = Math.min(nOpen, nClose) * (1 - Math.random() * 0.001);
    window.fullChartHistory[s.symbol].push({ time: nowT, open: nOpen, high: nHigh, low: nLow, close: nClose });
    if (window.fullChartHistory[s.symbol].length > 200) window.fullChartHistory[s.symbol].shift();
  });

  stockData = data;
  updateCount++;
  statUpdates.textContent = updateCount;
  statGainers.textContent = data.filter(s => s.changePct > 0).length;
  statLosers.textContent  = data.filter(s => s.changePct < 0).length;

  checkAlerts(data);

  if (activeSymbol && candleSeries) {
    const stock = data.find(s => s.symbol === activeSymbol);
    if (stock) updateTfChart(activeSymbol, stock.price, nowT);
  }

  applyFilterAndSort();
}

// ─── Filter & Sort ────────────────────────────────────────────────────────────
function applyFilterAndSort() {
  const q = searchQuery.toLowerCase().trim();

  filteredData = stockData.filter(s => {
    if (q && !s.symbol.toLowerCase().includes(q) &&
        !s.name.toLowerCase().includes(q) &&
        !s.sector.toLowerCase().includes(q)) return false;
    if (currentTab === 'watchlist') return favorites.has(s.symbol);
    if (currentTab === 'gainers')   return s.changePct > 0;
    if (currentTab === 'losers')    return s.changePct < 0;
    if (currentTab === 'bist')      return s.type === 'bist';
    if (currentTab === 'crypto')    return s.type === 'crypto';
    if (currentTab === 'forex')     return s.type === 'forex';
    return true;
  });

  filteredData.sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortDir === 'asc' ? -1 :  1;
    if (va > vb) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  renderTable();
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function renderTable() {
  if (filteredData.length === 0 && stockData.length > 0) {
    emptyState.hidden = false;
    tbody.innerHTML = '';
    return;
  }
  emptyState.hidden = true;

  const existing = Array.from(tbody.querySelectorAll('tr'));

  filteredData.forEach((stock, idx) => {
    const dir   = stock.direction;
    const sign  = stock.change >= 0 ? '+' : '';
    const rawHistory = priceHistory[stock.symbol] || [stock.price];
    const history = rawHistory.length > 1 ? rawHistory : [stock.price, stock.price];
    const minH  = Math.min(...history);
    const maxH  = Math.max(...history);
    const range = maxH - minH || 1;

    const arrowMap = { up: '▲', down: '▼', neutral: '—' };
    const arrow    = arrowMap[dir] || '—';
    const dirClass = dir === 'neutral' ? 'neutral' : dir;

    const points = history.map((p, i) => {
      const x = (i / (history.length - 1 || 1)) * 40;
      const y = 15 - ((p - minH) / range) * 15;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const lineCol = dir === 'up' ? 'var(--gain)' : dir === 'down' ? 'var(--loss)' : 'var(--neutral)';
    const svgHtml = `<svg class="sparkline" width="60" height="15" viewBox="0 -2 60 19" style="overflow:visible;"><path d="${points}" fill="none" stroke="${lineCol}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const isFavorite = favorites.has(stock.symbol);
    const favoriteLabel = isFavorite ? `Remove ${stock.symbol} from watchlist` : `Add ${stock.symbol} to watchlist`;
    const alertLabel = `Create price alert for ${stock.symbol}`;

    const rowHtml = `
      <td>${idx + 1}</td>
      <td><button class="star-btn ${isFavorite ? 'is-fav' : ''}" aria-label="${esc(favoriteLabel)}" title="${esc(favoriteLabel)}" onclick="event.stopPropagation(); toggleFavorite('${esc(stock.symbol)}')">${ICONS.star}</button></td>
      <td><button class="bell-btn" aria-label="${esc(alertLabel)}" title="${esc(alertLabel)}" onclick="event.stopPropagation(); openAlertModal('${esc(stock.symbol)}', ${stock.price})">${ICONS.bell}</button></td>
      <td class="cell-symbol"><span class="symbol-badge">${esc(stock.symbol)}</span></td>
      <td class="cell-name">${esc(stock.name)}</td>
      <td><span class="sector-badge">${esc(stock.sector)}</span></td>
      <td class="cell-price">$${fmtPrice(stock.price)}</td>
      <td class="cell-change ${dirClass}">${sign}${fmtChange(stock.change)}</td>
      <td class="cell-changePct ${dirClass}">${sign}${stock.changePct.toFixed(2)}%</td>
      <td class="cell-volume">${fmtVolume(stock.volume)}</td>
      <td>
        <div class="trend-bar">
          <span class="trend-arrow ${dirClass}">${arrow}</span>
          ${svgHtml}
        </div>
      </td>
    `;

    let row = existing[idx];
    if (!row) {
      row = document.createElement('tr');
      row.dataset.symbol = stock.symbol;
      row.innerHTML = rowHtml;
      row.onclick = () => openChart(stock.symbol, stock.name);
      tbody.appendChild(row);
    } else {
      const prevDir = row.dataset.dir;
      row.dataset.symbol = stock.symbol;
      row.innerHTML = rowHtml;
      row.onclick = () => openChart(stock.symbol, stock.name);

      if (!isReportCaptureMode && prevDir !== 'neutral' && dir !== 'neutral') {
        row.classList.remove('flash-gain', 'flash-loss');
        void row.offsetWidth;
        row.classList.add(dir === 'up' ? 'flash-gain' : 'flash-loss');
        setTimeout(() => row.classList.remove('flash-gain', 'flash-loss'), 850);
      }
    }
    row.dataset.dir = dir;
  });

  for (let i = filteredData.length; i < existing.length; i++) {
    existing[i].remove();
  }
}

// ─── Search ───────────────────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  applyFilterAndSort();
});

// ─── Sort ─────────────────────────────────────────────────────────────────────
sortButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const col = btn.dataset.col;
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = 'asc';
    }
    sortButtons.forEach(b => {
      b.classList.remove('active', 'asc', 'desc');
      b.querySelector('.sort-arrow').textContent = '↕';
    });
    btn.classList.add('active', sortDir);
    btn.querySelector('.sort-arrow').textContent = sortDir === 'asc' ? '↑' : '↓';
    applyFilterAndSort();
  });
});

// ─── Chart — Timeframe Engine ─────────────────────────────────────────────────
const TF_SECONDS = { '1m': 60, '5m': 300, '15m': 900, '1H': 3600, '4H': 14400, '1D': 86400 };
let activeTimeframe = '1m';
const tfBucket = {}; // { [symbol]: { time, open, high, low, close } }

function seedForSymbol(symbol) {
  return String(symbol).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Build synthetic OHLC candles for a symbol at a given timeframe.
 * Always anchors the rightmost candle to the latest known price.
 */
function buildTfChartData(symbol, tf) {
  const tfSec = TF_SECONDS[tf];
  const rawHistory = window.fullChartHistory[symbol];
  if (!rawHistory || rawHistory.length === 0) return [];

  const latestClose = rawHistory[rawHistory.length - 1].close;
  const nowT = rawHistory[rawHistory.length - 1].time;
  const numCandles = 72;
  const seed = seedForSymbol(symbol) + tfSec;
  const vol = 0.0018 + 0.0012 * Math.log2(tfSec / 60 + 1);
  let price = latestClose * (1 + (seededRandom(seed) - 0.5) * 0.035);
  const candles = [];
  const baseBucket = Math.floor(nowT / tfSec) * tfSec;

  for (let i = 0; i < numCandles; i++) {
    const t = baseBucket - (numCandles - i) * tfSec;
    const remaining = Math.max(numCandles - i, 1);
    const pullToLatest = ((latestClose - price) / latestClose) / remaining;
    const wave = Math.sin((seed + i) * 0.37) * vol * 0.55;
    const noise = (seededRandom(seed + i * 17) - 0.5) * vol;
    const open  = price;
    const close = price * (1 + pullToLatest + wave + noise);
    const wick = vol * (0.25 + seededRandom(seed + i * 31) * 0.55);
    const high  = Math.max(open, close) * (1 + wick);
    const low   = Math.min(open, close) * (1 - wick);
    candles.push({ time: t, open, high, low, close });
    price = close;
  }

  const bucketT = baseBucket;
  const previousClose = candles[candles.length - 1]?.close || latestClose;
  const currentWick = vol * 0.45;
  tfBucket[symbol] = {
    time: bucketT,
    open: previousClose,
    high: Math.max(previousClose, latestClose) * (1 + currentWick),
    low: Math.min(previousClose, latestClose) * (1 - currentWick),
    close: latestClose
  };
  candles.push({ ...tfBucket[symbol] });

  return candles;
}

/**
 * Called on every SSE tick when the chart is open.
 * Aggregates price ticks into the current TF bucket.
 */
function updateTfChart(symbol, price, nowT) {
  if (!candleSeries) return;
  const tfSec = TF_SECONDS[activeTimeframe];
  const bucketT = Math.floor(nowT / tfSec) * tfSec;

  if (!tfBucket[symbol] || tfBucket[symbol].time !== bucketT) {
    // New candle opens
    const prev = tfBucket[symbol];
    tfBucket[symbol] = {
      time:  bucketT,
      open:  prev ? prev.close : price,
      high:  price,
      low:   price,
      close: price
    };
  } else {
    // Update current candle
    tfBucket[symbol].close = price;
    tfBucket[symbol].high  = Math.max(tfBucket[symbol].high, price);
    tfBucket[symbol].low   = Math.min(tfBucket[symbol].low, price);
  }
  candleSeries.update({ ...tfBucket[symbol] });
}

/** Activate a timeframe: rebuild chart data and highlight the active button. */
function switchTimeframe(tf) {
  activeTimeframe = tf;
  document.querySelectorAll('.tf-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tf === tf)
  );
  if (activeSymbol && candleSeries) {
    chart.applyOptions({ timeScale: { secondsVisible: tf === '1m' } });
    const data = buildTfChartData(activeSymbol, tf);
    candleSeries.setData(data);
    focusRecentCandles(data);
  }
}

function getChartHeight() {
  return window.innerWidth < 600 ? 330 : 430;
}

function focusRecentCandles(data) {
  if (!chart || !data.length) return;
  const from = Math.max(data.length - 58, 0);
  chart.timeScale().setVisibleLogicalRange({ from, to: data.length + 5 });
}

// ─── Chart Modal ──────────────────────────────────────────────────────────────
const chartModal    = document.getElementById('chartModal');
const chartTitle    = document.getElementById('chartTitle');
const closeChartBtn = document.getElementById('closeChart');
const chartContainer= document.getElementById('chart');
let chart       = null;
let candleSeries= null;
let activeSymbol= null;

function openChart(symbol, name) {
  if (!authToken) {
    openAuthModal('Sign in to view the chart 📊');
    return;
  }
  activeSymbol = symbol;
  chartTitle.textContent = `${symbol} — ${name}`;
  chartModal.classList.add('active');
  void chartModal.offsetWidth;

  const theme    = document.documentElement.getAttribute('data-theme') || 'dark';
  const chartBg  = getComputedStyle(document.documentElement).getPropertyValue('--chart-bg').trim()  || '#0f0f2d';
  const chartGrid= getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim()|| '#1d1d50';
  const textCol  = theme === 'light' ? '#1a1535' : '#e2e8f8';

  if (!window.LightweightCharts) {
    chartContainer.innerHTML = `
      <div style="height:100%;display:grid;place-items:center;color:var(--text-secondary);border:1px solid var(--border);border-radius:8px;background:var(--bg-elevated);">
        Chart library could not be loaded. The ticker stream and API remain available.
      </div>
    `;
    return;
  }

  if (!chart) {
    chart = LightweightCharts.createChart(chartContainer, {
      width:  Math.max(chartContainer.clientWidth, 320),
      height: getChartHeight(),
      layout: { background: { color: chartBg }, textColor: textCol },
      grid:   { vertLines: { color: chartGrid }, horzLines: { color: chartGrid } },
      rightPriceScale: { borderColor: chartGrid },
      timeScale: {
        timeVisible: true,
        secondsVisible: activeTimeframe === '1m',
        borderColor: chartGrid,
        barSpacing: 8,
        rightOffset: 5,
      },
      crosshair: {
        vertLine: { color: 'rgba(136, 146, 184, 0.35)' },
        horzLine: { color: 'rgba(136, 146, 184, 0.35)' },
      },
    });
    candleSeries = chart.addCandlestickSeries({
      upColor: '#00f5a0', downColor: '#ff4d6d',
      borderVisible: false,
      wickUpColor: '#00f5a0', wickDownColor: '#ff4d6d',
    });

    // Wire up timeframe buttons
    document.querySelectorAll('.tf-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTimeframe(btn.dataset.tf));
    });
  }

  // Apply chart colours whenever theme may have changed
  chart.applyOptions({
    layout: { background: { color: chartBg }, textColor: textCol },
    grid:   { vertLines: { color: chartGrid }, horzLines: { color: chartGrid } },
    rightPriceScale: { borderColor: chartGrid },
    timeScale: { borderColor: chartGrid, secondsVisible: true },
  });

// Reset to default TF on each open
  activeTimeframe = '1m';
  document.querySelectorAll('.tf-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tf === '1m')
  );

  chart.resize(Math.max(chartContainer.clientWidth, 320), getChartHeight());
  const tfData = buildTfChartData(symbol, activeTimeframe);
  candleSeries.setData(tfData);
  focusRecentCandles(tfData);
}

closeChartBtn.addEventListener('click', () => {
  chartModal.classList.remove('active');
  activeSymbol = null;
});
chartModal.addEventListener('click', (e) => {
  if (e.target === chartModal) {
    chartModal.classList.remove('active');
    activeSymbol = null;
  }
});

// ─── Alert Form (gated behind auth) ──────────────────────────────────────────
const alertModal       = document.getElementById('alertModal');
const alertSymbolSpan  = document.getElementById('alertSymbol');
const closeAlertModalBtn = document.getElementById('closeAlertModal');
const alertForm        = document.getElementById('alertForm');
const alertPriceInput  = document.getElementById('alertPrice');
const alertDirection   = document.getElementById('alertDirection');
let activeAlertSymbol  = null;

window.openAlertModal = function(symbol, currentPrice) {
  if (!authToken) {
    openAuthModal('Sign in to set price alerts 🔔');
    return;
  }
  activeAlertSymbol = symbol;
  alertSymbolSpan.textContent = symbol;
  alertPriceInput.value = currentPrice;
  alertModal.classList.add('active');
};

closeAlertModalBtn.addEventListener('click', () => alertModal.classList.remove('active'));

alertForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const price = parseFloat(alertPriceInput.value);
  const dir   = alertDirection.value;
  if (price > 0 && activeAlertSymbol) {
    try {
      const res = await authedFetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: activeAlertSymbol, target_price: price, direction: dir })
      });
      const data = await res.json();
      if (res.ok) {
        alerts.push({ id: data.id, symbol: activeAlertSymbol, target_price: price, direction: dir });
        alertModal.classList.remove('active');
      }
    } catch (err) {}
  }
});

// ─── Alerts List ──────────────────────────────────────────────────────────────
const alertsListModal  = document.getElementById('alertsListModal');
const closeAlertsListBtn = document.getElementById('closeAlertsList');
const alertsContainer  = document.getElementById('alertsContainer');
const alertsBtn        = document.getElementById('alertsBtn');

window.renderAlertsList = function() {
  alertsContainer.innerHTML = '';
  if (alerts.length === 0) {
    alertsContainer.innerHTML = '<p style="padding:20px;text-align:center;">No active alerts.</p>';
    return;
  }
  alerts.forEach(a => {
    alertsContainer.innerHTML += `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding:12px 0;">
        <div>
          <strong style="color:var(--text-primary);">${a.symbol}</strong>
          <span style="font-size:0.85rem;"> — ${a.direction} $${a.target_price}</span>
        </div>
        <button onclick="deleteAlert(${a.id})" style="background:none;border:none;color:var(--loss);cursor:pointer;font-size:1.2rem;">&times;</button>
      </div>
    `;
  });
};

alertsBtn.addEventListener('click', () => {
  if (!authToken) { openAuthModal('Sign in to view alerts 🔔'); return; }
  renderAlertsList();
  alertsListModal.classList.add('active');
});

closeAlertsListBtn.addEventListener('click', () => alertsListModal.classList.remove('active'));

// ─── Tabs ─────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    applyFilterAndSort();
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtVolume(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function fmtPrice(n) {
  if (Math.abs(n) < 1) return n.toFixed(4);
  if (Math.abs(n) < 10) return n.toFixed(3);
  return n.toFixed(2);
}

function fmtChange(n) {
  if (Math.abs(n) > 0 && Math.abs(n) < 0.01) return n.toFixed(4);
  return n.toFixed(2);
}

function setupReportCaptureMode() {
  const params = new URLSearchParams(window.location.search);
  const capture = params.get('capture');
  if (!capture) return;

  window.__REPORT_CAPTURE_READY = false;

  const requestedTheme = params.get('theme');
  if (requestedTheme) {
    document.documentElement.setAttribute('data-theme', requestedTheme);
    localStorage.setItem('theme', requestedTheme);
    highlightThemeOption(requestedTheme);
  }

  const activateTab = (tabName) => {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      const active = btn.dataset.tab === tabName;
      btn.classList.toggle('active', active);
      if (active) currentTab = tabName;
    });
    applyFilterAndSort();
  };

  const seedCaptureUser = () => {
    authToken = authToken || 'capture-token';
    refreshToken = refreshToken || 'capture-refresh';
    localStorage.setItem('token', authToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('userEmail', 'demo@example.com');
    updateUserArea();
  };

  setTimeout(() => {
    document.body.dataset.captureMode = capture;
    if (stockData.length > 0) setStatus('connected');

    if (capture === 'auth') {
      openAuthModal('Report screenshot: login and registration gate');
    }

    if (capture === 'watchlist') {
      seedCaptureUser();
      favorites = new Set(['AAPL', 'BTC', 'THYAO', 'EUR/TRY']);
      activateTab('watchlist');
    }

    if (capture === 'alerts') {
      seedCaptureUser();
      alerts = [
        { id: 1, symbol: 'AAPL', target_price: 200, direction: 'above' },
        { id: 2, symbol: 'BTC', target_price: 70000, direction: 'above' },
        { id: 3, symbol: 'EUR/TRY', target_price: 36, direction: 'above' },
      ];
      renderAlertsList();
      alertsListModal.classList.add('active');
    }

    if (capture === 'chart') {
      seedCaptureUser();
      const openCaptureChart = () => {
        const stock = stockData.find((item) => item.symbol === 'AAPL');
        if (!stock || !window.fullChartHistory[stock.symbol]?.length) {
          setTimeout(openCaptureChart, 150);
          return;
        }
        openChart(stock.symbol, stock.name);
        window.__REPORT_CAPTURE_READY = true;
      };
      openCaptureChart();
      return;
    }

    if (capture === 'error') {
      searchQuery = '__no_market_match__';
      searchInput.value = searchQuery;
      applyFilterAndSort();
    }

    if (capture === 'theme') {
      document.documentElement.setAttribute('data-theme', requestedTheme || 'ocean');
      activateTab('gainers');
    }

    window.__REPORT_CAPTURE_READY = true;
  }, 100);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
if (Notification.permission === 'default') {
  Notification.requestPermission();
}

// Initial Language Render
setLanguage(currentLang);

// Initial User Area Render
updateUserArea();

// Load user data if logged in, then connect SSE
Promise.all([loadFavorites(), loadAlerts()]).then(() => {
  connect();
  setupReportCaptureMode();
});
