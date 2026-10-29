import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarRotasDePecas } from './pecas.ts';

let saida: string;
let base: string;
let servidor: Server;

beforeEach(async () => {
  saida = await mkdtemp(path.join(tmpdir(), 'pecas-'));
  const rotas = criarRotasDePecas(saida);
  servidor = createServer(async (req, res) => {
    const rota = new URL(req.url ?? '/', 'http://x').pathname;
    if (!(await rotas(req, res, rota))) res.writeHead(404).end();
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise((ok) => servidor.close(ok));
  await rm(saida, { recursive: true, force: true });
});

async function post(rota: string, corpo: string, tipo = 'application/json') {
  const r = await fetch(base + rota, { method: 'POST', headers: { 'Content-Type': tipo }, body: corpo });
  return { status: r.status, dados: (await r.json()) as Record<string, unknown> };
}

describe('rotas da esteira de peças', () => {
  it('cria uma peça e lista', async () => {
    const r = await post('/api/pecas', JSON.stringify({ tema: 'Promoção de verão' }));
    expect(r.status).toBe(201);
    expect(await readdir(saida)).toHaveLength(1);
    const lista = (await (await fetch(base + '/api/pecas')).json()) as unknown[];
    expect(lista).toHaveLength(1);
  });

  it('recusa tema vazio', async () => {
    const r = await post('/api/pecas', JSON.stringify({ tema: '  ' }));
    expect(r.status).toBe(400);
    expect(await readdir(saida)).toHaveLength(0);
  });

  it('recusa pedido acima de 10 KB sem criar peça', async () => {
    const r = await post('/api/pecas', JSON.stringify({ tema: 'x'.repeat(20_000) }));
    expect(r.status).toBe(400);
    expect(r.dados.erro).toMatch(/grande demais/);
    expect(await readdir(saida)).toHaveLength(0);
  });

  it('responde 400 a JSON quebrado e a pedido que não é JSON', async () => {
    expect((await post('/api/pecas', '{quebrado')).status).toBe(400);
    expect((await post('/api/pecas', 'tema=x', 'application/x-www-form-urlencoded')).status).toBe(400);
  });

  it('recusa status inválido e peça inexistente com 400', async () => {
    expect((await post('/api/pecas/qualquer/status', JSON.stringify({ status: 'publicada' }))).status).toBe(400);
    expect((await post('/api/pecas/nao-existe/status', JSON.stringify({ status: 'aprovada' }))).status).toBe(400);
  });

  it('não serve arquivo fora da pasta da peça', async () => {
    const r = await fetch(base + '/pecas/..%2F..%2Fetc/passwd');
    expect(r.status).toBe(404);
  });
});
