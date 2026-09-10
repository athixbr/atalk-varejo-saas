const express = require("express");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const app = express();
app.use(express.json());

// ─── Build state ────────────────────────────────────────────────────────────
let buildState = {
  building: false,
  startTime: null,
  logs: [],
  done: false,
  success: null,
};
let sseClients = [];

function notifySSE(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach((res) => {
    try { res.write(data); } catch (_) {}
  });
}

function startBuild() {
  if (buildState.building) return false;
  buildState = { building: true, startTime: Date.now(), logs: [], done: false, success: null };

  const proc = spawn("npm", ["run", "build"], {
    cwd: __dirname,
    env: { ...process.env, FORCE_COLOR: "0" },
  });

  const onData = (chunk) => {
    const line = chunk.toString();
    buildState.logs.push(line);
    notifySSE({ type: "log", data: line });
  };

  proc.stdout.on("data", onData);
  proc.stderr.on("data", onData);

  proc.on("close", (code) => {
    buildState.building = false;
    buildState.done = true;
    buildState.success = code === 0;
    notifySSE({ type: "done", success: buildState.success });
  });

  return true;
}

// ─── Build API routes ────────────────────────────────────────────────────────

// Serve logo from src/assets (available even without a build)
app.get("/__build__/logo", (req, res) => {
  res.sendFile(path.join(__dirname, "src", "assets", "logo1.png"));
});

// SSE stream — send existing logs + subscribe to new ones
app.get("/__build__/progress", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Replay accumulated logs
  buildState.logs.forEach((log) => {
    res.write(`data: ${JSON.stringify({ type: "log", data: log })}\n\n`);
  });

  if (buildState.done) {
    res.write(`data: ${JSON.stringify({ type: "done", success: buildState.success })}\n\n`);
    res.end();
    return;
  }

  sseClients.push(res);
  req.on("close", () => {
    sseClients = sseClients.filter((c) => c !== res);
  });
});

// JSON status
app.get("/__build__/status", (req, res) => {
  res.json({
    building: buildState.building,
    done: buildState.done,
    success: buildState.success,
    elapsed: buildState.startTime ? Date.now() - buildState.startTime : 0,
    buildExists: fs.existsSync(path.join(__dirname, "build", "index.html")),
  });
});

// Trigger a new build
app.post("/__build__/start", (req, res) => {
  const started = startBuild();
  res.json({ started });
});

// ─── Static assets (only when build exists) ──────────────────────────────────

// Service worker kill-switch
app.get("/service-worker.js", (req, res) => {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Content-Type", "application/javascript");
  res.send(`
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => {
  self.registration.unregister()
    .then(() => self.clients.matchAll({ includeUncontrolled: true }))
    .then(clients => clients.forEach(client => client.navigate(client.url)));
});
  `);
});

app.get("/precache-manifest.*.js", (req, res) => {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  const filename = path.basename(req.path);
  res.sendFile(path.join(__dirname, "build", filename));
});

app.use("/static", express.static(path.join(__dirname, "build", "static"), {
  maxAge: "1y",
  immutable: true,
}));

app.use(express.static(path.join(__dirname, "build"), { index: false }));

// ─── Fallback: app or build-progress page ────────────────────────────────────
app.get("/*", function (req, res) {
  const indexPath = path.join(__dirname, "build", "index.html");

  if (!fs.existsSync(indexPath)) {
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(buildProgressPage());
    return;
  }

  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.sendFile(indexPath);
});

app.listen(3000);

