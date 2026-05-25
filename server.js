const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { fetchLiveMarketUpdates } = require('./marketProviders');

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 7);
const BCRYPT_COST = Number(process.env.BCRYPT_COST || 12);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 5);
const API_RATE_LIMIT_MAX = Number(process.env.API_RATE_LIMIT_MAX || 100);
const PASSWORD_RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 30);
const USE_LIVE_MARKET_DATA = process.env.LIVE_MARKET_DATA === 'true';
const LIVE_MARKET_INTERVAL_MS = Number(process.env.LIVE_MARKET_INTERVAL_MS || 30_000);

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

const stocks = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 189.30, sector: 'Technology', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 415.20, sector: 'Technology', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 175.80, sector: 'Technology', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 198.50, sector: 'Consumer', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'META', name: 'Meta Platforms', price: 527.40, sector: 'Technology', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 172.60, sector: 'Automotive', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 875.40, sector: 'Technology', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'JPM', name: 'JPMorgan Chase', price: 198.20, sector: 'Finance', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'V', name: 'Visa Inc.', price: 278.90, sector: 'Finance', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', price: 152.30, sector: 'Healthcare', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'WMT', name: 'Walmart Inc.', price: 68.40, sector: 'Retail', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'PG', name: 'Procter & Gamble', price: 162.70, sector: 'Consumer', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'MA', name: 'Mastercard Inc.', price: 472.10, sector: 'Finance', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'UNH', name: 'UnitedHealth Group', price: 521.80, sector: 'Healthcare', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'HD', name: 'Home Depot Inc.', price: 345.60, sector: 'Retail', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'BAC', name: 'Bank of America', price: 38.90, sector: 'Finance', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'XOM', name: 'Exxon Mobil Corp.', price: 118.40, sector: 'Energy', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'PFE', name: 'Pfizer Inc.', price: 27.80, sector: 'Healthcare', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'NFLX', name: 'Netflix Inc.', price: 648.90, sector: 'Media', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'DIS', name: 'Walt Disney Co.', price: 111.20, sector: 'Media', type: 'stock', source: 'simulated-yahoo' },
  { symbol: 'THYAO', name: 'Turk Hava Yollari', price: 322.50, sector: 'Aviation', type: 'bist', source: 'simulated-bist' },
  { symbol: 'ASELS', name: 'Aselsan', price: 64.20, sector: 'Defense', type: 'bist', source: 'simulated-bist' },
  { symbol: 'EREGL', name: 'Erdemir', price: 54.10, sector: 'Materials', type: 'bist', source: 'simulated-bist' },
  { symbol: 'KCHOL', name: 'Koc Holding', price: 236.40, sector: 'Conglomerate', type: 'bist', source: 'simulated-bist' },
  { symbol: 'BIMAS', name: 'BIM', price: 412.30, sector: 'Retail', type: 'bist', source: 'simulated-bist' },
  { symbol: 'SISE', name: 'Sisecam', price: 58.70, sector: 'Materials', type: 'bist', source: 'simulated-bist' },
  { symbol: 'YKBNK', name: 'Yapi Kredi', price: 34.60, sector: 'Finance', type: 'bist', source: 'simulated-bist' },
  { symbol: 'PGSUS', name: 'Pegasus Hava Yollari', price: 1034.0, sector: 'Aviation', type: 'bist', source: 'simulated-bist' },
  { symbol: 'TCELL', name: 'Turkcell', price: 88.30, sector: 'Telecom', type: 'bist', source: 'simulated-bist' },
  { symbol: 'SAHOL', name: 'Sabanci Holding', price: 104.20, sector: 'Conglomerate', type: 'bist', source: 'simulated-bist' },
  { symbol: 'BTC', name: 'Bitcoin', price: 68450.0, sector: 'Crypto', type: 'crypto', source: 'simulated-coingecko' },
  { symbol: 'ETH', name: 'Ethereum', price: 3840.5, sector: 'Crypto', type: 'crypto', source: 'simulated-coingecko' },
  { symbol: 'BNB', name: 'Binance Coin', price: 595.2, sector: 'Crypto', type: 'crypto', source: 'simulated-coingecko' },
  { symbol: 'SOL', name: 'Solana', price: 165.8, sector: 'Crypto', type: 'crypto', source: 'simulated-coingecko' },
  { symbol: 'XRP', name: 'Ripple', price: 0.52, sector: 'Crypto', type: 'crypto', source: 'simulated-coingecko' },
  { symbol: 'DOGE', name: 'Dogecoin', price: 0.16, sector: 'Crypto', type: 'crypto', source: 'simulated-coingecko' },
  { symbol: 'ADA', name: 'Cardano', price: 0.45, sector: 'Crypto', type: 'crypto', source: 'simulated-coingecko' },
  { symbol: 'USD/TRY', name: 'US Dollar / Lira', price: 32.55, sector: 'Forex', type: 'forex', source: 'simulated-frankfurter' },
  { symbol: 'EUR/TRY', name: 'Euro / Lira', price: 34.85, sector: 'Forex', type: 'forex', source: 'simulated-frankfurter' },
  { symbol: 'GBP/TRY', name: 'Pound / Lira', price: 40.75, sector: 'Forex', type: 'forex', source: 'simulated-frankfurter' },
  { symbol: 'EUR/USD', name: 'Euro / US Dollar', price: 1.07, sector: 'Forex', type: 'forex', source: 'simulated-frankfurter' },
  { symbol: 'GBP/USD', name: 'Pound / US Dollar', price: 1.25, sector: 'Forex', type: 'forex', source: 'simulated-frankfurter' },
];

