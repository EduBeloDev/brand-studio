import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IAFalsa } from '../ia/ia.ts';
import {
  CONSOLIDAR_A_CADA,
  adicionarPronuncia,
  calcularPreferencias,
  consolidar,
  contextoDaMarca,
  escreverPreferencias,
  lerEventos,
  lerPronuncias,
  precisaConsolidar,
  prepararMemoria,
  registrar,
} from './memoria.ts';

let raiz: string;
const ler = (rel: string) => readFile(path.join(raiz, rel), 'utf8');
const agora = new Date('2026-10-29T15:00:00');

beforeEach(async () => {
  raiz = await mkdtemp(path.join(tmpdir(), 'marca-'));
});
afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

describe('prepararMemoria', () => {
  it('cria a hierarquia de branding com notas iniciais', async () => {
    await prepararMemoria(raiz);
    for (const rel of ['branding/README.md', 'branding/objetivo.md', 'branding/identidade/visual.md', 'branding/identidade/voz-e-tom.md',
      'branding/identidade/personagem.md', 'branding/identidade/pronuncia.md', 'branding/escolhas/aprovadas.md',
      'branding/escolhas/rejeitadas.md', 'branding/aprendizados/preferencias.md', 'branding/aprendizados/perfil.md']) {
      expect((await ler(rel)).length, rel).toBeGreaterThan(0);
    }
    expect(JSON.parse(await ler('branding/marca.json'))).toEqual({ nome: 'minha marca' });
  });

  it('as notas iniciais são modelos neutros, sem a identidade de uma marca', async () => {
    await prepararMemoria(raiz);
    for (const rel of ['branding/objetivo.md', 'branding/identidade/visual.md', 'branding/identidade/voz-e-tom.md', 'branding/identidade/personagem.md']) {
      const t = await ler(rel);
      expect(t, rel).toMatch(/A preencher/);
      expect(t.length, rel).toBeLessThan(220);
    }
  });

  it('não sobrescreve nota que a pessoa editou', async () => {
    await prepararMemoria(raiz);
    await writeFile(path.join(raiz, 'branding/objetivo.md'), '# Objetivo\nMeu texto.');
    await prepararMemoria(raiz);
    expect(await ler('branding/objetivo.md')).toBe('# Objetivo\nMeu texto.');
  });
});

describe('eventos', () => {
  it('registrar guarda o evento, escreve no diário do dia e conta desde a última consolidação', async () => {
    await prepararMemoria(raiz);
    const r1 = await registrar(raiz, { tipo: 'peca-aprovada', dados: { tema: 'API' } }, agora);
    const r2 = await registrar(raiz, { tipo: 'quadro-salvo', dados: { transicoes: ['cacos'] } }, agora);
    expect(r1.total).toBe(1);
    expect(r2).toEqual({ total: 2, desdeConsolidacao: 2 });
    const eventos = await lerEventos(raiz);
    expect(eventos.map((e) => e.tipo)).toEqual(['peca-aprovada', 'quadro-salvo']);
    expect(eventos[0]!.quando).toBe(agora.toISOString());
    expect(await ler('branding/aprendizados/diario/2026-10-29.md')).toMatch(/aprovad/i);
    expect(await ler('.estudio/eventos.jsonl')).toMatch(/peca-aprovada/);
  });
});

describe('preferências', () => {
  const eventos = [
    { tipo: 'quadro-salvo', quando: '', dados: { transicoes: ['cacos', 'dissolucao'], animacoes: ['bombinha'], expressoes: ['joinha'], modelos: [] } },
    { tipo: 'quadro-salvo', quando: '', dados: { transicoes: ['dissolucao'], animacoes: [], expressoes: ['joinha', 'ideia'], modelos: ['capa'] } },
    { tipo: 'peca-aprovada', quando: '', dados: { tema: 'API' } },
    { tipo: 'peca-rejeitada', quando: '', dados: { tema: 'MCP', motivo: 'muito longo' } },
    { tipo: 'edicao-apos-ia', quando: '', dados: { campo: 'tela', antes: 'A', depois: 'B' } },
    { tipo: 'edicao-apos-ia', quando: '', dados: { campo: 'tela', antes: 'C', depois: 'D' } },
  ] as const;

  it('conta as escolhas e ordena da mais usada para a menos', () => {
    const p = calcularPreferencias(eventos as never);
    expect(p.transicoes).toEqual([['dissolucao', 2], ['cacos', 1]]);
    expect(p.expressoes[0]).toEqual(['joinha', 2]);
    expect(p.modelos).toEqual([['capa', 1]]);
    expect(p.aprovadas).toEqual(['API']);
    expect(p.rejeitadas).toEqual([{ tema: 'MCP', motivo: 'muito longo' }]);
    expect(p.camposEditados).toEqual([['tela', 2]]);
  });

  it('escreve a nota automática de preferências', async () => {
    await prepararMemoria(raiz);
    await escreverPreferencias(raiz, calcularPreferencias(eventos as never));
    const nota = await ler('branding/aprendizados/preferencias.md');
    expect(nota).toMatch(/dissolucao \(2\)/);
    expect(nota).toMatch(/muito longo/);
  });
});

describe('consolidação', () => {
  it('pede consolidação a cada N eventos e a IA reescreve só o perfil', async () => {
    await prepararMemoria(raiz);
    await writeFile(path.join(raiz, 'branding/identidade/visual.md'), '# Identidade visual\n\n- Fundo roxo.\n');
    const identidade = await ler('branding/identidade/visual.md');
    for (let i = 0; i < CONSOLIDAR_A_CADA; i++) await registrar(raiz, { tipo: 'peca-aprovada', dados: { tema: `T${i}` } }, agora);
    expect(await precisaConsolidar(raiz)).toBe(true);
    const ia = new IAFalsa(['# Perfil da marca\n\n- Prefere dissolução.']);
    const perfil = await consolidar(raiz, ia, agora);
    expect(perfil).toMatch(/Prefere dissolução/);
    expect(await ler('branding/aprendizados/perfil.md')).toMatch(/Prefere dissolução/);
    expect(await ler('branding/identidade/visual.md')).toBe(identidade);
    expect(await precisaConsolidar(raiz)).toBe(false);
    expect(ia.pedidos[0]!.prompt).toMatch(/T9/);
    expect(ia.pedidos[0]!.prompt).toMatch(/roxo/i);
  });
});

describe('contexto e pronúncia', () => {
  it('o contexto da marca junta identidade, objetivo, perfil e preferências, até o limite', async () => {
    await prepararMemoria(raiz);
    await writeFile(path.join(raiz, 'branding/identidade/visual.md'), '# Identidade visual\n\n- Fundo roxo.\n');
    const ctx = await contextoDaMarca(raiz);
    expect(ctx).toMatch(/Objetivo/i);
    expect(ctx).toMatch(/roxo/i);
    expect((await contextoDaMarca(raiz, 300)).length).toBeLessThanOrEqual(300);
  });

  it('lê e acrescenta pronúncias sem duplicar', async () => {
    await prepararMemoria(raiz);
    const inicial = await lerPronuncias(raiz);
    expect(inicial.get('MIT')).toBe('ême í tê');
    await adicionarPronuncia(raiz, 'Kubernetes', 'Kubernêtis');
    await adicionarPronuncia(raiz, 'Kubernetes', 'outra');
    const depois = await lerPronuncias(raiz);
    expect(depois.get('Kubernetes')).toBe('Kubernêtis');
  });
});
