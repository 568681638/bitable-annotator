import { createServer, request as httpRequest } from 'http';
import { readFile } from 'fs/promises';
import { readFileSync, readdirSync, readlinkSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import https from 'https';
import { URL } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, 'dist');
const PORT = process.env.PORT || 6868;

// 用 Node.js 原生方式找到并杀掉占用端口的进程（不需要 lsof/fuser）
function killPortPid(port) {
  try {
    // 方法1: 通过 ss 命令获取 PID
    const out = execSync(`ss -tlnp "sport = :${port}"`, { timeout: 3000, encoding: 'utf8' });
    const m = out.match(/pid=(\d+)/);
    if (m) { execSync(`kill -9 ${m[1]}`); return true; }
  } catch { /* ss not available */ }
  try {
    // 方法2: 通过 /proc/net/tcp 查找 inode，再遍历 /proc 找 PID
    const hex = port.toString(16).toUpperCase().padStart(4, '0');
    const tcp = readFileSync('/proc/net/tcp', 'utf8');
    const lines = tcp.split('\n').slice(1);
    for (const line of lines) {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 10) continue;
      const [, localPort] = cols[1].split(':');
      if (localPort === hex) {
        const inode = cols[9];
        const procs = readdirSync('/proc').filter(d => /^\d+$/.test(d));
        for (const pid of procs) {
          try {
            const fdDir = `/proc/${pid}/fd`;
            const fds = readdirSync(fdDir);
            for (const fd of fds) {
              try {
                const link = readlinkSync(`${fdDir}/${fd}`);
                if (link.includes(`socket:[${inode}]`)) {
                  execSync(`kill -9 ${pid}`);
                  return true;
                }
              } catch { /* broken symlink */ }
            }
          } catch { /* permission denied */ }
        }
        return false; // inode found but could not match to PID
      }
    }
  } catch { /* /proc not readable */ }
  return false;
}

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

// 启动服务器，端口被占自动 +1 重试（最多试10次）
function startServer(port) {
  const server = createServer((req, res) => {
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
        readFile(join(DIST, 'index.html'))
          .then(data => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(data); })
          .catch(() => { res.writeHead(404); res.end('Not Found'); });
      });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, killing...`);
      killPortPid(port);
      // 等端口释放后重试
      setTimeout(() => startServer(port), 500);
    } else {
      throw err;
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}/`);
  });
}

startServer(PORT);