const stockState = stocks.map((stock) => ({
  ...stock,
  openPrice: stock.price,
  prevPrice: stock.price,
  change: 0,
  changePct: 0,
  direction: 'neutral',
  volume: Math.floor(Math.random() * 5_000_000) + 500_000,
  updatedAt: new Date().toISOString(),
}));

const stockSymbols = new Set(stockState.map((stock) => stock.symbol));
const clients = new Set();
let priceFeedTimer = null;
let liveProviderTimer = null;
let lastProviderSync = null;
let lastProviderError = null;

function publicStock(stock) {
  return {
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    price: stock.price,
    change: stock.change,
    changePct: stock.changePct,
    direction: stock.direction,
    volume: stock.volume,
    type: stock.type,
    source: stock.source,
    updatedAt: stock.updatedAt,
  };
}

function getSnapshot() {
  return stockState.map(publicStock);
}

function getStock(symbol) {
  const normalized = normalizeSymbol(symbol);
  return stockState.find((stock) => stock.symbol === normalized);
}

function normalizeSymbol(symbol) {
  return String(symbol || '').trim().toUpperCase();
}

function getSimulationProfile(stock) {
  const profiles = {
    crypto: { capPct: 0.18, reversion: 0.055, volatility: 0.0075, volumeStep: 30_000 },
    forex: { capPct: 0.025, reversion: 0.09, volatility: 0.0009, volumeStep: 2_000 },
    bist: { capPct: 0.12, reversion: 0.065, volatility: 0.0038, volumeStep: 12_000 },
    stock: { capPct: 0.10, reversion: 0.07, volatility: 0.0032, volumeStep: 10_000 },
  };
  return profiles[stock.type] || profiles.stock;
}

function roundMarketPrice(price) {
  if (price < 1) return Number(price.toFixed(4));
  if (price < 10) return Number(price.toFixed(3));
  return Number(price.toFixed(2));
}

