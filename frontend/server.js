const express = require("express");
const path = require("path");
const app = express();

// Service worker "kill switch": desregistra o SW antigo e recarrega todos os clientes.
// Isso libera usuários presos com cache antigo sem precisar de rebuild.
// O novo SW se instala imediatamente (skipWaiting), desregistra a si mesmo
// e navega todos os clientes abertos para forçar reload com conteúdo fresco.
app.get('/service-worker.js', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Content-Type', 'application/javascript');
  res.send(`
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => {
  self.registration.unregister()
    .then(() => self.clients.matchAll({ includeUncontrolled: true }))
    .then(clients => clients.forEach(client => client.navigate(client.url)));
});
  `);
});

app.get('/precache-manifest.*.js', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  const filename = path.basename(req.path);
  res.sendFile(path.join(__dirname, 'build', filename));
});

// Arquivos /static/* têm hash no nome (ex: main.abc123.js), podem ser
// cacheados por 1 ano com segurança — quando mudam, o nome muda junto
app.use('/static', express.static(path.join(__dirname, 'build', 'static'), {
  maxAge: '1y',
  immutable: true,
}));

// Demais arquivos estáticos (imagens, manifest.json, etc.)
app.use(express.static(path.join(__dirname, 'build'), { index: false }));

// index.html: nunca cachear — é ele que referencia os novos hashes de JS/CSS
app.get('/*', function (req, res) {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(3000);
