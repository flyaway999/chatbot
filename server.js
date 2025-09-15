// server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 3000;

// Simple static file server for index.html and style.css
const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  const fullPath = path.join(__dirname, filePath);
  const ext = path.extname(fullPath).toLowerCase();
  const map = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
  };

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain' });
    res.end(data);
  });
});

// Attach WebSocket server to the same HTTP server
const wss = new WebSocket.Server({ server });

function broadcast(data, except) {
  wss.clients.forEach((client) => {
    if (client !== except && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

wss.on('connection', (ws, req) => {
  console.log('Novo cliente conectado');

  // simple heartbeat
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (err) {
      console.error('Recebido JSON inválido:', raw);
      return;
    }

    if (msg.type === 'join') {
      ws.username = msg.name;
      console.log(`${ws.username} entrou`);
      const notice = JSON.stringify({
        type: 'system',
        text: `${ws.username} entrou no chat`,
        time: new Date().toISOString(),
      });
      broadcast(notice);
    } else if (msg.type === 'message') {
      const outgoing = JSON.stringify({
        type: 'message',
        name: ws.username || msg.name || 'Anônimo',
        text: msg.text,
        time: new Date().toISOString(),
      });
      console.log(`Mensagem de ${ws.username || 'Anônimo'}: ${msg.text}`);
      broadcast(outgoing);
    }
  });

  ws.on('close', () => {
    console.log('Cliente desconectado', ws.username || '');
    const notice = JSON.stringify({
      type: 'system',
      text: `${ws.username || 'Um usuário'} saiu do chat`,
      time: new Date().toISOString(),
    });
    broadcast(notice);
  });

  ws.on('error', (err) => {
    console.error('Erro no ws:', err);
  });
});

// Kill dead connections (heartbeat)
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});