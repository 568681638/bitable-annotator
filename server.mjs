import { createServer, request as httpRequest } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { URL } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, 'dist');
const PORT = process.env.PORT || 6868;

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
  const client = parsed.protocol === 'https:' ? https : httpRequest;

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

// 代理白名单（防止被当作开放代理滥用）
const PROXY_DOMAINS = [
  'oss-cn-shenzhen-internal.aliyuncs.com',
];

function isAllowedProxy(targetUrl) {
  return PROXY_DOMAINS.some(d => targetUrl.includes(d));
}

const server = createServer((req, res) => {
  // 代理内网 OSS URL: /api-proxy/https%3A%2F%2F...oss-cn-shenzhen-internal...%2F...
  if (req.url.startsWith('/api-proxy/')) {
    const encoded = req.url.slice('/api-proxy/'.length);
    try {
      const targetUrl = decodeURIComponent(encoded);
      if (!isAllowedProxy(targetUrl)) {
        res.writeHead(403);
        return res.end('Proxy not allowed for this domain');
      }
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
      readFile(join(DIST, 'index.html'))
        .then(data => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(data); })
        .catch(() => { res.writeHead(404); res.end('Not Found'); });
    });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}/`);
});
