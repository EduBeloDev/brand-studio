import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { produzirPeca } from '../core/linha.ts';
import { listarPecas, mudarStatus } from '../core/saida.ts';
import type { StatusPeca } from '../core/tipos.ts';

/** Rotas da esteira de peças (painel antigo), mantidas para a aba Peças. Erros viram 400, como no painel antigo. */

const STATUS_VALIDOS: StatusPeca[] = ['aguardando-aprovacao', 'aprovada', 'rejeitada'];
const LIMITE = 10_000;

class ErroPedido extends Error {}

async function corpoJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  // Exigir application/json impede que outra página aberta no navegador dispare um POST às cegas.
  if (!req.headers['content-type']?.startsWith('application/json')) throw new ErroPedido('Envie JSON.');
  const partes: Buffer[] = [];
  let total = 0;
  for await (const parte of req) {
    total += (parte as Buffer).length;
    if (total > LIMITE) throw new ErroPedido('Pedido grande demais.');
    partes.push(parte as Buffer);
  }
  try {
    const d = JSON.parse(Buffer.concat(partes).toString('utf8') || '{}');
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error();
    return d as Record<string, unknown>;
  } catch {
    throw new ErroPedido('JSON inválido.');
  }
}

function json(res: ServerResponse, codigo: number, dados: unknown) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(dados));
}

async function tratar(req: IncomingMessage, res: ServerResponse, rota: string, pastaSaida: string): Promise<boolean> {
  const metodo = req.method ?? 'GET';
  if (rota === '/api/pecas' && metodo === 'GET') return json(res, 200, await listarPecas(pastaSaida)), true;
  if (rota === '/api/pecas' && metodo === 'POST') {
    const { tema } = await corpoJson(req);
    if (typeof tema !== 'string' || !tema.trim()) return json(res, 400, { erro: 'Faltou o tema.' }), true;
    return json(res, 201, await produzirPeca({ tema }, { pastaSaida })), true;
  }
  const status = rota.match(/^\/api\/pecas\/([^/]+)\/status$/);
  if (status && metodo === 'POST') {
    const { status: novo } = await corpoJson(req);
    if (!STATUS_VALIDOS.includes(novo as StatusPeca)) return json(res, 400, { erro: 'Status inválido.' }), true;
    return json(res, 200, await mudarStatus(pastaSaida, decodeURIComponent(status[1]!), novo as StatusPeca)), true;
  }
  const arquivo = rota.match(/^\/pecas\/([^/]+)\/([^/]+)$/);
  if (arquivo && metodo === 'GET') {
    const alvo = path.join(pastaSaida, path.basename(decodeURIComponent(arquivo[1]!)), path.basename(decodeURIComponent(arquivo[2]!)));
    try {
      const dados = await readFile(alvo);
      const svg = alvo.endsWith('.svg');
      // SVG de peça vem do tema digitado: o CSP impede qualquer script dentro dele.
      res.writeHead(200, { 'Content-Type': svg ? 'image/svg+xml' : 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff',
        ...(svg && { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" }) });
      res.end(dados);
    } catch {
      json(res, 404, { erro: 'Não encontrado.' });
    }
    return true;
  }
  return false;
}

export function criarRotasDePecas(pastaSaida: string) {
  return async (req: IncomingMessage, res: ServerResponse, rota: string): Promise<boolean> => {
    try {
      return await tratar(req, res, rota, pastaSaida);
    } catch (e) {
      json(res, 400, { erro: e instanceof Error ? e.message : 'Pedido inválido.' });
      return true;
    }
  };
}
