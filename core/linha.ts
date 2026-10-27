import { carregarMarca } from './estacoes/marca.ts';
import { conferirPeca } from './estacoes/revisao.ts';
import { escreverRoteiro } from './estacoes/roteiro.ts';
import { criarVisual } from './estacoes/visual.ts';
import { PASTA_SAIDA, salvarPeca } from './saida.ts';
import type { Peca, Pedido } from './tipos.ts';

/**
 * A linha de montagem: pedido → marca → roteiro → visual → revisão → saída.
 * É o único arquivo que conhece a ordem; as estações não se conhecem entre si.
 * `pastaSaida` e `agora` existem para os testes não sujarem saida/ nem dependerem do relógio.
 */
export async function produzirPeca(
  pedido: Pedido,
  { pastaSaida = PASTA_SAIDA, agora = new Date() }: { pastaSaida?: string; agora?: Date } = {},
): Promise<Peca> {
  const tema = pedido.tema.trim();
  if (!tema) throw new Error('O pedido precisa de um tema.');
  const pedidoLimpo: Pedido = { tema };

  const marca = await carregarMarca();
  const roteiro = await escreverRoteiro({ pedido: pedidoLimpo, marca });
  const visual = await criarVisual({ roteiro, marca });
  const avisos = await conferirPeca({ roteiro, visual });
  return salvarPeca({ pastaSaida, agora, pedido: pedidoLimpo, roteiro, visual, avisos });
}
