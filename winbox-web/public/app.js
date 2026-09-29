'use strict';
const $ = s => document.querySelector(s);
let token = sessionStorage.getItem('wb-token'), timer = null, current = null;

/* ---------- Definición del menú (equivalente al árbol de Winbox) ---------- */
const bytes = v => { v = +v; if (isNaN(v)) return ''; const u = ['B','KiB','MiB','GiB','TiB']; let i = 0; while (v >= 1024 && i < 4) { v /= 1024; i++; } return v.toFixed(i ? 1 : 0) + ' ' + u[i]; };
const MENU = [
  { grp: 'General' },
  { id: 'home', label: 'Resumen', custom: 'home' },
  { grp: 'Red' },
  { id: 'ifaces', label: 'Interfaces', path: '/interface', toggle: true,
    cols: [['name','Nombre'],['type','Tipo'],['running','Activa','bool'],['mtu','MTU'],['rx-byte','RX','bytes'],['tx-byte','TX','bytes'],['comment','Comentario']] },
  { id: 'bridge', label: 'Bridge', path: '/interface/bridge', toggle: true, remove: true,
    cols: [['name','Nombre'],['running','Activo','bool'],['mac-address','MAC'],['comment','Comentario']], add: [['name','Nombre']] },
  { id: 'bports', label: 'Bridge Ports', path: '/interface/bridge/port', toggle: true, remove: true,
    cols: [['interface','Interfaz'],['bridge','Bridge'],['pvid','PVID'],['comment','Comentario']], add: [['interface','Interfaz'],['bridge','Bridge']] },
  { id: 'wifi', label: 'Wi-Fi clientes', path: '/interface/wifi/registration-table',
    cols: [['interface','Interfaz'],['mac-address','MAC'],['ssid','SSID'],['signal','Señal'],['uptime','Uptime']] },
  { grp: 'IP' },
  { id: 'addr', label: 'Direcciones', path: '/ip/address', toggle: true, remove: true,
    cols: [['address','Dirección'],['network','Red'],['interface','Interfaz'],['comment','Comentario']],
    add: [['address','Dirección (ej. 192.168.1.1/24)'],['interface','Interfaz'],['comment','Comentario']] },
  { id: 'routes', label: 'Rutas', path: '/ip/route', toggle: true, remove: true,
    cols: [['dst-address','Destino'],['gateway','Gateway'],['distance','Distancia'],['active','Activa','bool'],['comment','Comentario']],
    add: [['dst-address','Destino (ej. 0.0.0.0/0)'],['gateway','Gateway'],['comment','Comentario']] },
  { id: 'dhcp', label: 'DHCP Leases', path: '/ip/dhcp-server/lease', toggle: true, remove: true,
    cols: [['address','IP'],['mac-address','MAC'],['host-name','Host'],['status','Estado'],['server','Servidor'],['comment','Comentario']],
    add: [['address','IP'],['mac-address','MAC'],['server','Servidor'],['comment','Comentario']] },
  { id: 'arp', label: 'ARP', path: '/ip/arp', cols: [['address','IP'],['mac-address','MAC'],['interface','Interfaz'],['status','Estado']] },
  { id: 'dnsc', label: 'DNS Cache', path: '/ip/dns/cache', cols: [['name','Nombre'],['type','Tipo'],['data','Dato'],['ttl','TTL']] },
  { grp: 'Firewall' },
  { id: 'filter', label: 'Filter Rules', path: '/ip/firewall/filter', toggle: true, remove: true,
    cols: [['chain','Chain'],['action','Acción'],['protocol','Proto'],['src-address','Origen'],['dst-address','Destino'],['dst-port','Puerto'],['bytes','Bytes','bytes'],['comment','Comentario']],
    add: [['chain','Chain (input/forward/output)'],['action','Acción (accept/drop/reject)'],['protocol','Protocolo'],['dst-port','Puerto destino'],['comment','Comentario']] },
  { id: 'nat', label: 'NAT', path: '/ip/firewall/nat', toggle: true, remove: true,
    cols: [['chain','Chain'],['action','Acción'],['protocol','Proto'],['dst-port','Puerto'],['to-addresses','To addr'],['to-ports','To port'],['out-interface','Out'],['comment','Comentario']],
    add: [['chain','Chain (srcnat/dstnat)'],['action','Acción (masquerade/dst-nat)'],['out-interface','Interfaz salida'],['protocol','Protocolo'],['dst-port','Puerto destino'],['to-addresses','To addresses'],['to-ports','To ports'],['comment','Comentario']] },
  { id: 'addrlist', label: 'Address Lists', path: '/ip/firewall/address-list', toggle: true, remove: true,
    cols: [['list','Lista'],['address','Dirección'],['timeout','Timeout'],['comment','Comentario']], add: [['list','Lista'],['address','Dirección'],['comment','Comentario']] },
  { id: 'conn', label: 'Conexiones', path: '/ip/firewall/connection', remove: true,
    cols: [['protocol','Proto'],['src-address','Origen'],['dst-address','Destino'],['tcp-state','Estado'],['timeout','Timeout']] },
  { grp: 'Servicios' },
  { id: 'queues', label: 'Simple Queues', path: '/queue/simple', toggle: true, remove: true,
    cols: [['name','Nombre'],['target','Target'],['max-limit','Max limit'],['rate','Tasa'],['comment','Comentario']],
    add: [['name','Nombre'],['target','Target (ej. 192.168.88.10/32)'],['max-limit','Max limit (ej. 10M/10M)'],['comment','Comentario']] },
  { id: 'ppp', label: 'PPP Secrets', path: '/ppp/secret', toggle: true, remove: true,
    cols: [['name','Usuario'],['service','Servicio'],['profile','Perfil'],['remote-address','IP remota'],['comment','Comentario']],
    add: [['name','Usuario'],['password','Contraseña','password'],['service','Servicio (any/pppoe/l2tp...)'],['profile','Perfil'],['comment','Comentario']] },
  { id: 'hsusers', label: 'Hotspot Users', path: '/ip/hotspot/user', toggle: true, remove: true,
    cols: [['name','Usuario'],['profile','Perfil'],['uptime','Uptime'],['limit-uptime','Límite'],['comment','Comentario']],
    add: [['name','Usuario'],['password','Contraseña','password'],['profile','Perfil'],['limit-uptime','Límite uptime'],['comment','Comentario']] },
  { grp: 'Sistema' },
  { id: 'users', label: 'Usuarios', path: '/user', toggle: true, remove: true,
    cols: [['name','Usuario'],['group','Grupo'],['address','Dirección'],['last-logged-in','Último acceso']],
    add: [['name','Usuario'],['password','Contraseña','password'],['group','Grupo (full/read/write)']] },
  { id: 'log', label: 'Log', path: '/log', cols: [['time','Hora'],['topics','Temas'],['message','Mensaje']], reverse: true },
  { id: 'term', label: 'Terminal', custom: 'term' },
];
const ITEMS = MENU.filter(m => m.id);