function updatePrices() {
  stockState.forEach((stock) => {
    stock.prevPrice = stock.price;

    const profile = getSimulationProfile(stock);
    const distanceFromOpen = (stock.openPrice - stock.price) / stock.openPrice;
    const randomMove = (Math.random() - 0.5) * profile.volatility;
    const reversionMove = distanceFromOpen * profile.reversion;
    const nextPrice = stock.price * (1 + randomMove + reversionMove);
    const minPrice = stock.openPrice * (1 - profile.capPct);
    const maxPrice = stock.openPrice * (1 + profile.capPct);

    stock.price = Math.max(0.0001, roundMarketPrice(Math.min(maxPrice, Math.max(minPrice, nextPrice))));
    const rawChange = stock.price - stock.openPrice;
    stock.change = Number(rawChange.toFixed(stock.openPrice < 10 ? 4 : 2));
    stock.changePct = Number(((rawChange / stock.openPrice) * 100).toFixed(2));
    stock.direction = stock.price > stock.prevPrice ? 'up' : stock.price < stock.prevPrice ? 'down' : 'neutral';
    stock.volume += Math.floor(Math.random() * profile.volumeStep);
    stock.updatedAt = new Date().toISOString();
  });
}

function applyProviderUpdate(symbol, price, source) {
  const stock = getStock(symbol);
  if (!stock || !Number.isFinite(price) || price <= 0) return;

  stock.prevPrice = stock.price;
  stock.price = Number(price.toFixed(2));
  stock.source = source;
  const rawChange = stock.price - stock.openPrice;
  stock.change = Number(rawChange.toFixed(stock.openPrice < 10 ? 4 : 2));
  stock.changePct = Number(((rawChange / stock.openPrice) * 100).toFixed(2));
  stock.direction = stock.price > stock.prevPrice ? 'up' : stock.price < stock.prevPrice ? 'down' : 'neutral';
  stock.updatedAt = new Date().toISOString();
}

async function syncLiveMarketData() {
  if (!USE_LIVE_MARKET_DATA) return { enabled: false, count: 0 };

  try {
    const updates = await fetchLiveMarketUpdates(stockState);
    updates.forEach((update, symbol) => applyProviderUpdate(symbol, update.price, update.source));
    lastProviderSync = new Date().toISOString();
    lastProviderError = null;
    return { enabled: true, count: updates.size };
  } catch (err) {
    lastProviderError = err.message;
    return { enabled: true, count: 0, error: err.message };
  }
}

function broadcast(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach((res) => {
    try {
      res.write(payload);
    } catch (_err) {
      clients.delete(res);
    }
  });
}

function startPriceFeed() {
  if (priceFeedTimer) return priceFeedTimer;
  if (USE_LIVE_MARKET_DATA) {
    syncLiveMarketData();
    liveProviderTimer = setInterval(syncLiveMarketData, LIVE_MARKET_INTERVAL_MS);
  }
  priceFeedTimer = setInterval(() => {
    updatePrices();
    broadcast(getSnapshot());
  }, 1500);
  return priceFeedTimer;
}

function stopPriceFeed() {
  if (priceFeedTimer) {
    clearInterval(priceFeedTimer);
    priceFeedTimer = null;
  }
  if (liveProviderTimer) {
    clearInterval(liveProviderTimer);
    liveProviderTimer = null;
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongEnoughPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

function jsonError(res, status, error, details) {
  const payload = { error };
  if (details) payload.details = details;
  return res.status(status).json(payload);
}

function createAccessToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function createRefreshToken(userId) {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).run(userId, hashToken(token), expiresAt);
  return { token, expiresAt };
}

function issueTokens(user) {
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user.id);

  return {
    token: accessToken,
    access_token: accessToken,
    refresh_token: refreshToken.token,
    expires_in: ACCESS_TOKEN_TTL,
    refresh_token_expires_at: refreshToken.expiresAt,
    user: {
      id: user.id,
      email: user.email,
      name: user.name || null,
    },
  };
}

function getGoogleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || '').trim();
}

