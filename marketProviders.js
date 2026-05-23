const DEFAULT_TIMEOUT_MS = Number(process.env.MARKET_PROVIDER_TIMEOUT_MS || 4000);

const CRYPTO_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  SOL: 'solana',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  ADA: 'cardano',
};

const FOREX_PAIRS = {
  'USD/TRY': ['USD', 'TRY'],
  'EUR/TRY': ['EUR', 'TRY'],
  'GBP/TRY': ['GBP', 'TRY'],
  'EUR/USD': ['EUR', 'USD'],
  'GBP/USD': ['GBP', 'USD'],
};

function withTimeout(ms = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timeout) };
}

async function getJson(url) {
  const timer = withTimeout();
  try {
    const res = await fetch(url, {
      signal: timer.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'sse-live-ticker/1.0',
      },
    });
    if (!res.ok) throw new Error(`Provider returned ${res.status}`);
    return await res.json();
  } finally {
    timer.done();
  }
}

async function fetchCryptoPrices() {
  const ids = Object.values(CRYPTO_IDS).join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
  const json = await getJson(url);
  const updates = new Map();

  Object.entries(CRYPTO_IDS).forEach(([symbol, id]) => {
    const price = Number(json[id]?.usd);
    if (Number.isFinite(price) && price > 0) {
      updates.set(symbol, { price, source: 'coingecko' });
    }
  });

  return updates;
}

async function fetchForexPrices() {
  const updates = new Map();
  const groups = new Map();

  Object.entries(FOREX_PAIRS).forEach(([symbol, [base, target]]) => {
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push({ symbol, target });
  });

  await Promise.all([...groups.entries()].map(async ([base, pairs]) => {
    const symbols = pairs.map((pair) => pair.target).join(',');
    const json = await getJson(`https://api.frankfurter.app/latest?from=${base}&to=${symbols}`);
    pairs.forEach((pair) => {
      const price = Number(json.rates?.[pair.target]);
      if (Number.isFinite(price) && price > 0) {
        updates.set(pair.symbol, { price, source: 'frankfurter' });
      }
    });
  }));

  return updates;
}

async function fetchYahooPrices(symbols) {
  if (!symbols.length) return new Map();
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}`;
  const json = await getJson(url);
  const updates = new Map();

  (json.quoteResponse?.result || []).forEach((quote) => {
    const symbol = String(quote.symbol || '').toUpperCase();
    const price = Number(quote.regularMarketPrice);
    if (symbol && Number.isFinite(price) && price > 0) {
      updates.set(symbol, { price, source: 'yahoo-finance' });
    }
  });

  return updates;
}

async function fetchLiveMarketUpdates(stocks) {
  const updates = new Map();
  const usStockSymbols = stocks
    .filter((stock) => stock.type === 'stock')
    .map((stock) => stock.symbol);

  const providerResults = await Promise.allSettled([
    fetchCryptoPrices(),
    fetchForexPrices(),
    fetchYahooPrices(usStockSymbols),
  ]);

  providerResults.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    result.value.forEach((value, key) => updates.set(key, value));
  });

  return updates;
}

module.exports = {
  fetchLiveMarketUpdates,
  fetchCryptoPrices,
  fetchForexPrices,
  fetchYahooPrices,
};