/* ---------- Utilidades ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3500); }

async function rest(method, path, body) {
  const r = await fetch('/api/rest', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session': token }, body: JSON.stringify({ method, path, body }) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && j.error === 'Sesión expirada') { logout(true); throw new Error(j.error); }
  if (!r.ok) throw new Error(j.detail || j.message || j.error || 'Error ' + r.status);
  return j;
}

/* ---------- Login ---------- */
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); $('#loginErr').textContent = '';
  const f = new FormData(e.target);
  try {
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: f.get('host'), port: f.get('port'), tls: f.get('tls') === 'on', user: f.get('user'), pass: f.get('pass') }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    token = j.token; sessionStorage.setItem('wb-token', token); sessionStorage.setItem('wb-id', j.identity || '');
    start();
  } catch (err) { $('#loginErr').textContent = err.message; }
});
$('#loginForm [name=tls]').addEventListener('change', e => { const p = $('#loginForm [name=port]'); if (['80','443',''].includes(p.value)) p.value = e.target.checked ? 443 : 80; });

function logout(silent) {
  if (token && !silent) fetch('/api/logout', { headers: { 'X-Session': token } });
  token = null; sessionStorage.removeItem('wb-token'); clearInterval(timer);
  $('#app').classList.add('hidden'); $('#login').classList.remove('hidden');
}
$('#logout').onclick = () => logout();
$('#burger').onclick = () => $('#menu').classList.toggle('open');

