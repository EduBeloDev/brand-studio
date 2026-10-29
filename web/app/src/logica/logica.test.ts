import { describe, expect, it } from 'vitest';
import type { Item } from '../../../../core/conteudo/cofre.ts';
import { novoQuadro } from '../../../../core/quadro/quadro.ts';
import { achatar, ancestrais, filtrar, pastaDe } from './arvore.ts';
import { PALETA, filtrarGrupos, prepararGrafo, vizinhos } from './grafo.ts';
import { posicaoLivre, reduzir } from './quadro.ts';
import { alternar, estaSelecionado, raizesDaSelecao, selecionarIntervalo } from './selecao.ts';

const arvore: Item[] = [
  { nome: 'branding', caminho: 'branding', tipo: 'pasta', filhos: [{ nome: 'perfil.md', caminho: 'branding/perfil.md', tipo: 'nota' }] },
  { nome: 'ideias', caminho: 'ideias', tipo: 'pasta', filhos: [
    { nome: 'api', caminho: 'ideias/api', tipo: 'pasta', filhos: [{ nome: 'Roteiro Ação.md', caminho: 'ideias/api/Roteiro Ação.md', tipo: 'nota' }] },
    { nome: 'video.quadro.json', caminho: 'ideias/video.quadro.json', tipo: 'quadro' }] },
];

describe('seleção', () => {
  it('alterna itens e reconhece filhos de pasta selecionada', () => {
    let s = alternar(new Set(), 'ideias');
    expect(estaSelecionado(s, 'ideias/api/Roteiro Ação.md')).toBe(true);
    s = alternar(s, 'ideias');
    expect(s.size).toBe(0);
  });

  it('shift seleciona o intervalo na ordem da lista', () => {
    const lista = ['a', 'b', 'c', 'd'];
    expect([...selecionarIntervalo(new Set(['a']), lista, 'b', 'd')].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ações em lote usam só as raízes (filho de pasta selecionada sai)', () => {
    expect(raizesDaSelecao(new Set(['ideias/api/x.md', 'ideias', 'branding/perfil.md']))).toEqual(['branding/perfil.md', 'ideias']);
  });
});

describe('árvore', () => {
  it('achata em profundidade com o nível', () => {
    expect(achatar(arvore).map((i) => `${i.nivel}:${i.nome}`)).toEqual(
      ['0:branding', '1:perfil.md', '0:ideias', '1:api', '2:Roteiro Ação.md', '1:video.quadro.json']);
  });

  it('filtra sem acento nem maiúscula, mantendo as pastas do caminho', () => {
    const r = filtrar(arvore, 'acao');
    expect(achatar(r).map((i) => i.nome)).toEqual(['ideias', 'api', 'Roteiro Ação.md']);
    expect(filtrar(arvore, '')).toBe(arvore);
  });

  it('ancestrais e pasta de um caminho', () => {
    expect(ancestrais('a/b/c.md')).toEqual(['a', 'a/b']);
    expect(pastaDe('a/b/c.md')).toBe('a/b');
    expect(pastaDe('c.md')).toBe('');
  });
});

describe('edição do quadro', () => {
  it('adiciona cartões em posição livre à direita e edita campos e instruções', () => {
    let q = novoQuadro('video', 'V');
    q = reduzir(q, { tipo: 'adicionar', cartao: 'fala' });
    q = reduzir(q, { tipo: 'adicionar', cartao: 'fala' });
    expect(q.cartoes[1]!.x).toBeGreaterThan(q.cartoes[0]!.x);
    expect(posicaoLivre(q).x).toBeGreaterThan(q.cartoes[1]!.x);
    const id = q.cartoes[0]!.id;
    q = reduzir(q, { tipo: 'campo', id, chave: 'fala', valor: 'Oi' });
    q = reduzir(q, { tipo: 'instrucoes', id, valor: 'Abrir forte' });
    expect(q.cartoes[0]).toMatchObject({ campos: { fala: 'Oi' }, instrucoes: 'Abrir forte' });
  });

  it('recusa cartão que não cabe no tipo de quadro', () => {
    const q = reduzir(novoQuadro('carrossel', 'C'), { tipo: 'adicionar', cartao: 'fala' });
    expect(q.cartoes).toHaveLength(0);
  });

  it('liga, desliga, move, remove e marca o que veio da IA', () => {
    let q = reduzir(reduzir(novoQuadro('video', 'V'), { tipo: 'adicionar', cartao: 'fala' }), { tipo: 'adicionar', cartao: 'transicao' });
    const [a, t] = q.cartoes.map((c) => c.id);
    q = reduzir(q, { tipo: 'conectar', de: a!, para: t! });
    expect(q.conexoes).toHaveLength(1);
    q = reduzir(q, { tipo: 'mover', id: a!, x: 50, y: 60 });
    expect(q.cartoes[0]).toMatchObject({ x: 50, y: 60 });
    q = reduzir(q, { tipo: 'gerado', id: a!, campos: { fala: 'IA', tela: 'IA' } });
    expect(q.cartoes[0]!.geradoPorIA).toEqual(['fala', 'tela']);
    q = reduzir(q, { tipo: 'desconectar', id: q.conexoes[0]!.id });
    q = reduzir(q, { tipo: 'remover', id: t! });
    expect(q.cartoes).toHaveLength(1);
  });

  it('liga e desliga fontes e edita os dados do quadro', () => {
    let q = reduzir(novoQuadro('video', 'V'), { tipo: 'fonte', caminho: 'ideias/api.md' });
    expect(q.fontes).toEqual([{ caminho: 'ideias/api.md', ativo: true }]);
    q = reduzir(q, { tipo: 'fonte', caminho: 'ideias/api.md', ativo: false });
    expect(q.fontes[0]!.ativo).toBe(false);
    q = reduzir(q, { tipo: 'tirar-fonte', caminho: 'ideias/api.md' });
    q = reduzir(q, { tipo: 'quadro', campo: 'legenda', valor: true });
    expect(q).toMatchObject({ fontes: [], legenda: true });
  });
});

describe('grafo', () => {
  const dados = { nos: [{ id: 'a.md', nome: 'a', tipo: 'nota' as const, grupo: 'ideias' }, { id: 'b.md', nome: 'b', tipo: 'nota' as const, grupo: 'branding' },
    { id: 'c.md', nome: 'c', tipo: 'nota' as const, grupo: 'ideias' }], arestas: [{ de: 'a.md', para: 'b.md' }, { de: 'c.md', para: 'a.md' }] };

  it('calcula grau, tamanho e cor estável por grupo', () => {
    const g = prepararGrafo(dados);
    const a = g.nos.find((n) => n.id === 'a.md')!;
    expect(a.grau).toBe(2);
    expect(a.raio).toBeGreaterThan(g.nos.find((n) => n.id === 'b.md')!.raio);
    expect(a.cor).toBe(g.nos.find((n) => n.id === 'c.md')!.cor);
    expect(PALETA).toContain(a.cor);
  });

  it('vizinhos e filtro por grupo', () => {
    expect([...vizinhos(dados.arestas, 'a.md')].sort()).toEqual(['b.md', 'c.md']);
    const f = filtrarGrupos(dados, new Set(['ideias']));
    expect(f.nos.map((n) => n.id)).toEqual(['a.md', 'c.md']);
    expect(f.arestas).toEqual([{ de: 'c.md', para: 'a.md' }]);
  });
});
