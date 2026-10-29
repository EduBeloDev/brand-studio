import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lerPronuncias, prepararMemoria } from '../branding/memoria.ts';
import { lerFrente } from '../conteudo/ligacoes.ts';
import { IAFalsa } from '../ia/ia.ts';
import { CONFIG_PADRAO, Radar, gravarDescoberta, lerSugestoes, promptRadar, validarDescoberta } from './radar.ts';

let raiz: string;
const ler = (rel: string) => readFile(path.join(raiz, rel), 'utf8');
const dia = new Date('2026-10-29T10:00:00');

const descoberta = {
  tendencias: [
    { titulo: 'Agentes de código revisando PRs', resumo: 'Times usam agentes para revisar.', porque_importa: 'Iniciantes confiam demais.',
      evidencia: 'comprovada', fontes: [{ url: 'https://exemplo.dev/agentes', titulo: 'Relatório', data: '2026-10-20' }], termos: ['PR', 'agente'] },
    { titulo: 'Sem fonte', resumo: 'x', porque_importa: 'y', evidencia: 'comprovada', fontes: [], termos: [] },
    { resumo: 'sem título' },
  ],
  jargoes: [
    { termo: 'PR', significado: 'Pull request: pedido para juntar mudanças.', exemplo: 'Abri um PR.', pronuncia: 'pê érre' },
    { termo: 'agente', significado: 'IA que executa tarefas sozinha.', exemplo: 'O agente rodou os testes.' },
    { termo: 'vazio' },
  ],
  sugestoes: [
    { titulo: 'A IA terminou. Quem revisou?', gancho: 'O agente disse pronto.', formato: 'video', pontos: ['gerar não é validar'],
      porque_agora: 'Agentes em alta.', fontes: [{ url: 'https://exemplo.dev/agentes', titulo: 'Relatório' }], termos: ['PR', 'agente'] },
  ],
};

beforeEach(async () => {
  raiz = await mkdtemp(path.join(tmpdir(), 'radar-'));
  await prepararMemoria(raiz);
});
afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

describe('prompt e validação', () => {
  it('o prompt pede assuntos novos, com fontes e datas, e lista o que já é conhecido', () => {
    const p = promptRadar(['agentes de código', 'pr'], '# Marca\nIniciantes em programação.', dia);
    expect(p.prompt).toMatch(/agentes de código/);
    expect(p.prompt).toMatch(/2026-10-29/);
    expect(p.prompt).toMatch(/Iniciantes em programação/);
    expect(p.sistema).toMatch(/JSON/);
  });

  it('descarta itens sem título ou sem significado e rebaixa tendência sem fonte para proposta', () => {
    const d = validarDescoberta(descoberta);
    expect(d.tendencias.map((t) => [t.titulo, t.evidencia])).toEqual([
      ['Agentes de código revisando PRs', 'comprovada'], ['Sem fonte', 'proposta']]);
    expect(d.jargoes.map((j) => j.termo)).toEqual(['PR', 'agente']);
    expect(d.sugestoes).toHaveLength(1);
  });
});

describe('gravarDescoberta', () => {
  it('escreve tendências, jargões e sugestões ligadas entre si, e a pronúncia vai para a marca', async () => {
    const r = await gravarDescoberta(raiz, validarDescoberta(descoberta), dia);
    expect(r.criadas).toEqual(expect.arrayContaining([
      'conhecimento/tendencias/2026-10-29-agentes-de-codigo-revisando-prs.md',
      'conhecimento/jargoes/pr.md', 'conhecimento/jargoes/agente.md',
      'conhecimento/sugestoes/a-ia-terminou-quem-revisou.md']));
    const tendencia = await ler('conhecimento/tendencias/2026-10-29-agentes-de-codigo-revisando-prs.md');
    expect(lerFrente(tendencia).dados).toMatchObject({ tipo: 'tendencia', evidencia: 'comprovada', data: '2026-10-29' });
    expect(tendencia).toMatch(/\[\[pr\]\]/);
    expect(tendencia).toMatch(/https:\/\/exemplo\.dev\/agentes/);
    const sugestao = await ler('conhecimento/sugestoes/a-ia-terminou-quem-revisou.md');
    expect(lerFrente(sugestao).dados).toMatchObject({ tipo: 'sugestao', formato: 'video', status: 'nova' });
    expect(sugestao).toMatch(/\[\[agente\]\]/);
    expect((await lerPronuncias(raiz)).get('PR')).toBe('pê érre');
  });

  it('termo com sigla entre parênteses vira duas pronúncias limpas (a narração casa a palavra inteira)', async () => {
    await gravarDescoberta(raiz, validarDescoberta({ jargoes: [
      { termo: 'pull request (PR)', significado: 'Pedido para juntar mudanças.', exemplo: 'x', pronuncia: 'púl riquést (pê érre)' }] }), dia);
    const p = await lerPronuncias(raiz);
    expect(p.get('pull request')).toBe('púl riquést');
    expect(p.get('PR')).toBe('pê érre');
    expect(p.has('pull request (PR)')).toBe(false);
  });

  it('o prompt pede a grafia normal nos textos (a pronúncia é aplicada pelo app só na voz)', () => {
    expect(promptRadar([], '', dia).prompt).toMatch(/grafia normal/);
  });

  it('jargão repetido é atualizado em vez de duplicado', async () => {
    await gravarDescoberta(raiz, validarDescoberta(descoberta), dia);
    const r = await gravarDescoberta(raiz, validarDescoberta({ jargoes: [{ termo: 'PR', significado: 'Pedido de revisão.', exemplo: 'x' }] }),
      new Date('2026-10-30T10:00:00'));
    expect(r.atualizadas).toEqual(['conhecimento/jargoes/pr.md']);
    expect(await ler('conhecimento/jargoes/pr.md')).toMatch(/2026-10-30/);
  });

  it('lista as sugestões com título, formato e status', async () => {
    await gravarDescoberta(raiz, validarDescoberta(descoberta), dia);
    expect(await lerSugestoes(raiz)).toEqual([{ caminho: 'conhecimento/sugestoes/a-ia-terminou-quem-revisou.md',
      titulo: 'A IA terminou. Quem revisou?', formato: 'video', status: 'nova', criada: '2026-10-29', origem: 'radar' }]);
  });
});

