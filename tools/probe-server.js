#!/usr/bin/env node
// Receives probe results POSTed by tools/probes/api-probe.html running inside
// real iCUE, and saves them next to the probe. Run this on the same Windows
// machine as iCUE, load the probe widget, then hit its "POST to localhost:9876"
// button. Use it to (re)capture the live iCUE API surface that tools/icue-mock.js
// is modelled on, when iCUE's framework version changes.
// Usage: node tools/probe-server.js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 9876;
const OUTPUT_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'probes',
  'api-probe-results.txt',
);

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/probe-results') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      fs.writeFileSync(OUTPUT_FILE, body, 'utf8');
      console.log(`\nReceived ${body.length} bytes, saved to ${OUTPUT_FILE}\n`);
      console.log(body);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Probe server on http://localhost:${PORT}`);
  console.log('Load tools/probes/api-probe.html in iCUE and POST results here.');
  console.log(`Results will be saved to ${OUTPUT_FILE}`);
});
