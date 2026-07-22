import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

PORT = int(os.environ.get('PORT', '3000'))
DATA_DIR = Path(__file__).resolve().parent / 'data'
DATA_FILE = DATA_DIR / 'sync.json'


def ensure_data_file():
    DATA_DIR.mkdir(exist_ok=True)
    if not DATA_FILE.exists():
        DATA_FILE.write_text(json.dumps({'eventos': [], 'compradores': []}, ensure_ascii=False, indent=2), encoding='utf-8')


def load_state():
    ensure_data_file()
    try:
        return json.loads(DATA_FILE.read_text(encoding='utf-8'))
    except Exception:
        return {'eventos': [], 'compradores': []}


def save_state(state):
    ensure_data_file()
    DATA_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')


def normalizar_eventos(lista):
    if not isinstance(lista, list):
        return []
    return list(dict.fromkeys([str(item).strip() for item in lista if str(item).strip()]))


class Handler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type,Accept')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_GET(self):
        state = load_state()
        self._set_headers(200)
        body = json.dumps({'ok': True, 'eventos': normalizar_eventos(state.get('eventos', [])), 'compradores': state.get('compradores', [])}).encode('utf-8')
        self.wfile.write(body)

    def do_POST(self):
        length = int(self.headers.get('Content-Length', '0'))
        raw = self.rfile.read(length).decode('utf-8') if length else ''
        try:
            payload = json.loads(raw) if raw else {}
        except Exception:
            payload = {'raw': raw}

        state = load_state()
        if payload.get('tipo') == 'evento' and payload.get('evento'):
            evento = str(payload['evento']).strip()
            if evento:
                state['eventos'] = normalizar_eventos(state.get('eventos', []) + [evento])
                save_state(state)
                self._set_headers(200)
                self.wfile.write(json.dumps({'ok': True, 'eventos': state['eventos']}).encode('utf-8'))
                return

        if payload.get('tipo') == 'comprador':
            state.setdefault('compradores', []).append({
                'fecha': payload.get('fecha') or 'Ahora',
                'evento': payload.get('evento') or 'Evento',
                'nombre': payload.get('nombre') or 'Sin nombre',
                'cantidad': int(payload.get('cantidad') or 1)
            })
            save_state(state)
            self._set_headers(200)
            self.wfile.write(json.dumps({'ok': True, 'compradores': state['compradores']}).encode('utf-8'))
            return

        self._set_headers(200)
        self.wfile.write(json.dumps({'ok': True, 'received': payload}).encode('utf-8'))


if __name__ == '__main__':
    httpd = HTTPServer(('0.0.0.0', PORT), Handler)
    print(f'Servidor de sincronización listo en http://localhost:{PORT}')
    httpd.serve_forever()
