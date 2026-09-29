'use strict';
// Servidor de Winbox Web: sirve la interfaz y hace de proxy hacia la API REST de RouterOS.
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');

const PORT = process.env.PORT || 8080;
const HOST = process.env.BIND || '127.0.0.1';
const ALLOW_PUBLIC_ROUTERS = process.env.ALLOW_PUBLIC_ROUTERS === '1';
const SESSION_TTL = 30 * 60 * 1000;
const PUBLIC = path.join(__dirname, 'public');
const sessions = new Map();

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

function isPrivateHost(h) {
  if (h === 'localhost') return true;
  if (net.isIPv4(h)) {
    const [a, b] = h.split('.').map(Number);
    return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
  }
  if (net.isIPv6(h)) return h === '::1' || /^f[cd]/i.test(h) || /^fe80/i.test(h);
  return !h.includes('.') || h.endsWith('.local') || h.endsWith('.lan');
}

function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > limit) { reject(new Error('Body demasiado grande')); req.destroy(); } });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function routerRequest(s, method, restPath, body) {
  return new Promise((resolve, reject) => {
    const lib = s.tls ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const r = lib.request({
      host: s.host, port: s.port, method, path: '/rest' + restPath,
      auth: `${s.user}:${s.pass}`, rejectUnauthorized: false, timeout: 15000,
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}
    }, resp => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => {
        let json; try { json = d ? JSON.parse(d) : null; } catch { json = { raw: d }; }
        resolve({ status: resp.statusCode, json });
      });
    });
    r.on('timeout', () => r.destroy(new Error('Tiempo de espera agotado al contactar el router')));
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function api(req, res, url) {
  try {
    if (url.pathname === '/api/login' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req));
      const host = String(b.host || '').trim();
      const port = parseInt(b.port, 10) || (b.tls ? 443 : 80);
      if (!host || !b.user) return send(res, 400, { error: 'Faltan datos de conexión' });
      if (!/^[A-Za-z0-9.\-:]+$/.test(host)) return send(res, 400, { error: 'Host inválido' });
      if (!ALLOW_PUBLIC_ROUTERS && !isPrivateHost(host))
        return send(res, 403, { error: 'Solo se permiten routers en red local (usa ALLOW_PUBLIC_ROUTERS=1 para permitir IPs públicas)' });
      const s = { host, port, tls: !!b.tls, user: String(b.user), pass: String(b.pass || ''), last: Date.now() };
      const r = await routerRequest(s, 'GET', '/system/identity');
      if (r.status === 401) return send(res, 401, { error: 'Usuario o contraseña incorrectos' });
      if (r.status !== 200) return send(res, 502, { error: `El router respondió ${r.status}. ¿Está habilitado el servicio www/www-ssl y es RouterOS v7.1+?` });
      const token = crypto.randomBytes(24).toString('hex');
      sessions.set(token, s);
      return send(res, 200, { token, identity: r.json && r.json.name });
    }

    const token = req.headers['x-session'];
    const s = sessions.get(token);
    if (!s || Date.now() - s.last > SESSION_TTL) { sessions.delete(token); return send(res, 401, { error: 'Sesión expirada' }); }
    s.last = Date.now();

    if (url.pathname === '/api/logout') { sessions.delete(token); return send(res, 200, { ok: true }); }

    if (url.pathname === '/api/rest' && req.method === 'POST') {
      // { method, path, body } → reenviado tal cual a /rest/<path>
      const b = JSON.parse(await readBody(req));
      const method = String(b.method || 'GET').toUpperCase();
      const p = String(b.path || '');
      if (!['GET', 'PUT', 'PATCH', 'DELETE', 'POST'].includes(method)) return send(res, 400, { error: 'Método inválido' });
      if (!/^\/[A-Za-z0-9\-_\/*.]*(\?[A-Za-z0-9\-_=&.,*]*)?$/.test(p)) return send(res, 400, { error: 'Ruta inválida' });
      const r = await routerRequest(s, method, p, b.body);
      return send(res, r.status < 400 ? 200 : r.status, r.json === null ? { ok: true } : r.json);
    }
    send(res, 404, { error: 'No encontrado' });
  } catch (e) {
    send(res, 502, { error: 'No se pudo contactar con el router: ' + e.message });
  }
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  const file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, HOST, () => console.log(`Winbox Web en http://${HOST}:${PORT}`));

setInterval(() => { const n = Date.now(); for (const [t, s] of sessions) if (n - s.last > SESSION_TTL) sessions.delete(t); }, 60000);
