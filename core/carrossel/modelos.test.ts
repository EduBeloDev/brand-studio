import { describe, expect, it } from 'vitest';
import { MODELOS, esbocoCampos, modeloPorId, validarCampos } from './modelos.ts';

describe('modelos de slide', () => {
  it('tem os modelos combinados, cada um com campos descritos', () => {
    expect(MODELOS.map((m) => m.id)).toEqual(['capa', 'mito-verdade', 'explicacao', 'comparacao', 'codigo', 'passos', 'fechamento']);
    for (const m of MODELOS) {
      expect(m.nome.length).toBeGreaterThan(0);
      expect(m.campos.some((c) => c.obrigatorio)).toBe(true);
    }
    expect(modeloPorId('codigo')?.campos.map((c) => c.chave)).toEqual(['titulo', 'codigo', 'explicacao']);
    expect(modeloPorId('nao-existe')).toBeUndefined();
  });

  it('esboço traz todas as chaves vazias', () => {
    expect(esbocoCampos('capa')).toEqual({ selo: '', titulo: '', personagem: '' });
  });

  it('validar limpa espaços e aceita campos certos', () => {
    const r = validarCampos('capa', { titulo: '  3 erros de quem *começa*  ', selo: 'Para quem começa', extra: 'ignorado' });
    expect(r).toEqual({ ok: true, erros: [], campos: { selo: 'Para quem começa', titulo: '3 erros de quem *começa*', personagem: '' } });
  });

  it('aponta obrigatório vazio, texto longo demais, demo e expressão desconhecidas', () => {
    expect(validarCampos('mito-verdade', { mito: '', verdade: 'x' }).erros.join(' ')).toMatch(/mito/i);
    expect(validarCampos('capa', { titulo: 'x'.repeat(200) }).erros.join(' ')).toMatch(/título|titulo/i);
    expect(validarCampos('explicacao', { titulo: 'T', texto: 'x', demo: 'filme' }).erros.join(' ')).toMatch(/demo/i);
    expect(validarCampos('capa', { titulo: 'T', personagem: 'dançando' }).erros.join(' ')).toMatch(/personagem|expressão/i);
    expect(validarCampos('xyz', {}).ok).toBe(false);
  });

  it('lista aceita até 5 itens, um por linha', () => {
    expect(validarCampos('passos', { titulo: 'T', itens: 'a\nb\n\nc' }).campos.itens).toBe('a\nb\nc');
    expect(validarCampos('passos', { titulo: 'T', itens: 'a\nb\nc\nd\ne\nf' }).ok).toBe(false);
  });
});