async function verifyGoogleCredential(credential) {
  const clientId = getGoogleClientId();
  const idToken = String(credential || '').trim();

  if (!clientId) return { status: 503, error: 'Google login is not configured' };
  if (!idToken) return { status: 400, error: 'Google credential is required' };

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) return { status: 401, error: 'Invalid Google credential' };

  const profile = await response.json();
  const issuer = String(profile.iss || '');
  const expiresAt = Number(profile.exp || 0) * 1000;
  const email = normalizeEmail(profile.email);

  if (profile.aud !== clientId) return { status: 401, error: 'Invalid Google audience' };
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(issuer)) {
    return { status: 401, error: 'Invalid Google issuer' };
  }
  if (!expiresAt || expiresAt <= Date.now()) return { status: 401, error: 'Expired Google credential' };
  if (String(profile.email_verified) !== 'true') return { status: 401, error: 'Google email is not verified' };
  if (!profile.sub || !isValidEmail(email)) return { status: 401, error: 'Google profile is incomplete' };

  return {
    profile: {
      sub: String(profile.sub),
      email,
      name: String(profile.name || '').trim() || null,
    },
  };
}

function linkedProvider(existingProvider, provider) {
  const current = String(existingProvider || 'password');
  return current.split(',').includes(provider) ? current : `${current},${provider}`;
}

async function findOrCreateGoogleUser(profile) {
  const bySub = db.prepare(
    'SELECT id, email, name, google_sub, auth_provider FROM users WHERE google_sub = ?'
  ).get(profile.sub);

  if (bySub) return bySub;

  const byEmail = db.prepare(
    'SELECT id, email, name, google_sub, auth_provider FROM users WHERE email = ?'
  ).get(profile.email);

  if (byEmail) {
    const nextName = byEmail.name || profile.name;
    const nextProvider = linkedProvider(byEmail.auth_provider, 'google');
    db.prepare(
      `UPDATE users
       SET google_sub = ?, name = ?, auth_provider = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(profile.sub, nextName, nextProvider, byEmail.id);
    return { ...byEmail, google_sub: profile.sub, name: nextName, auth_provider: nextProvider };
  }

  const unusablePassword = crypto.randomBytes(32).toString('hex');
  const passwordHash = await bcrypt.hash(unusablePassword, BCRYPT_COST);
  const result = db.prepare(
    `INSERT INTO users (email, password_hash, name, google_sub, auth_provider)
     VALUES (?, ?, ?, ?, ?)`
  ).run(profile.email, passwordHash, profile.name, profile.sub, 'google');

  return {
    id: result.lastInsertRowid,
    email: profile.email,
    name: profile.name,
    google_sub: profile.sub,
    auth_provider: 'google',
  };
}

function createPasswordResetToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000).toISOString();

  db.prepare(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).run(userId, hashToken(token), expiresAt);

  return { token, expiresAt };
}

function validatePortfolioBody(body) {
  const symbol = normalizeSymbol(body.symbol);
  const quantity = Number(body.quantity);
  const averagePrice = Number(body.average_price ?? body.averagePrice);

  if (!stockSymbols.has(symbol)) return { error: 'Unknown symbol' };
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: 'quantity must be a positive number' };
  if (!Number.isFinite(averagePrice) || averagePrice <= 0) {
    return { error: 'average_price must be a positive number' };
  }

  return { value: { symbol, quantity, average_price: averagePrice } };
}

function roundMoney(value) {
  return Number(value.toFixed(2));
}

function portfolioPositionView(row) {
  const stock = getStock(row.symbol);
  const currentPrice = stock ? stock.price : row.average_price;
  const marketValue = row.quantity * currentPrice;
  const costBasis = row.quantity * row.average_price;
  const pnl = marketValue - costBasis;

  return {
    id: row.id,
    symbol: row.symbol,
    name: stock ? stock.name : row.symbol,
    type: stock ? stock.type : null,
    quantity: row.quantity,
    average_price: row.average_price,
    current_price: currentPrice,
    market_value: roundMoney(marketValue),
    cost_basis: roundMoney(costBasis),
    pnl: roundMoney(pnl),
    pnl_pct: costBasis > 0 ? Number(((pnl / costBasis) * 100).toFixed(2)) : 0,
    updated_at: row.updated_at,
  };
}

function getPortfolioPayload(userId) {
  const rows = db.prepare(
    `SELECT id, symbol, quantity, average_price, updated_at
     FROM portfolio_positions
     WHERE user_id = ?
     ORDER BY updated_at DESC`
  ).all(userId);
  const positions = rows.map(portfolioPositionView);
  const summary = positions.reduce((acc, position) => {
    acc.market_value += position.market_value;
    acc.cost_basis += position.cost_basis;
    acc.pnl += position.pnl;
    return acc;
  }, { market_value: 0, cost_basis: 0, pnl: 0, pnl_pct: 0 });

  summary.market_value = roundMoney(summary.market_value);
  summary.cost_basis = roundMoney(summary.cost_basis);
  summary.pnl = roundMoney(summary.pnl);
  summary.pnl_pct = summary.cost_basis > 0 ? Number(((summary.pnl / summary.cost_basis) * 100).toFixed(2)) : 0;

  return { positions, summary };
}

function validateAlertBody(body) {
  const symbol = normalizeSymbol(body.symbol);
  const targetPrice = Number(body.target_price);
  const direction = String(body.direction || '').trim().toLowerCase();

  if (!stockSymbols.has(symbol)) return { error: 'Unknown symbol' };
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) return { error: 'target_price must be a positive number' };
  if (!['above', 'below'].includes(direction)) return { error: 'direction must be above or below' };

  return { value: { symbol, target_price: targetPrice, direction } };
}

function rateLimit({ windowMs, max, name }) {
  const buckets = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = `${name}:${req.ip}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return jsonError(res, 429, 'Rate limit exceeded');
    }

    return next();
  };
}