// ─── Build progress HTML ──────────────────────────────────────────────────────
function buildProgressPage() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Atualizando sistema — ATalk</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      position: relative;
      background: #f8f9fa;
    }

    /* ── Left section (form side) ──────────────── */
    .left-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 32px;
      background: #ffffff;
    }

    .left-inner {
      width: 100%;
      max-width: 420px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
    }

    .logo {
      width: 180px;
      height: auto;
      margin-bottom: 32px;
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.1));
    }

    /* ── Card ──────────────────────────────────── */
    .card {
      width: 100%;
      background: #ffffff;
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.10);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .card-heading {
      color: #2d3748;
      font-size: 1.6rem;
      font-weight: 700;
      margin-bottom: 2px;
    }

    .card-sub {
      color: #718096;
      font-size: 0.95rem;
    }

    /* ── Spinner ───────────────────────────────── */
    .spinner-wrap {
      display: flex;
      justify-content: center;
      padding: 8px 0;
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #e2e8f0;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
    }

    .spinner.done {
      border-top-color: #48bb78;
      animation: none;
      border-color: #48bb78;
    }

    .spinner.error {
      border-top-color: #fc8181;
      animation: none;
      border-color: #fc8181;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ── Progress bar ──────────────────────────── */
    .progress-track {
      height: 6px;
      background: #e2e8f0;
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 3px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      width: 0;
    }

    .progress-fill.indeterminate {
      width: 38%;
      animation: slide 1.6s ease-in-out infinite;
    }

    .progress-fill.full { width: 100%; animation: none; }
    .progress-fill.full-error {
      width: 100%;
      animation: none;
      background: #fc8181;
    }

    @keyframes slide {
      0%   { transform: translateX(-120%); }
      100% { transform: translateX(320%); }
    }

    /* ── Status text ───────────────────────────── */
    .status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .status-text {
      font-size: 0.875rem;
      color: #718096;
    }

    .timer-text {
      font-size: 0.8rem;
      color: #a0aec0;
      font-variant-numeric: tabular-nums;
    }

    /* ── Success / error notice ────────────────── */
    .notice {
      display: none;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      border-radius: 12px;
      font-size: 0.9rem;
      font-weight: 500;
    }

    .notice.success {
      background: #f0fff4;
      border: 1px solid #9ae6b4;
      color: #276749;
    }

    .notice.error-box {
      background: #fff5f5;
      border: 1px solid #feb2b2;
      color: #9b2c2c;
    }

    .notice.show { display: flex; }

    /* ── Footer ────────────────────────────────── */
    .footer {
      position: absolute;
      bottom: 0;
      width: 100%;
      padding: 16px;
      text-align: center;
      color: #718096;
      font-size: 0.8rem;
      pointer-events: none;
    }

    /* ── Right section ─────────────────────────── */
    .right-section {
      flex: 1;
      display: none;
      position: relative;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      overflow: hidden;
      align-items: center;
      justify-content: center;
    }

    @media (min-width: 900px) {
      .right-section { display: flex; }
    }

    .right-content {
      text-align: center;
      color: #ffffff;
      max-width: 400px;
      padding: 40px;
      z-index: 1;
    }

    .right-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 32px;
      opacity: 0.9;
    }

    .right-title {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 16px;
      text-shadow: 0 2px 10px rgba(0,0,0,0.15);
    }

    .right-desc {
      font-size: 1.05rem;
      opacity: 0.85;
      line-height: 1.6;
    }

    /* decorative circles */
    .deco {
      position: absolute;
      border-radius: 50%;
      background: rgba(255,255,255,0.06);
    }

    .deco-1 { width: 320px; height: 320px; top: -80px; right: -80px; }
    .deco-2 { width: 200px; height: 200px; bottom: 40px; left: -60px; }
    .deco-3 { width: 120px; height: 120px; bottom: 200px; right: 60px; }

    /* dots indicator */
    .dots {
      position: absolute;
      bottom: 36px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 8px;
    }

    .dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      background: rgba(255,255,255,0.4);
      animation: dotPulse 2s ease-in-out infinite;
    }

    .dot:nth-child(2) { animation-delay: 0.3s; }
    .dot:nth-child(3) { animation-delay: 0.6s; }

    @keyframes dotPulse {
      0%, 100% { background: rgba(255,255,255,0.4); transform: scale(1); }
      50%       { background: rgba(255,255,255,0.9); transform: scale(1.2); }
    }
  </style>
