/**
 * Os contratos da linha de montagem: o que cada estação recebe e entrega. As estações só se
 * falam por estes tipos, então trocar uma estação provisória pela real não mexe nas outras.
 * Mudar um tipo daqui é decisão, porque afeta mais de uma estação.
 */

/** O que você pede. O formato (post, carrossel, vídeo) entra quando for decidido. */
export type Pedido = {
  tema: string;
};

/**
 * A marca, do jeito que as estações enxergam. Campos provisórios: os de verdade (logo, tom de
 * voz, o que é proibido...) saem da rodada de branding.
 */
export type KitMarca = {
  nome: string;
  cores: { principal: string; fundo: string; texto: string };
  fonte: string;
};

export type Roteiro = {
  titulo: string;
  legenda: string;
};

/** Um arquivo visual pronto. Texto (SVG) por enquanto; já aceita binário para quando vier PNG ou MP4. */
export type Visual = {
  arquivo: string;
  conteudo: string | Uint8Array;
};

export type StatusPeca = 'aguardando-aprovacao' | 'aprovada' | 'rejeitada';

/** O registro de uma peça, salvo como peca.json na pasta dela. */
export type Peca = {
  /** O mesmo nome da pasta em saida/. */
  id: string;
  criadaEm: string;
  status: StatusPeca;
  pedido: Pedido;
  roteiro: Roteiro;
  /** Nome do arquivo visual dentro da pasta da peça. */
  visual: string;
  /** O que a conferência automática apontou. Não bloqueia: quem decide é você, no revisar. */
  avisos: string[];
};

/** Uma estação: recebe uma entrada e devolve uma saída. Assíncrona porque as reais vão chamar APIs. */
export type Estacao<Entrada, Saida> = (entrada: Entrada) => Promise<Saida>;
