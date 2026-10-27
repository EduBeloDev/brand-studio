import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { produzirPeca } from './linha.ts';
import { listarPecas, mudarStatus } from './saida.ts';

let pastaSaida: string;
const agora = new Date(2026, 9, 23, 15, 30, 0);

beforeEach(async () => {
  pastaSaida = await mkdtemp(path.join(tmpdir(), 'brand-studio-'));
});

afterEach(async () => {
  await rm(pastaSaida, { recursive: true, force: true });
});

describe('linha de montagem', () => {
  it('gera uma peça completa, aguardando aprovação', async () => {
    const peca = await produzirPeca({ tema: '  Promoção de Verão!  ' }, { pastaSaida, agora });

    expect(peca.id).toBe('2026-10-23-153000-promocao-de-verao');
    expect(peca.status).toBe('aguardando-aprovacao');
    expect(peca.pedido.tema).toBe('Promoção de Verão!');
    expect(peca.avisos).toEqual([]);

    const pasta = path.join(pastaSaida, peca.id);
    expect(JSON.parse(await readFile(path.join(pasta, 'peca.json'), 'utf8'))).toEqual(peca);
    expect(await readFile(path.join(pasta, 'legenda.txt'), 'utf8')).toContain('Promoção de Verão!');
    expect(await readFile(path.join(pasta, 'visual.svg'), 'utf8')).toContain('<svg');
  });

  it('recusa pedido sem tema', async () => {
    await expect(produzirPeca({ tema: '   ' }, { pastaSaida, agora })).rejects.toThrow('tema');
  });

  it('não sobrescreve peça com o mesmo tema no mesmo segundo', async () => {
    const primeira = await produzirPeca({ tema: 'Natal' }, { pastaSaida, agora });
    const segunda = await produzirPeca({ tema: 'Natal' }, { pastaSaida, agora });
    expect(segunda.id).toBe(`${primeira.id}-2`);
  });

  it('escapa caracteres do tema que quebrariam o SVG', async () => {
    const peca = await produzirPeca({ tema: 'Café & <bolo>' }, { pastaSaida, agora });
    const svg = await readFile(path.join(pastaSaida, peca.id, 'visual.svg'), 'utf8');
    expect(svg).toContain('Café &amp; &lt;bolo&gt;');
  });
});

describe('revisão', () => {
  it('aprovar muda o status e grava no peca.json', async () => {
    const peca = await produzirPeca({ tema: 'Lançamento' }, { pastaSaida, agora });
    await mudarStatus(pastaSaida, peca.id, 'aprovada');

    const [salva] = await listarPecas(pastaSaida);
    expect(salva?.status).toBe('aprovada');
  });

  it('lista vazia quando nada foi gerado ainda', async () => {
    expect(await listarPecas(path.join(pastaSaida, 'nao-existe'))).toEqual([]);
  });

  it('recusa id que não é só um nome de pasta', async () => {
    await expect(mudarStatus(pastaSaida, '../fora', 'aprovada')).rejects.toThrow('inválido');
  });

  it('avisa quando a peça não existe', async () => {
    await expect(mudarStatus(pastaSaida, 'nao-existe', 'aprovada')).rejects.toThrow('não encontrada');
  });
});
