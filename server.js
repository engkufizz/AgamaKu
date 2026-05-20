const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Normalize URL to prevent directory traversal
  let safeUrl = req.url.split('?')[0];
  let filePath = path.join(__dirname, safeUrl === '/' ? 'index.html' : safeUrl);
  
  // Security check: ensure path is within current directory
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/html' });
    res.end('<h1>403 Forbidden</h1>', 'utf-8');
    return;
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code} ..\n`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Query system network interfaces for local IPv4 addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (let k in interfaces) {
    for (let k2 in interfaces[k]) {
      let address = interfaces[k][k2];
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }
  return addresses;
}

let currentPort = PORT;

function startServer(port) {
  server.listen(port, '0.0.0.0', () => {
    console.log('\n=============================================================');
    console.log('🕌  AgamaKu Local Development Server Active! 🕌');
    console.log('=============================================================');
    console.log(`\n💻 Local Address (Desktop): http://localhost:${port}`);
    
    const ips = getLocalIPs();
    if (ips.length > 0) {
      console.log('\n📱 Open this URL on your PHONE (must be on the same Wi-Fi):');
      ips.forEach(ip => {
        console.log(`👉 http://${ip}:${port}`);
      });
    } else {
      console.log('\n⚠️ No external network interface found. Ensure Wi-Fi is connected.');
    }
    console.log('\n=============================================================');
    console.log('Press Ctrl+C in this terminal window to stop the server.\n');
  });
}

server.on('error', (err) => {
  if (err.code === 'EACCES' || err.code === 'EADDRINUSE') {
    console.log(`\n⚠️ Port ${currentPort} is restricted or in use. Trying port ${currentPort + 1}...`);
    currentPort++;
    startServer(currentPort);
  } else {
    console.error('\n❌ Server error:', err);
  }
});

startServer(currentPort);
