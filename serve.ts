// A tiny static server for app/ (Node 22, standard library only), so
// the entry can be tried locally without a build step:
//   node serve.ts            # serves app/ on http://localhost:8080
//   node serve.ts --port 8090
// It sends the MIME types an offline web app needs, refuses any path
// outside app/, and otherwise does nothing clever. A development
// convenience, not a web server for the internet.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(fileURLToPath(new URL('./app', import.meta.url)));

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
  ['.woff', 'font/woff'],
  ['.ttf', 'font/ttf'],
  ['.otf', 'font/otf'],
  ['.bin', 'application/octet-stream'],
  ['.wasm', 'application/wasm'],
  ['.wav', 'audio/wav'],
  ['.mp3', 'audio/mpeg'],
  ['.ogg', 'audio/ogg'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function pickPort(argv) {
  const at = argv.indexOf('--port');
  const wanted = at === -1 ? 8080 : Number(argv[at + 1]);
  return Number.isInteger(wanted) && wanted > 0 && wanted < 65536 ? wanted : 8080;
}

function resolveFile(requestPath) {
  let pathname = requestPath;
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(appRoot, normalize(pathname)));
  if (file !== appRoot && !file.startsWith(appRoot + sep)) return null;
  try {
    if (!statSync(file).isFile()) return null;
  } catch {
    return null;
  }
  return file;
}

function handle(request, response) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('bad request');
    return;
  }
  const file = resolveFile(pathname);
  if (!file) {
    response.writeHead(404).end('not found');
    return;
  }
  const size = statSync(file).size;
  const headers = {
    'content-type': mimeTypes.get(extname(file).toLowerCase()) ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store',
  };
  if (request.method === 'HEAD') {
    response.writeHead(200, headers).end();
    return;
  }
  response.writeHead(200, headers);
  createReadStream(file).pipe(response);
}

const port = pickPort(process.argv.slice(2));
createServer(handle).listen(port, '127.0.0.1', () => {
  console.log(`app/ is on http://localhost:${port}`);
});
