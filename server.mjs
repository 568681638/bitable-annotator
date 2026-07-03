import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import net from 'net';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, 'dist');
const PORT = process.env.PORT || 6868;

// 自动释放被占用的端口
await new Promise((resolve) => {
  const tester = net.createServer();
  tester.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      try {
        execSync(`fuser -k ${PORT}/tcp 2>/dev/null`, { timeout: 3000 });
      } catch { /* ignore */ }
      setTimeout(resolve, 500);
    } else {
      resolve();
    }
  });
  tester.once('listening', () => { tester.close(); resolve(); });
  tester.listen(PORT, '0.0.0.0');
});

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.ogg':  'video/ogg',
  '.mov':  'video/quicktime',
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
  '.flac': 'audio/flac',
  '.aac':  'audio/aac',
};

function proxyRequest(targetUrl, req, res) {
  const parsed = new URL(targetUrl);
  const client = parsed.protocol === 'https:' ? https : http;

  const options = {
    hostname: parsed.hostname,
    port: parsed.port,
    path: parsed.pathname + parsed.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: parsed.hostname,
    },
  };

  const proxyReq = client.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502);
    res.end('Proxy error: ' + err.message);
  });

  proxyReq.setTimeout(30000, () => {
    proxyReq.destroy();
    res.writeHead(504);
    res.end('Proxy timeout');
  });

  req.pipe(proxyReq);
}

createServer((req, res) => {
  // 代理所有外部 URL: /api-proxy/https%3A%2F%2Fexample.com%2Fpath
  if (req.url.startsWith('/api-proxy/')) {
    const encoded = req.url.slice('/api-proxy/'.length);
    try {
      const targetUrl = decodeURIComponent(encoded);
      return proxyRequest(targetUrl, req, res);
    } catch {
      res.writeHead(400);
      return res.end('Bad proxy URL');
    }
  }

  // 静态文件
  const cleanPath = req.url.split('?')[0].split('#')[0];
  const filePath = join(DIST, cleanPath === '/' ? 'index.html' : cleanPath);

  readFile(filePath)
    .then(data => {
      const ext = extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    })
    .catch(() => {
      // SPA fallback
      readFile(join(DIST, 'index.html'))
        .then(data => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(data); })
        .catch(() => { res.writeHead(404); res.end('Not Found'); });
    });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}/`);
});
