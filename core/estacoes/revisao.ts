import type { Estacao, Roteiro, Visual } from '../tipos.ts';

/**
 * PROVISÓRIA. A conferência automática que roda antes da sua aprovação; por enquanto só vê se
 * falta algo. A versão real vai comparar a peça com o kit da marca (cores, logo, tom de voz).
 */
export const conferirPeca: Estacao<{ roteiro: Roteiro; visual: Visual }, string[]> = async ({ roteiro, visual }) => {
  const avisos: string[] = [];
  if (!roteiro.titulo.trim()) avisos.push('Título vazio.');
  if (!roteiro.legenda.trim()) avisos.push('Legenda vazia.');
  if (visual.conteudo.length === 0) avisos.push('Arquivo visual vazio.');
  return avisos;
};
