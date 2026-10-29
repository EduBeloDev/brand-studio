import { describe, expect, it } from 'vitest';
import { FUNCOES, TOPICOS, buscar } from './conteudo.ts';

describe('ajuda', () => {
  it('toda função do app tem pelo menos um tópico, com passo a passo', () => {
    for (const funcao of FUNCOES) {
      const topicos = TOPICOS.filter((t) => t.funcao === funcao);
      expect(topicos.length, funcao).toBeGreaterThan(0);
      for (const t of topicos) expect(t.passos.length, t.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('ids são únicos e todo tópico aponta para uma função conhecida', () => {
    expect(new Set(TOPICOS.map((t) => t.id)).size).toBe(TOPICOS.length);
    for (const t of TOPICOS) expect(FUNCOES).toContain(t.funcao);
  });

  it('busca sem acento e sem maiúscula, título primeiro', () => {
    expect(buscar('LIXEIRA')[0]!.funcao).toBe('lixeira');
    expect(buscar('excluir').some((t) => t.funcao === 'excluir')).toBe(true);
    expect(buscar('roubar')[0]!.funcao).toBe('roubar-ideias');
    expect(buscar('pausar aprendizado').some((t) => t.funcao === 'pausar-radar')).toBe(true);
    expect(buscar('')).toHaveLength(TOPICOS.length);
    expect(buscar('xyzxyz')).toEqual([]);
  });
});