/* ---------- App ---------- */
function start() {
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#title').textContent = 'Winbox Web — ' + (sessionStorage.getItem('wb-id') || 'MikroTik');
  $('#menu').innerHTML = MENU.map(m => m.grp ? `<div class="grp">${m.grp}</div>` : `<a data-id="${m.id}">${m.label}</a>`).join('');
  $('#menu').onclick = e => { const a = e.target.closest('a'); if (a) { open(a.dataset.id); $('#menu').classList.remove('open'); } };
  open('home');
}
$('#auto').onchange = e => { clearInterval(timer); if (e.target.checked) timer = setInterval(() => current && current.refresh && current.refresh(true), 5000); };

function open(id) {
  const m = ITEMS.find(i => i.id === id);
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.id === id));
  $('#toolbar').innerHTML = ''; $('#view').innerHTML = '';
  current = m.custom === 'home' ? home(m) : m.custom === 'term' ? terminal(m) : table(m);
  current.refresh();
}

function cell(v, type) {
  if (type === 'bool') return `<span class="dot ${v === 'true' ? 'on' : ''}"></span>`;
  if (type === 'bytes') return esc(bytes(v));
  return esc(v);
}

function table(m) {
  let rows = [], filter = '';
  $('#toolbar').innerHTML = `<h2>${m.label}</h2>${m.add ? '<button id="add">+ Añadir</button>' : ''}<button id="ref" class="ghost">Actualizar</button><input id="flt" placeholder="Filtrar…">`;
  const draw = () => {
    const shown = rows.filter(r => !filter || JSON.stringify(r).toLowerCase().includes(filter));
    if (!shown.length) { $('#view').innerHTML = '<div class="tablewrap"><div class="empty">Sin elementos</div></div>'; return; }
    const hasAct = m.toggle || m.remove;
    $('#view').innerHTML = `<div class="tablewrap"><table><thead><tr>${m.cols.map(c => `<th>${c[1]}</th>`).join('')}${hasAct ? '<th></th>' : ''}</tr></thead><tbody>` +
      shown.map(r => `<tr class="${r.disabled === 'true' ? 'off' : ''}">${m.cols.map(c => `<td>${cell(r[c[0]], c[2])}</td>`).join('')}` +
        (hasAct ? `<td class="act">${m.toggle ? `<button class="sm ghost" data-t="${esc(r['.id'])}" data-d="${r.disabled === 'true'}">${r.disabled === 'true' ? 'Habilitar' : 'Deshabilitar'}</button>` : ''}${m.remove ? `<button class="sm danger" data-r="${esc(r['.id'])}">Eliminar</button>` : ''}</td>` : '') + '</tr>').join('') + '</tbody></table></div>';
  };
  const refresh = async quiet => {
    try { rows = await rest('GET', m.path); if (!Array.isArray(rows)) rows = []; if (m.reverse) rows.reverse(); draw(); }
    catch (e) { if (!quiet) { rows = []; $('#view').innerHTML = `<div class="tablewrap"><div class="empty">${esc(e.message)}</div></div>`; } }
  };
  $('#ref').onclick = () => refresh();
  $('#flt').oninput = e => { filter = e.target.value.toLowerCase(); draw(); };
  if (m.add) $('#add').onclick = () => form('Añadir — ' + m.label, m.add, async data => { await rest('PUT', m.path, data); refresh(); });
  $('#view').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.t) await rest('PATCH', `${m.path}/${b.dataset.t}`, { disabled: b.dataset.d === 'true' ? 'false' : 'true' });
      else if (b.dataset.r) { if (!confirm('¿Eliminar este elemento?')) return; await rest('DELETE', `${m.path}/${b.dataset.r}`); }
      refresh();
    } catch (err) { toast(err.message); }
  };
  return { refresh };
}

function form(title, fields, onOk) {
  $('#dlgTitle').textContent = title;
  $('#dlgFields').innerHTML = fields.map(f => `<label>${esc(f[1])}<input name="${esc(f[0])}" type="${f[2] || 'text'}" autocomplete="off"></label>`).join('');
  const dlg = $('#dlg');
  dlg.onclose = async () => {
    if (dlg.returnValue !== 'ok') return;
    const data = {}; dlg.querySelectorAll('#dlgFields input').forEach(i => { if (i.value.trim()) data[i.name] = i.value.trim(); });
    try { await onOk(data); toast('Guardado'); } catch (e) { toast(e.message); }
  };
  dlg.returnValue = ''; dlg.showModal();
}

