import { describe, expect, it } from 'vitest';
import {
  CATALOGO,
  ErroQuadro,
  cartoesPermitidos,
  conectar,
  desconectar,
  escolhasDoQuadro,
  lerQuadro,
  novoCartao,
  novoQuadro,
  ordenarCarrossel,
  ordenarVideo,
  posicionarEmLinha,
  removerCartao,
  serializar,
  type Cartao,
  type Quadro,
} from './quadro.ts';

function fala(id: string, x = 0, texto = `fala ${id}`): Cartao {
  return { ...novoCartao('fala', x, 0, { fala: texto }), id };
}
function cartao(id: string, tipo: 'transicao' | 'animacao' | 'slide', campos: Record<string, string> = {}, x = 0): Cartao {
  return { ...novoCartao(tipo, x, 0, campos), id };
}
function quadro(tipo: 'video' | 'carrossel', cartoes: Cartao[], ligacoes: [string, string][] = []): Quadro {
  let q: Quadro = { ...novoQuadro(tipo, 'Teste'), cartoes };
  for (const [de, para] of ligacoes) q = conectar(q, de, para);
  return q;
}

describe('criação e leitura', () => {
  it('novo quadro vem vazio, com versão e legenda desligada', () => {
    expect(novoQuadro('video', 'Q')).toEqual({ versao: 1, tipo: 'video', nome: 'Q', instrucoes: '', legenda: false,
      cartoes: [], conexoes: [], fontes: [] });
  });

  it('cartão novo tem id próprio, instruções vazias e anexos', () => {
    const a = novoCartao('fala', 10, 20);
    const b = novoCartao('fala', 10, 20);
    expect(a.id).not.toBe(b.id);
    expect(a).toMatchObject({ tipo: 'fala', x: 10, y: 20, instrucoes: '', campos: {}, anexos: [] });
  });

  it('cada tipo de quadro aceita seus cartões', () => {
    expect(cartoesPermitidos('video')).toEqual(['fala', 'transicao', 'animacao']);
    expect(cartoesPermitidos('carrossel')).toEqual(['slide']);
  });

  it('lê JSON antigo preenchendo o que falta e devolve igual ao serializar', () => {
    const q = lerQuadro(JSON.stringify({ versao: 1, tipo: 'video', nome: 'X', cartoes: [{ id: 'a', tipo: 'fala', x: 1, y: 2 }] }));
    expect(q.cartoes[0]).toMatchObject({ instrucoes: '', campos: {}, anexos: [] });
    expect(q.fontes).toEqual([]);
    expect(lerQuadro(serializar(q))).toEqual(q);
  });

  it('recusa JSON quebrado, tipo desconhecido, cartão fora do tipo e ids repetidos', () => {
    expect(() => lerQuadro('{oi')).toThrowError(ErroQuadro);
    expect(() => lerQuadro(JSON.stringify({ versao: 1, tipo: 'podcast', nome: 'X' }))).toThrowError(ErroQuadro);
    expect(() => lerQuadro(JSON.stringify({ versao: 1, tipo: 'carrossel', nome: 'X', cartoes: [{ id: 'a', tipo: 'fala', x: 0, y: 0 }] })))
      .toThrowError(/carrossel/);
    expect(() => lerQuadro(JSON.stringify({ versao: 1, tipo: 'video', nome: 'X',
      cartoes: [{ id: 'a', tipo: 'fala', x: 0, y: 0 }, { id: 'a', tipo: 'fala', x: 0, y: 0 }] }))).toThrowError(/repetido/);
  });
});

describe('ligações', () => {
  it('conectar não duplica e não liga um cartão a ele mesmo nem a cartão inexistente', () => {
    let q = quadro('video', [fala('a'), fala('b')]);
    q = conectar(q, 'a', 'b');
    q = conectar(q, 'a', 'b');
    expect(q.conexoes).toHaveLength(1);
    expect(() => conectar(q, 'a', 'a')).toThrowError(ErroQuadro);
    expect(() => conectar(q, 'a', 'zz')).toThrowError(ErroQuadro);
  });

  it('desconectar e remover cartão tiram as ligações', () => {
    let q = quadro('video', [fala('a'), fala('b'), fala('c')], [['a', 'b'], ['b', 'c']]);
    q = desconectar(q, q.conexoes[0]!.id);
    expect(q.conexoes).toHaveLength(1);
    q = removerCartao(q, 'c');
    expect(q.cartoes.map((c) => c.id)).toEqual(['a', 'b']);
    expect(q.conexoes).toHaveLength(0);
  });
});

