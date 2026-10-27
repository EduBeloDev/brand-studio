import type { Estacao, KitMarca, Pedido, Roteiro } from '../tipos.ts';

/**
 * PROVISÓRIA. Usa o tema como título e uma legenda fixa. A versão real vai pedir o texto a um
 * modelo de IA, seguindo o tom de voz do kit da marca.
 */
export const escreverRoteiro: Estacao<{ pedido: Pedido; marca: KitMarca }, Roteiro> = async ({ pedido, marca }) => ({
  titulo: pedido.tema,
  legenda: `[Legenda provisória de ${marca.nome}] ${pedido.tema}`,
});