function agendador() {
  const pendentes: { fn: () => unknown; ms: number; ativo: boolean }[] = [];
  return {
    pendentes,
    agendar: (fn: () => unknown, ms: number) => {
      const p = { fn, ms, ativo: true };
      pendentes.push(p);
      return () => { p.ativo = false; };
    },
    disparar: async () => {
      const p = pendentes.filter((x) => x.ativo).pop();
      if (p) { p.ativo = false; await p.fn(); }
    },
  };
}
const resposta = (custo = 0.02) => ({ texto: JSON.stringify(descoberta), custoUsd: custo });

describe('Radar', () => {
  it('ao iniciar roda um ciclo, grava as notas e agenda o próximo', async () => {
    const ag = agendador();
    const radar = new Radar({ raiz, ia: new IAFalsa([resposta()]), relogio: () => dia, agendar: ag.agendar });
    await radar.iniciar();
    const e = radar.estado();
    expect(e).toMatchObject({ situacao: 'aguardando', ciclosNaSessao: 1, custoHoje: 0.02 });
    expect(e.ultimasDescobertas.length).toBeGreaterThan(0);
    expect(ag.pendentes.at(-1)!.ms).toBe(CONFIG_PADRAO.intervaloMin * 60_000);
  });

  it('pausar cancela o próximo ciclo; retomar roda de novo', async () => {
    const ag = agendador();
    const ia = new IAFalsa([resposta(), resposta()]);
    const radar = new Radar({ raiz, ia, relogio: () => dia, agendar: ag.agendar });
    await radar.iniciar();
    radar.pausar();
    expect(radar.estado().situacao).toBe('pausado');
    await ag.disparar();
    expect(ia.pedidos).toHaveLength(1);
    await radar.retomar();
    expect(ia.pedidos).toHaveLength(2);
    expect(radar.estado().situacao).toBe('aguardando');
  });

  it('para no limite de ciclos da sessão e no teto de custo do dia', async () => {
    const ag = agendador();
    const radar = new Radar({ raiz, ia: new IAFalsa([resposta(), resposta()]), relogio: () => dia, agendar: ag.agendar,
      config: { ...CONFIG_PADRAO, maxCiclosPorSessao: 2 } });
    await radar.iniciar();
    await ag.disparar();
    expect(radar.estado().situacao).toBe('limite');
    const caro = new Radar({ raiz, ia: new IAFalsa([resposta(5)]), relogio: () => dia, agendar: agendador().agendar });
    await caro.iniciar();
    expect(caro.estado()).toMatchObject({ situacao: 'limite' });
    expect(caro.estado().custoHoje).toBeGreaterThanOrEqual(1);
  });

  it('erro da IA fica visível e tenta de novo no próximo intervalo', async () => {
    const ag = agendador();
    const radar = new Radar({ raiz, ia: new IAFalsa([]), relogio: () => dia, agendar: ag.agendar });
    await radar.iniciar();
    expect(radar.estado().situacao).toBe('erro');
    expect(radar.estado().ultimoErro).toBeTruthy();
    expect(ag.pendentes.some((p) => p.ativo)).toBe(true);
  });

  it('ciclo manual funciona mesmo pausado, sem tirar a pausa', async () => {
    const radar = new Radar({ raiz, ia: new IAFalsa([resposta()]), relogio: () => dia, agendar: agendador().agendar });
    radar.pausar();
    await radar.cicloAgora();
    expect(radar.estado()).toMatchObject({ situacao: 'pausado', ciclosNaSessao: 1 });
  });

  it('configuração é validada e guardada; desligado ao abrir não inicia sozinho', async () => {
    const radar = new Radar({ raiz, ia: new IAFalsa([]), relogio: () => dia, agendar: agendador().agendar });
    await expect(radar.atualizarConfig({ intervaloMin: 0 })).rejects.toThrowError(/intervalo/);
    await radar.atualizarConfig({ ativoAoAbrir: false, tetoDiarioUsd: 0.5 });
    const outro = new Radar({ raiz, ia: new IAFalsa([]), relogio: () => dia, agendar: agendador().agendar });
    await outro.carregar();
    expect(outro.config()).toMatchObject({ ativoAoAbrir: false, tetoDiarioUsd: 0.5 });
    expect(await outro.iniciarSeConfigurado()).toBe(false);
    expect(outro.estado().situacao).toBe('parado');
  });

  it('o próximo ciclo já conhece o que foi aprendido', async () => {
    const ia = new IAFalsa([resposta(), resposta()]);
    const radar = new Radar({ raiz, ia, relogio: () => dia, agendar: agendador().agendar });
    await radar.cicloAgora();
    await radar.cicloAgora();
    expect(ia.pedidos[1]!.prompt).toMatch(/agentes de código revisando prs/i);
    expect(ia.pedidos[1]!.web).toBe(true);
  });
});