function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https://*.googleusercontent.com https://ssl.gstatic.com https://www.gstatic.com; connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-src https://accounts.google.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
  );
  next();
}

function corsFromEnv(req, res, next) {
  const allowed = process.env.CORS_ORIGIN;
  const origin = req.headers.origin;

  if (allowed === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (allowed && origin && allowed.split(',').map((item) => item.trim()).includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return jsonError(res, 401, 'Missing bearer token');
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (_err) {
    return jsonError(res, 403, 'Invalid or expired token');
  }
}

const app = express();
const authLimiter = rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: AUTH_RATE_LIMIT_MAX, name: 'auth' });
const apiLimiter = rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: API_RATE_LIMIT_MAX, name: 'api' });

app.disable('x-powered-by');
app.use(securityHeaders);
app.use(corsFromEnv);
app.use(express.json({ limit: '32kb' }));
app.use('/api', apiLimiter);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'sse-live-ticker',
    time: new Date().toISOString(),
    liveMarketData: USE_LIVE_MARKET_DATA,
    lastProviderSync,
    lastProviderError,
  });
});

app.get('/api/config', (_req, res) => {
  const googleClientId = getGoogleClientId();
  res.json({
    googleLoginEnabled: Boolean(googleClientId),
    googleClientId: googleClientId || null,
  });
});

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify(getSnapshot())}\n\n`);
  clients.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (_err) {
      clearInterval(heartbeat);
      clients.delete(res);
    }
  }, 20_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
});

app.get('/api/stocks', (req, res) => {
  const type = String(req.query.type || '').trim().toLowerCase();
  const query = String(req.query.q || '').trim().toLowerCase();
  let rows = getSnapshot();

  if (type) rows = rows.filter((stock) => stock.type === type);
  if (query) {
    rows = rows.filter((stock) => (
      stock.symbol.toLowerCase().includes(query) ||
      stock.name.toLowerCase().includes(query) ||
      stock.sector.toLowerCase().includes(query)
    ));
  }

  res.json(rows);
});

app.get('/api/stocks/:symbol', (req, res) => {
  const stock = getStock(req.params.symbol);
  if (!stock) return jsonError(res, 404, 'Stock not found');
  return res.json(publicStock(stock));
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = req.body.password;
  const name = String(req.body.name || '').trim() || null;

  if (!isValidEmail(email)) return jsonError(res, 400, 'Valid email is required');
  if (!isStrongEnoughPassword(password)) return jsonError(res, 400, 'Password must be at least 8 characters');

  try {
    const hash = await bcrypt.hash(password, BCRYPT_COST);
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)'
    ).run(email, hash, name);
    const user = { id: result.lastInsertRowid, email, name };
    return res.status(201).json(issueTokens(user));
  } catch (err) {
    if (String(err.message).includes('UNIQUE constraint failed')) {
      return jsonError(res, 409, 'Email already exists');
    }
    return jsonError(res, 500, 'Registration failed');
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = req.body.password;

  if (!isValidEmail(email) || typeof password !== 'string') {
    return jsonError(res, 400, 'Email and password are required');
  }

  const user = db.prepare('SELECT id, email, password_hash, name FROM users WHERE email = ?').get(email);
  if (!user) return jsonError(res, 401, 'Invalid email or password');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return jsonError(res, 401, 'Invalid email or password');

  return res.json(issueTokens(user));
});

app.post('/api/auth/google', authLimiter, async (req, res) => {
  try {
    const verified = await verifyGoogleCredential(req.body.credential);
    if (verified.error) return jsonError(res, verified.status, verified.error);

    const user = await findOrCreateGoogleUser(verified.profile);
    return res.json(issueTokens(user));
  } catch (_err) {
    return jsonError(res, 502, 'Google login verification failed');
  }
});

app.post('/api/auth/forgot-password', authLimiter, (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!isValidEmail(email)) return jsonError(res, 400, 'Valid email is required');

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  let reset = null;

  if (user) {
    db.prepare(
      'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL'
    ).run(user.id);
    reset = createPasswordResetToken(user.id);
  }

  return res.json({
    success: true,
    message: 'If an account exists, a password reset token has been generated.',
    reset_token: reset ? reset.token : null,
    expires_at: reset ? reset.expiresAt : null,
    delivery: reset ? 'demo-response' : 'not-created',
  });
});

app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  const resetToken = String(req.body.token || '').trim();
  const password = req.body.password;

  if (resetToken.length < 32) return jsonError(res, 400, 'Reset token is required');
  if (!isStrongEnoughPassword(password)) return jsonError(res, 400, 'Password must be at least 8 characters');

  const tokenRow = db.prepare(
    `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, u.auth_provider
     FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id
     WHERE prt.token_hash = ?`
  ).get(hashToken(resetToken));

  if (!tokenRow || tokenRow.used_at || Date.parse(tokenRow.expires_at) <= Date.now()) {
    return jsonError(res, 401, 'Invalid or expired reset token');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const nextProvider = linkedProvider(tokenRow.auth_provider, 'password');

  db.transaction(() => {
    db.prepare(
      'UPDATE users SET password_hash = ?, auth_provider = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(passwordHash, nextProvider, tokenRow.user_id);
    db.prepare('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(tokenRow.id);
    db.prepare('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(tokenRow.user_id);
  })();

  return res.json({ success: true });
});

app.post('/api/auth/refresh', authLimiter, (req, res) => {
  const refreshToken = String(req.body.refresh_token || '').trim();
  if (!refreshToken) return jsonError(res, 400, 'refresh_token is required');

  const tokenRow = db.prepare(
    `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at, u.email, u.name
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = ?`
  ).get(hashToken(refreshToken));

  if (!tokenRow || tokenRow.revoked_at || Date.parse(tokenRow.expires_at) <= Date.now()) {
    return jsonError(res, 401, 'Invalid refresh token');
  }

  db.prepare('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?').run(tokenRow.id);
  return res.json(issueTokens({ id: tokenRow.user_id, email: tokenRow.email, name: tokenRow.name }));
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  const refreshToken = String(req.body.refresh_token || '').trim();
  if (refreshToken) {
    db.prepare(
      'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND user_id = ?'
    ).run(hashToken(refreshToken), req.user.id);
  }
  res.json({ success: true });
});

app.get('/api/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return jsonError(res, 404, 'User not found');
  return res.json({ user });
});

app.get('/api/favorites', authenticateToken, (req, res) => {
  const rows = db.prepare(
    'SELECT symbol FROM favorites WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.id);
  res.json(rows.map((row) => row.symbol));
});

app.post('/api/favorites/:symbol', authenticateToken, (req, res) => {
  const symbol = normalizeSymbol(req.params.symbol);
  if (!stockSymbols.has(symbol)) return jsonError(res, 404, 'Unknown symbol');

  db.prepare(
    'INSERT OR IGNORE INTO favorites (user_id, symbol) VALUES (?, ?)'
  ).run(req.user.id, symbol);

  res.status(201).json({ success: true, symbol });
});

app.delete('/api/favorites/:symbol', authenticateToken, (req, res) => {
  const symbol = normalizeSymbol(req.params.symbol);
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND symbol = ?').run(req.user.id, symbol);
  res.json({ success: true, symbol });
});

app.get('/api/portfolio', authenticateToken, (req, res) => {
  res.json(getPortfolioPayload(req.user.id));
});

app.post('/api/portfolio', authenticateToken, (req, res) => {
  const result = validatePortfolioBody(req.body);
  if (result.error) return jsonError(res, 400, result.error);

  const position = result.value;
  db.prepare(
    `INSERT INTO portfolio_positions (user_id, symbol, quantity, average_price)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, symbol) DO UPDATE SET
       quantity = excluded.quantity,
       average_price = excluded.average_price,
       updated_at = CURRENT_TIMESTAMP`
  ).run(req.user.id, position.symbol, position.quantity, position.average_price);

  const row = db.prepare(
    `SELECT id, symbol, quantity, average_price, updated_at
     FROM portfolio_positions
     WHERE user_id = ? AND symbol = ?`
  ).get(req.user.id, position.symbol);

  return res.status(201).json({ success: true, position: portfolioPositionView(row) });
});

app.delete('/api/portfolio/:symbol', authenticateToken, (req, res) => {
  const symbol = normalizeSymbol(req.params.symbol);
  db.prepare('DELETE FROM portfolio_positions WHERE user_id = ? AND symbol = ?').run(req.user.id, symbol);
  res.json({ success: true, symbol });
});

app.get('/api/alerts', authenticateToken, (req, res) => {
  const rows = db.prepare(
    'SELECT id, symbol, target_price, direction, created_at FROM alerts WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.id);
  res.json(rows);
});

app.post('/api/alerts', authenticateToken, (req, res) => {
  const result = validateAlertBody(req.body);
  if (result.error) return jsonError(res, 400, result.error);

  const alert = result.value;
  const insert = db.prepare(
    'INSERT INTO alerts (user_id, symbol, target_price, direction) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, alert.symbol, alert.target_price, alert.direction);

  res.status(201).json({ success: true, id: insert.lastInsertRowid, ...alert });
});

app.delete('/api/alerts/:id', authenticateToken, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return jsonError(res, 400, 'Invalid alert id');

  db.prepare('DELETE FROM alerts WHERE id = ? AND user_id = ?').run(id, req.user.id);
  res.json({ success: true, id });
});

function startServer() {
  startPriceFeed();
  return app.listen(PORT, HOST, () => {
    console.log(`SSE Live Exchange Ticker running on ${HOST}:${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  db,
  stockState,
  getSnapshot,
  updatePrices,
  startPriceFeed,
  stopPriceFeed,
  syncLiveMarketData,
  startServer,
  authenticateToken,
};