function home() {
  $('#toolbar').innerHTML = '<h2>Resumen</h2><button id="ref" class="ghost">Actualizar</button>';
  const refresh = async quiet => {
    try {
      const [r, id, rb] = await Promise.all([rest('GET', '/system/resource'), rest('GET', '/system/identity'), rest('GET', '/system/routerboard').catch(() => ({}))]);
      const memUsed = 100 - (r['free-memory'] / r['total-memory'] * 100), hddUsed = 100 - (r['free-hdd-space'] / r['total-hdd-space'] * 100);
      const S = (l, v) => `<div class="stat"><small>${l}</small><b>${esc(v ?? '—')}</b></div>`;
      const B = (l, p, d) => `<div class="stat"><small>${l}</small><b>${p.toFixed(0)}%</b><div class="bar"><i style="width:${p}%"></i></div><small>${d}</small></div>`;
      $('#view').innerHTML = `<div class="grid">${S('Identidad', id.name)}${S('Modelo', rb.model || r['board-name'])}${S('Versión RouterOS', r.version)}${S('Uptime', r.uptime)}${S('Arquitectura', r['architecture-name'])}${S('CPU', r.cpu)}` +
        B('Carga CPU', +r['cpu-load'], (r['cpu-count'] || 1) + ' núcleo(s) · ' + (r['cpu-frequency'] || '?') + ' MHz') +
        B('Memoria', memUsed, `${bytes(r['total-memory'] - r['free-memory'])} de ${bytes(r['total-memory'])}`) +
        B('Disco', hddUsed, `${bytes(r['total-hdd-space'] - r['free-hdd-space'])} de ${bytes(r['total-hdd-space'])}`) + S('Serie', rb['serial-number']) + '</div>';
    } catch (e) { if (!quiet) $('#view').innerHTML = `<div class="tablewrap"><div class="empty">${esc(e.message)}</div></div>`; }
  };
  $('#ref').onclick = () => refresh();
  return { refresh };
}

/* Terminal: "/ip/address/print", "/ip/address/add address=1.1.1.1/24 interface=ether1", "/system/reboot" */
function terminal() {
  $('#toolbar').innerHTML = '<h2>Terminal</h2>';
  $('#view').innerHTML = `<div class="term"><div class="termout" id="out">Escribe comandos estilo RouterOS con rutas separadas por «/».\nEj.:  /ip/address/print   ·   /interface/print   ·   /ip/address/add address=10.0.0.1/24 interface=ether2\n</div>
    <form id="tf"><input id="cmd" placeholder="/ip/address/print" autocomplete="off" autofocus><button>Ejecutar</button></form></div>`;
  const out = $('#out'); const hist = []; let hi = 0;
  const print = t => { out.textContent += t + '\n'; out.scrollTop = out.scrollHeight; };
  $('#cmd').onkeydown = e => { if (e.key === 'ArrowUp' && hist.length) { hi = Math.max(0, hi - 1); e.target.value = hist[hi]; } else if (e.key === 'ArrowDown') { hi = Math.min(hist.length, hi + 1); e.target.value = hist[hi] || ''; } };
  $('#tf').onsubmit = async e => {
    e.preventDefault(); const line = $('#cmd').value.trim(); if (!line) return;
    hist.push(line); hi = hist.length; $('#cmd').value = ''; print('> ' + line);
    const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g).map(p => p.replace(/^([^=]+)="(.*)"$/, '$1=$2').replace(/^"(.*)"$/, '$1'));
    let p = parts[0].replace(/\s+/g, ''); if (!p.startsWith('/')) p = '/' + p;
    const args = {}; parts.slice(1).forEach(a => { const i = a.indexOf('='); if (i > 0) args[a.slice(0, i)] = a.slice(i + 1); });
    try {
      let res;
      if (p.endsWith('/print')) res = await rest('GET', p.slice(0, -6));
      else res = await rest('POST', p, args);
      print(JSON.stringify(res, null, 2));
    } catch (err) { print('ERROR: ' + err.message); }
  };
  return { refresh() {} };
}

if (token) start();