describe('ordem do vídeo', () => {
  it('falas formam a linha; transição e animação ficam presas à fala', () => {
    const q = quadro('video', [fala('a'), fala('b'), fala('c'), cartao('t', 'transicao', { efeito: 'glitch' }),
      cartao('n1', 'animacao', { efeito: 'bombinha' }), cartao('n2', 'animacao', { efeito: 'som', detalhe: 'ding' })],
      [['a', 'b'], ['b', 'c'], ['a', 't'], ['b', 'n1'], ['n1', 'n2']]);
    const { cenas, problemas } = ordenarVideo(q);
    expect(problemas).toEqual([]);
    expect(cenas.map((c) => c.fala.id)).toEqual(['a', 'b', 'c']);
    expect(cenas[0]!.transicao?.id).toBe('t');
    expect(cenas[1]!.animacoes.map((c) => c.id)).toEqual(['n1', 'n2']);
  });

  it('transição entre duas falas vira a transição de saída da primeira', () => {
    const q = quadro('video', [fala('a'), fala('b'), cartao('t', 'transicao', { efeito: 'cacos' })], [['a', 't'], ['t', 'b']]);
    const { cenas, problemas } = ordenarVideo(q);
    expect(problemas).toEqual([]);
    expect(cenas.map((c) => c.fala.id)).toEqual(['a', 'b']);
    expect(cenas[0]!.transicao?.id).toBe('t');
  });

  it('bifurcação, ciclo e dois começos são erros', () => {
    expect(ordenarVideo(quadro('video', [fala('a'), fala('b'), fala('c')], [['a', 'b'], ['a', 'c']])).problemas[0])
      .toMatchObject({ nivel: 'erro', cartoes: ['a'] });
    expect(ordenarVideo(quadro('video', [fala('a'), fala('b')], [['a', 'b'], ['b', 'a']])).problemas[0]!.mensagem).toMatch(/ciclo/);
    expect(ordenarVideo(quadro('video', [fala('a'), fala('b'), fala('c'), fala('d')], [['a', 'b'], ['c', 'd']])).problemas[0]!.mensagem)
      .toMatch(/começ/);
  });

  it('cartão solto e fala solta viram avisos, sem travar', () => {
    const q = quadro('video', [fala('a'), fala('b'), fala('solta', 500), cartao('n', 'animacao', { efeito: 'som' })], [['a', 'b']]);
    const { cenas, problemas } = ordenarVideo(q);
    expect(cenas.map((c) => c.fala.id)).toEqual(['a', 'b']);
    expect(problemas.every((p) => p.nivel === 'aviso')).toBe(true);
    expect(problemas.flatMap((p) => p.cartoes).sort()).toEqual(['n', 'solta']);
  });

  it('sem nenhuma ligação, segue a posição e prende cada cartão à fala à esquerda', () => {
    const q = quadro('video', [fala('b', 400), fala('a', 0), cartao('t', 'transicao', { efeito: 'zoom' }, 100), cartao('n', 'animacao', { efeito: 'som' }, 450)]);
    const { cenas, problemas } = ordenarVideo(q);
    expect(cenas.map((c) => c.fala.id)).toEqual(['a', 'b']);
    expect(cenas[0]!.transicao?.id).toBe('t');
    expect(cenas[1]!.animacoes.map((c) => c.id)).toEqual(['n']);
    expect(problemas).toEqual([{ nivel: 'aviso', mensagem: expect.stringMatching(/posição/), cartoes: [] }]);
  });

  it('avisa quadro vazio, fala sem texto e duas transições na mesma fala', () => {
    expect(ordenarVideo(novoQuadro('video', 'V')).problemas[0]!.mensagem).toMatch(/fala/);
    const q = quadro('video', [fala('a', 0, ''), cartao('t1', 'transicao', { efeito: 'zoom' }), cartao('t2', 'transicao', { efeito: 'glitch' })],
      [['a', 't1'], ['a', 't2']]);
    const { cenas, problemas } = ordenarVideo(q);
    expect(cenas[0]!.transicao?.id).toBe('t1');
    expect(problemas.map((p) => p.mensagem).join(' ')).toMatch(/sem texto/);
    expect(problemas.map((p) => p.mensagem).join(' ')).toMatch(/transição/);
  });
});