</head>
<body>

  <!-- Left -->
  <div class="left-section">
    <div class="left-inner">
      <img class="logo" src="/__build__/logo" alt="ATalk" />

      <div class="card">
        <div>
          <div class="card-heading" id="card-heading">Sistema em atualização</div>
          <div class="card-sub" id="card-sub">Aguarde enquanto o novo build é preparado…</div>
        </div>

        <div class="spinner-wrap">
          <div class="spinner" id="spinner"></div>
        </div>

        <div class="progress-track">
          <div class="progress-fill" id="progress-fill"></div>
        </div>

        <div class="status-row">
          <span class="status-text" id="status-text">Conectando…</span>
          <span class="timer-text" id="timer-text"></span>
        </div>

        <div class="notice success" id="notice-success">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>Build concluído! Abrindo o sistema em <strong id="countdown">3</strong>s…</span>
        </div>

        <div class="notice error-box" id="notice-error">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>Falha no build. Contate o suporte técnico.</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Right -->
  <div class="right-section">
    <div class="deco deco-1"></div>
    <div class="deco deco-2"></div>
    <div class="deco deco-3"></div>

    <div class="right-content">
      <svg class="right-icon" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="40" cy="40" r="36" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
        <path d="M40 16 L40 40 L56 56" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="40" cy="40" r="4" fill="white"/>
      </svg>
      <div class="right-title">Aguarde um momento</div>
      <div class="right-desc">
        Estamos atualizando o sistema com as últimas melhorias.<br/>
        Você será redirecionado automaticamente quando terminar.
      </div>
    </div>

    <div class="dots">
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">Desenvolvido por <strong>IRYD</strong></div>

<script>
  let evtSource = null;
  let timerInterval = null;
  let buildStart = null;
  let redirectCountdown = null;

  const spinner      = document.getElementById('spinner');
  const progFill     = document.getElementById('progress-fill');
  const statusText   = document.getElementById('status-text');
  const timerText    = document.getElementById('timer-text');
  const cardHeading  = document.getElementById('card-heading');
  const cardSub      = document.getElementById('card-sub');
  const noticeOk     = document.getElementById('notice-success');
  const noticeErr    = document.getElementById('notice-error');
  const countdown    = document.getElementById('countdown');

  function fmtMs(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? m + 'm ' + (s % 60) + 's' : s + 's';
  }

  function setBuilding() {
    spinner.className = 'spinner';
    progFill.className = 'progress-fill indeterminate';
    cardHeading.textContent = 'Sistema em atualização';
    cardSub.textContent = 'Aguarde enquanto o novo build é preparado…';
    statusText.textContent = 'Build em andamento…';
    noticeOk.classList.remove('show');
    noticeErr.classList.remove('show');
  }

  function setSuccess() {
    spinner.className = 'spinner done';
    progFill.className = 'progress-fill full';
    cardHeading.textContent = 'Atualização concluída!';
    cardSub.textContent = 'O sistema foi atualizado com sucesso.';
    statusText.textContent = 'Redirecionando…';
    clearInterval(timerInterval);
    noticeOk.classList.add('show');
    startRedirect();
  }

  function setError() {
    spinner.className = 'spinner error';
    progFill.className = 'progress-fill full-error';
    cardHeading.textContent = 'Falha na atualização';
    cardSub.textContent = 'Ocorreu um erro durante o build.';
    statusText.textContent = 'Build falhou.';
    clearInterval(timerInterval);
    noticeErr.classList.add('show');
  }

  function startTimer() {
    buildStart = Date.now();
    timerInterval = setInterval(() => {
      timerText.textContent = fmtMs(Date.now() - buildStart);
    }, 500);
  }

  function startRedirect() {
    let s = 3;
    countdown.textContent = s;
    redirectCountdown = setInterval(() => {
      s--;
      countdown.textContent = s;
      if (s <= 0) {
        clearInterval(redirectCountdown);
        window.location.href = '/';
      }
    }, 1000);
  }

  function connectSSE() {
    if (evtSource) { evtSource.close(); evtSource = null; }
    evtSource = new EventSource('/__build__/progress');
    evtSource.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'done') {
        evtSource.close();
        evtSource = null;
        if (msg.success) setSuccess(); else setError();
      }
    };
  }

  (async () => {
    try {
      const res = await fetch('/__build__/status');
      const s = await res.json();

      if (s.building) {
        setBuilding();
        buildStart = Date.now() - s.elapsed;
        startTimer();
        connectSSE();
      } else if (s.done && s.success) {
        setSuccess();
      } else if (s.done && !s.success) {
        setError();
      } else {
        // idle — no build yet, just show waiting state
        statusText.textContent = 'Aguardando início do build…';
        progFill.className = 'progress-fill indeterminate';
        connectSSE();
      }
    } catch (_) {
      statusText.textContent = 'Verificando status…';
      setTimeout(() => window.location.reload(), 5000);
    }
  })();
</script>
</body>
</html>`;
}
