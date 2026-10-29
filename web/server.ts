import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { produzirPeca } from '../core/linha.ts';
import { PASTA_SAIDA, listarPecas, mudarStatus } from '../core/saida.ts';
import type { StatusPeca } from '../core/tipos.ts';

/**
 * O painel web. Fino como o cli/: só traduz pedidos HTTP em chamadas ao núcleo (core/).
 * Escuta apenas em 127.0.0.1, então só este computador consegue abrir o painel.
 */

const PORTA = Number(process.env.PORT ?? 3000);
const PUBLICO = path.join(import.meta.dirname, 'public');

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

const STATUS_VALIDOS: StatusPeca[] = ['aguardando-aprovacao', 'aprovada', 'rejeitada'];

function responder(res: ServerResponse, codigo: number, corpo: string | Buffer, tipo: string): void {
  res.writeHead(codigo, { 'Content-Type': tipo, 'X-Content-Type-Options': 'nosniff' });
  res.end(corpo);
}

function json(res: ServerResponse, codigo: number, dados: unknown): void {
  responder(res, codigo, JSON.stringify(dados), 'application/json; charset=utf-8');
}

async function lerJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  // Exigir application/json impede que outra página aberta no navegador dispare um POST às cegas.
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('Envie JSON.');
  const partes: Buffer[] = [];
  let total = 0;
  for await (const parte of req) {
    total += parte.length;
    if (total > 10_000) throw new Error('Pedido grande demais.');
    partes.push(parte);
  }
  try {
    return JSON.parse(Buffer.concat(partes).toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new Error('JSON inválido.');
  }
}

/** Serve um arquivo de dentro de `base`; recusa qualquer caminho que escape dela. */
async function servirArquivo(res: ServerResponse, base: string, relativo: string): Promise<void> {
  const arquivo = path.join(base, relativo);
  if (!arquivo.startsWith(base + path.sep)) return responder(res, 404, 'Não encontrado.', TIPOS['.txt']!);
  try {
    const conteudo = await readFile(arquivo);
    // SVG de peça vem do tema digitado: o CSP impede qualquer script dentro dele.
    if (path.extname(arquivo) === '.svg') res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    responder(res, 200, conteudo, TIPOS[path.extname(arquivo)] ?? 'application/octet-stream');
  } catch {
    responder(res, 404, 'Não encontrado.', TIPOS['.txt']!);
  }
}

async function tratar(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  const metodo = req.method ?? 'GET';

  if (pathname === '/api/pecas' && metodo === 'GET') return json(res, 200, await listarPecas(PASTA_SAIDA));

  if (pathname === '/api/pecas' && metodo === 'POST') {
    const { tema } = await lerJson(req);
    if (typeof tema !== 'string') throw new Error('Faltou o tema.');
    return json(res, 201, await produzirPeca({ tema }));
  }

  const status = pathname.match(/^\/api\/pecas\/([^/]+)\/status$/);
  if (status && metodo === 'POST') {
    const { status: novo } = await lerJson(req);
    if (!STATUS_VALIDOS.includes(novo as StatusPeca)) throw new Error('Status inválido.');
    return json(res, 200, await mudarStatus(PASTA_SAIDA, decodeURIComponent(status[1]!), novo as StatusPeca));
  }

  const arquivoPeca = pathname.match(/^\/pecas\/([^/]+)\/([^/]+)$/);
  if (arquivoPeca && metodo === 'GET') {
    const id = decodeURIComponent(arquivoPeca[1]!);
    const arquivo = decodeURIComponent(arquivoPeca[2]!);
    return servirArquivo(res, path.join(PASTA_SAIDA, path.basename(id)), path.basename(arquivo));
  }

  if (metodo === 'GET') return servirArquivo(res, PUBLICO, pathname === '/' ? 'index.html' : pathname.slice(1));
  responder(res, 405, 'Método não permitido.', TIPOS['.txt']!);
}

createServer((req, res) => {
  tratar(req, res).catch((erro) => {
    json(res, 400, { erro: erro instanceof Error ? erro.message : 'Erro inesperado.' });
  });
}).listen(PORTA, '127.0.0.1', () => {
  console.log(`Painel aberto em http://localhost:${PORTA}`);
});
