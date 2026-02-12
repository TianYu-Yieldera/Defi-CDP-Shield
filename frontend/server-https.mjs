// HTTPS 代理服务器 - 用于手机测试（麦克风需要 HTTPS）
// 用法: node server-https.mjs
// 将 https://0.0.0.0:3001 代理到 http://localhost:3000

import { createServer } from 'https';
import { readFileSync } from 'fs';
import httpProxy from 'http-proxy';

const proxy = httpProxy.createProxyServer({
  target: 'http://localhost:3000',
  ws: true,
});

const server = createServer(
  {
    key: readFileSync('./certificates/localhost-key.pem'),
    cert: readFileSync('./certificates/localhost.pem'),
  },
  (req, res) => {
    proxy.web(req, res);
  }
);

server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head);
});

server.listen(3001, '0.0.0.0', () => {
  console.log('');
  console.log('✅ HTTPS proxy running!');
  console.log('');
  console.log('  📱 手机访问: https://192.168.101.24:3001/demo');
  console.log('  💻 电脑访问: http://localhost:3000/demo');
  console.log('');
  console.log('  ⚠️  手机首次打开会提示证书不安全，点 "继续访问" 即可');
  console.log('');
});
