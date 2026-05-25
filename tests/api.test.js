const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.BCRYPT_COST = '4';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.API_RATE_LIMIT_MAX = '1000';
process.env.JWT_SECRET = 'test_secret';
process.env.DB_PATH = path.join(os.tmpdir(), `sse-live-ticker-${Date.now()}-${Math.random()}.db`);
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';

const { app, db, getSnapshot, stopPriceFeed } = require('../server');
const nativeFetch = global.fetch;

function clearDb() {
  db.prepare('DELETE FROM refresh_tokens').run();
  db.prepare('DELETE FROM password_reset_tokens').run();
  db.prepare('DELETE FROM portfolio_positions').run();
  db.prepare('DELETE FROM alerts').run();
  db.prepare('DELETE FROM favorites').run();
  db.prepare('DELETE FROM users').run();
}

async function registerUser(email = 'user@example.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', name: 'Test User' });

  expect(res.status).toBe(201);
  return res.body;
}

beforeEach(() => {
  clearDb();
});

afterEach(() => {
  global.fetch = nativeFetch;
});

afterAll(() => {
  stopPriceFeed();
  db.close();
  if (fs.existsSync(process.env.DB_PATH)) fs.unlinkSync(process.env.DB_PATH);
});

describe('market data API', () => {
  it('returns the live ticker snapshot', async () => {
    const res = await request(app).get('/api/stocks');

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(20);
    expect(res.body[0]).toHaveProperty('symbol');
    expect(res.body[0]).toHaveProperty('price');
  });

  it('filters stocks by type and returns detail by symbol', async () => {
    const cryptoRes = await request(app).get('/api/stocks?type=crypto');
    expect(cryptoRes.status).toBe(200);
    expect(cryptoRes.body.every((stock) => stock.type === 'crypto')).toBe(true);

    const symbol = getSnapshot()[0].symbol;
    const detailRes = await request(app).get(`/api/stocks/${symbol}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.symbol).toBe(symbol);
  });
});

describe('auth API', () => {
  it('registers, logs in, reads /api/me, refreshes, and logs out', async () => {
    const registered = await registerUser('auth@example.com');

    expect(registered.access_token).toEqual(registered.token);
    expect(registered.refresh_token).toBeTruthy();
    expect(registered.user.email).toBe('auth@example.com');

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'auth@example.com', password: 'password123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.access_token).toBeTruthy();

    const meRes = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${loginRes.body.access_token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('auth@example.com');

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: loginRes.body.refresh_token });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.access_token).toBeTruthy();

    const reusedRefreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: loginRes.body.refresh_token });

    expect(reusedRefreshRes.status).toBe(401);

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${refreshRes.body.access_token}`)
      .send({ refresh_token: refreshRes.body.refresh_token });

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);
  });

  it('validates registration input and duplicate email', async () => {
    const weakRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bad-email', password: '123' });

    expect(weakRes.status).toBe(400);

    await registerUser('duplicate@example.com');
    const duplicateRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'duplicate@example.com', password: 'password123' });

    expect(duplicateRes.status).toBe(409);
  });

  it('signs in with a verified Google credential', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        aud: 'test-google-client-id',
        iss: 'https://accounts.google.com',
        exp: Math.floor(Date.now() / 1000) + 300,
        email: 'google@example.com',
        email_verified: 'true',
        sub: 'google-sub-123',
        name: 'Google User',
      }),
    }));

    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'google-id-token' });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeTruthy();
    expect(res.body.user.email).toBe('google@example.com');

    const user = db.prepare('SELECT email, google_sub, auth_provider FROM users WHERE email = ?').get('google@example.com');
    expect(user.google_sub).toBe('google-sub-123');
    expect(user.auth_provider).toBe('google');
  });

  it('creates a reset token and changes the password', async () => {
    await registerUser('reset@example.com');

    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@example.com' });

    expect(forgotRes.status).toBe(200);
    expect(forgotRes.body.reset_token).toBeTruthy();

    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: forgotRes.body.reset_token, password: 'newpassword123' });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    const oldLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset@example.com', password: 'password123' });

    expect(oldLoginRes.status).toBe(401);

    const newLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset@example.com', password: 'newpassword123' });

    expect(newLoginRes.status).toBe(200);
  });
});

describe('personal data APIs', () => {
  it('requires auth for favorites and alerts', async () => {
    const favoriteRes = await request(app).get('/api/favorites');
    const alertRes = await request(app).get('/api/alerts');
    const portfolioRes = await request(app).get('/api/portfolio');

    expect(favoriteRes.status).toBe(401);
    expect(alertRes.status).toBe(401);
    expect(portfolioRes.status).toBe(401);
  });

  it('creates, lists, and deletes favorites', async () => {
    const { access_token: token } = await registerUser('favorites@example.com');

    const addRes = await request(app)
      .post('/api/favorites/AAPL')
      .set('Authorization', `Bearer ${token}`);

    expect(addRes.status).toBe(201);
    expect(addRes.body.symbol).toBe('AAPL');

    const listRes = await request(app)
      .get('/api/favorites')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body).toContain('AAPL');

    const deleteRes = await request(app)
      .delete('/api/favorites/AAPL')
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
  });

  it('creates, lists, validates, and deletes price alerts', async () => {
    const { access_token: token } = await registerUser('alerts@example.com');

    const invalidRes = await request(app)
      .post('/api/alerts')
      .set('Authorization', `Bearer ${token}`)
      .send({ symbol: 'AAPL', target_price: -1, direction: 'sideways' });

    expect(invalidRes.status).toBe(400);

    const createRes = await request(app)
      .post('/api/alerts')
      .set('Authorization', `Bearer ${token}`)
      .send({ symbol: 'AAPL', target_price: 200, direction: 'above' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeTruthy();

    const listRes = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);

    const deleteRes = await request(app)
      .delete(`/api/alerts/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
  });

  it('creates, values, updates, and deletes portfolio positions', async () => {
    const { access_token: token } = await registerUser('portfolio@example.com');

    const invalidRes = await request(app)
      .post('/api/portfolio')
      .set('Authorization', `Bearer ${token}`)
      .send({ symbol: 'AAPL', quantity: 0, average_price: 100 });

    expect(invalidRes.status).toBe(400);

    const createRes = await request(app)
      .post('/api/portfolio')
      .set('Authorization', `Bearer ${token}`)
      .send({ symbol: 'AAPL', quantity: 2, average_price: 100 });

    expect(createRes.status).toBe(201);
    expect(createRes.body.position.symbol).toBe('AAPL');
    expect(createRes.body.position.market_value).toBeGreaterThan(0);

    const updateRes = await request(app)
      .post('/api/portfolio')
      .set('Authorization', `Bearer ${token}`)
      .send({ symbol: 'AAPL', quantity: 3, average_price: 120 });

    expect(updateRes.status).toBe(201);
    expect(updateRes.body.position.quantity).toBe(3);

    const listRes = await request(app)
      .get('/api/portfolio')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.positions).toHaveLength(1);
    expect(listRes.body.summary.market_value).toBeGreaterThan(0);

    const deleteRes = await request(app)
      .delete('/api/portfolio/AAPL')
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
  });
});
