import type { Estacao, KitMarca } from '../tipos.ts';

/**
 * PROVISÓRIA. Devolve um kit neutro, em tons de cinza, para a linha rodar antes do branding.
 * A versão real vai carregar o kit da marca; de onde ele vem ainda está em aberto (CLAUDE.md).
 */
export const carregarMarca: Estacao<void, KitMarca> = async () => ({
  nome: 'Marca provisória',
  cores: { principal: '#5c5c5c', fundo: '#e6e6e6', texto: '#1f1f1f' },
  fonte: 'sans-serif',
});