describe('ordem do carrossel', () => {
  it('segue as ligações entre slides', () => {
    const q = quadro('carrossel', [cartao('s2', 'slide'), cartao('s1', 'slide'), cartao('s3', 'slide')], [['s1', 's2'], ['s2', 's3']]);
    expect(ordenarCarrossel(q)).toEqual({ slides: expect.any(Array), problemas: [] });
    expect(ordenarCarrossel(q).slides.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
  });

  it('sem ligações, segue a posição com aviso', () => {
    const q = quadro('carrossel', [cartao('b', 'slide', {}, 300), cartao('a', 'slide', {}, 0)]);
    const r = ordenarCarrossel(q);
    expect(r.slides.map((s) => s.id)).toEqual(['a', 'b']);
    expect(r.problemas[0]!.nivel).toBe('aviso');
  });

  it('mais de 10 slides, ciclo ou bifurcação são erros', () => {
    const muitos = Array.from({ length: 11 }, (_, i) => cartao(`s${i}`, 'slide', {}, i * 10));
    expect(ordenarCarrossel(quadro('carrossel', muitos)).problemas.some((p) => p.nivel === 'erro' && /10/.test(p.mensagem))).toBe(true);
    expect(ordenarCarrossel(quadro('carrossel', [cartao('a', 'slide'), cartao('b', 'slide')], [['a', 'b'], ['b', 'a']])).problemas[0]!.nivel)
      .toBe('erro');
    expect(ordenarCarrossel(quadro('carrossel', [cartao('a', 'slide'), cartao('b', 'slide'), cartao('c', 'slide')], [['a', 'b'], ['a', 'c']]))
      .problemas[0]!.nivel).toBe('erro');
  });
});

describe('escolhas e catálogo', () => {
  it('reúne as escolhas do quadro para a memória de branding', () => {
    const q = quadro('video', [{ ...fala('a'), campos: { fala: 'x', expressao: 'joinha' } }, cartao('t', 'transicao', { efeito: 'cacos' }),
      cartao('n', 'animacao', { efeito: 'personagem', detalhe: 'surpreso' })], [['a', 't'], ['a', 'n']]);
    expect(escolhasDoQuadro(q)).toEqual({ transicoes: ['cacos'], animacoes: ['personagem'], expressoes: ['joinha', 'surpreso'], modelos: [] });
    const c = quadro('carrossel', [cartao('s', 'slide', { modelo: 'capa' })]);
    expect(escolhasDoQuadro(c).modelos).toEqual(['capa']);
  });

  it('o catálogo traz só transições aprovadas e as expressões recortadas', () => {
    expect(CATALOGO.transicoes).toEqual(['dissolucao', 'desmontagem', 'blocos', 'glitch', 'zoom', 'cacos']);
    expect(CATALOGO.animacoes).toEqual(['demonstracao', 'bombinha', 'personagem', 'destaque', 'som']);
    expect(CATALOGO.expressoes).toContain('digitando');
    expect(CATALOGO.demos).toEqual(expect.arrayContaining(['codigo', 'terminal', 'lista', 'comparacao']));
  });

  it('posicionarEmLinha espalha os cartões da esquerda para a direita', () => {
    const q = posicionarEmLinha(quadro('carrossel', [cartao('a', 'slide'), cartao('b', 'slide')]));
    expect(q.cartoes.map((c) => c.x)).toEqual([0, 320]);
  });
});
