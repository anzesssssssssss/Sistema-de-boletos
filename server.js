const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'sync.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ eventos: [], compradores: [] }, null, 2));
  }
}

function loadState() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    return { eventos: [], compradores: [] };
  }
}

function saveState(state) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function normalizarEventos(lista) {
  return Array.isArray(lista)
    ? lista.map(item => String(item).trim()).filter(Boolean).filter((item, index, arr) => arr.indexOf(item) === index)
    : [];
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Accept'
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        resolve({ raw: body });
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const state = loadState();

  if (req.method === 'GET') {
    const accion = url.searchParams.get('accion') || url.searchParams.get('tipo') || url.searchParams.get('action');
    if (accion === 'eventos' || url.pathname === '/events') {
      sendJson(res, 200, { eventos: normalizarEventos(state.eventos) });
      return;
    }
    sendJson(res, 200, { ok: true, eventos: normalizarEventos(state.eventos), compradores: state.compradores || [] });
    return;
  }

  if (req.method === 'POST') {
    const payload = await parseBody(req);

    if (payload && payload.tipo === 'evento' && payload.evento) {
      const evento = String(payload.evento).trim();
      if (evento) {
        state.eventos = normalizarEventos([...state.eventos, evento]);
        saveState(state);
        sendJson(res, 200, { ok: true, eventos: normalizarEventos(state.eventos) });
        return;
      }
    }

    if (payload && payload.tipo === 'comprador') {
      state.compradores = state.compradores || [];
      state.compradores.push({
        fecha: payload.fecha || new Date().toLocaleString(),
        evento: payload.evento || 'Evento',
        nombre: payload.nombre || 'Sin nombre',
        cantidad: Number(payload.cantidad) || 1
      });
      saveState(state);
      sendJson(res, 200, { ok: true, compradores: state.compradores });
      return;
    }

    sendJson(res, 200, { ok: true, received: payload });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
});

server.listen(PORT, () => {
  console.log(`Servidor de sincronización listo en http://localhost:${PORT}`);
});
