import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { anexar, criarNota } from './cofre.ts';
import { extrairLigacoes, lerFrente, montarGrafo, resolverAlvo, substituirLigacoes } from './ligacoes.ts';

describe('extrairLigacoes', () => {
  it('lê [[alvo]], apelido, seção e anexos embutidos', () => {
    const texto = 'Veja [[API]], [[Docs/Guia|o guia]], [[MCP#Resumo]] e ![[foto.png]].';
    expect(extrairLigacoes(texto)).toEqual([
      { alvo: 'API', embutida: false },
      { alvo: 'Docs/Guia', embutida: false, apelido: 'o guia' },
      { alvo: 'MCP', embutida: false, secao: 'Resumo' },
      { alvo: 'foto.png', embutida: true },
    ]);
  });

  it('ignora ligações dentro de código', () => {
    const texto = 'Fora [[A]]\n```\n[[B]]\n```\nE `[[C]]` também.';
    expect(extrairLigacoes(texto).map((l) => l.alvo)).toEqual(['A']);
  });
});

describe('resolverAlvo', () => {
  const caminhos = ['ideias/api/roteiro.md', 'kit/README.md', 'branding/perfil.md', 'ideias/api/foto.png', 'Roteiro.md'];

  it('acha pelo nome, sem diferenciar maiúsculas, preferindo o caminho mais curto', () => {
    expect(resolverAlvo('perfil', caminhos)).toBe('branding/perfil.md');
    expect(resolverAlvo('ROTEIRO', caminhos)).toBe('Roteiro.md');
    expect(resolverAlvo('foto.png', caminhos)).toBe('ideias/api/foto.png');
  });

  it('acha pelo caminho quando a ligação tem pasta', () => {
    expect(resolverAlvo('ideias/api/roteiro', caminhos)).toBe('ideias/api/roteiro.md');
  });

  it('devolve null quando a nota ainda não existe', () => {
    expect(resolverAlvo('inexistente', caminhos)).toBeNull();
  });
});

describe('substituirLigacoes', () => {
  it('troca o alvo mantendo apelido, seção e anexo embutido', () => {
    const texto = '[[api]] [[Api|x]] [[api#s]] ![[api]] [[apis]]';
    expect(substituirLigacoes(texto, 'api', 'balcao')).toBe('[[balcao]] [[balcao|x]] [[balcao#s]] ![[balcao]] [[apis]]');
  });
});

describe('lerFrente', () => {
  it('lê o cabeçalho entre --- e devolve o corpo', () => {
    const { dados, corpo } = lerFrente('---\ntipo: sugestao\nformato: video\n---\n# Título\ntexto');
    expect(dados).toEqual({ tipo: 'sugestao', formato: 'video' });
    expect(corpo).toBe('# Título\ntexto');
  });

  it('sem cabeçalho, devolve o texto inteiro', () => {
    expect(lerFrente('# Só texto')).toEqual({ dados: {}, corpo: '# Só texto' });
  });
});

describe('montarGrafo', () => {
  let raiz: string;
  beforeEach(async () => {
    raiz = await mkdtemp(path.join(tmpdir(), 'grafo-'));
  });
  afterEach(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  it('liga notas, anexos usados, quadros e ligações pendentes, agrupando pela primeira pasta', async () => {
    await criarNota(raiz, 'ideias/api', 'Fala de [[jargao]] e [[futuro]]. ![[foto.png]] [[api]]');
    await criarNota(raiz, 'conhecimento/jargao', 'Volta para [[api]].');
    await anexar(raiz, 'ideias', 'foto.png', new Uint8Array([1]));
    await anexar(raiz, 'ideias', 'solto.png', new Uint8Array([1]));
    await writeFile(path.join(raiz, 'ideias/q.quadro.json'), JSON.stringify({ versao: 1, tipo: 'video', nome: 'Q',
      instrucoes: '', legenda: false, conexoes: [], fontes: [{ caminho: 'ideias/api.md', ativo: true }, { caminho: 'conhecimento/jargao.md', ativo: false }],
      cartoes: [{ id: 'c', tipo: 'fala', x: 0, y: 0, instrucoes: '', campos: {}, anexos: ['ideias/foto.png'] }] }));
    const g = await montarGrafo(raiz);
    const ids = g.nos.map((n) => n.id).sort();
    expect(ids).toEqual(['conhecimento/jargao.md', 'ideias/api.md', 'ideias/foto.png', 'ideias/q.quadro.json', 'pendente:futuro']);
    expect(g.nos.find((n) => n.id === 'ideias/api.md')).toMatchObject({ nome: 'api', tipo: 'nota', grupo: 'ideias' });
    expect(g.nos.find((n) => n.id === 'pendente:futuro')).toMatchObject({ tipo: 'pendente', nome: 'futuro' });
    const arestas = g.arestas.map((a) => `${a.de}>${a.para}`).sort();
    expect(arestas).toEqual([
      'conhecimento/jargao.md>ideias/api.md',
      'ideias/api.md>conhecimento/jargao.md',
      'ideias/api.md>ideias/foto.png',
      'ideias/api.md>pendente:futuro',
      'ideias/q.quadro.json>ideias/api.md',
      'ideias/q.quadro.json>ideias/foto.png',
    ]);
  });
});
