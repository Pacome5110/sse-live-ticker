const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const baseUrl = process.env.CAPTURE_BASE_URL || 'http://localhost:3001';
const outputDir = path.resolve(process.env.CAPTURE_OUTPUT_DIR || 'docs/screenshots');
const browserPath = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((candidate) => fs.existsSync(candidate));

if (!browserPath) {
  throw new Error('No supported browser found. Install Microsoft Edge or Chrome.');
}

const shots = [
  { name: '01-dashboard.png', url: `${baseUrl}/?capture=dashboard`, width: 1365, height: 768 },
  { name: '02-auth-modal.png', url: `${baseUrl}/?capture=auth`, width: 1365, height: 768 },
  { name: '03-watchlist.png', url: `${baseUrl}/?capture=watchlist`, width: 1365, height: 768 },
  { name: '04-alerts-modal.png', url: `${baseUrl}/?capture=alerts`, width: 1365, height: 768 },
  { name: '05-chart-modal.png', url: `${baseUrl}/?capture=chart`, width: 1365, height: 768 },
  { name: '06-mobile.png', url: `${baseUrl}/?capture=mobile`, width: 390, height: 844 },
  { name: '07-empty-error-state.png', url: `${baseUrl}/?capture=error`, width: 1365, height: 768 },
  { name: '08-theme-ocean.png', url: `${baseUrl}/?capture=theme&theme=ocean`, width: 1365, height: 768 },
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function waitForPageTarget(port, expectedUrl) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
      const target = targets.find((item) => item.type === 'page' && item.url.startsWith(expectedUrl));
      if (target?.webSocketDebuggerUrl) return target;
    } catch (_err) {
      // Browser is still starting.
    }
    await delay(200);
  }
  throw new Error(`Timed out waiting for browser target: ${expectedUrl}`);
}

function createCdpClient(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let id = 0;

    ws.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          id += 1;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((res, rej) => pending.set(id, { res, rej, method }));
        },
        close() {
          ws.close();
        },
      });
    });

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (!msg.id || !pending.has(msg.id)) return;
      const item = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) item.rej(new Error(`${item.method}: ${msg.error.message}`));
      else item.res(msg.result);
    });

    ws.addEventListener('error', reject);
  });
}

function waitForExit(child, timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    const timeout = setTimeout(resolve, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function removeDirWithRetry(dir) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      if (attempt === 4) return;
      await delay(300);
    }
  }
}

async function captureShot(shot, index) {
  const port = 9300 + index;
  const profile = path.join(os.tmpdir(), `sse-live-ticker-capture-${Date.now()}-${index}`);
  const out = path.join(outputDir, shot.name);
  fs.mkdirSync(profile, { recursive: true });

  const browser = spawn(browserPath, [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--no-first-run',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${shot.width},${shot.height}`,
    shot.url,
  ], { stdio: 'ignore' });

  let client;
  try {
    const target = await waitForPageTarget(port, shot.url);
    client = await createCdpClient(target.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: shot.width,
      height: shot.height,
      deviceScaleFactor: 1,
      mobile: shot.width < 600,
    });

    const waitExpression = `new Promise((resolve) => {
        const started = Date.now();
        const done = () => window.__REPORT_CAPTURE_READY === true &&
          (document.body.dataset.captureMode === 'error' || document.querySelectorAll('#tickerBody tr').length > 0) &&
          document.querySelector('#statusText')?.textContent?.trim() === 'Live';
        const timer = setInterval(() => {
          if (done() || Date.now() - started > 7000) {
            clearInterval(timer);
            resolve(true);
          }
        }, 100);
      })`;

    await delay(1000);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await client.send('Runtime.evaluate', {
          expression: waitExpression,
          awaitPromise: true,
          returnByValue: true,
        });
        break;
      } catch (err) {
        if (attempt === 1 || !String(err.message).includes('Execution context was destroyed')) throw err;
        await delay(1000);
      }
    }

    await delay(500);
    const screenshot = await client.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    fs.writeFileSync(out, Buffer.from(screenshot.data, 'base64'));
    return out;
  } finally {
    if (client) client.close();
    browser.kill();
    await waitForExit(browser);
    await removeDirWithRetry(profile);
  }
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  for (let i = 0; i < shots.length; i += 1) {
    const file = await captureShot(shots[i], i);
    console.log(`Captured ${path.relative(process.cwd(), file)}`);
  }
})();
