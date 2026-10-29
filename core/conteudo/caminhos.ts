import path from 'node:path';

/**
 * Caminhos dentro da pasta de conteúdos. Tudo que vem da tela é relativo à raiz e passa por aqui:
 * nada pode sair da raiz (../) nem usar caracteres que confundem o sistema de arquivos.
 */

export type CodigoErro = 'caminho-invalido' | 'nao-encontrado' | 'ja-existe' | 'tipo-invalido' | 'destino-invalido' | 'muito-grande';

export class ErroConteudo extends Error {
  codigo: CodigoErro;
  constructor(mensagem: string, codigo: CodigoErro) {
    super(mensagem);
    this.codigo = codigo;
  }
}

/** "/ideias//api/" vira "ideias/api"; "" é a própria raiz. Recusa "..", NUL e caminho absoluto do Windows. */
export function normalizar(relativo: string): string {
  if (relativo.includes('\0')) throw new ErroConteudo('Caminho com caractere inválido.', 'caminho-invalido');
  const partes = relativo.replaceAll('\\', '/').split('/').filter((p) => p !== '' && p !== '.');
  if (partes.some((p) => p === '..')) throw new ErroConteudo(`Caminho fora da pasta de conteúdos: "${relativo}".`, 'caminho-invalido');
  if (partes[0] && /^[a-zA-Z]:$/.test(partes[0])) throw new ErroConteudo(`Caminho absoluto não é aceito: "${relativo}".`, 'caminho-invalido');
  return partes.join('/');
}

export function resolver(raiz: string, relativo: string): string {
  const rel = normalizar(relativo);
  const absoluto = path.join(raiz, ...rel.split('/').filter(Boolean));
  const base = path.resolve(raiz);
  const alvo = path.resolve(absoluto);
  if (alvo !== base && !alvo.startsWith(base + path.sep)) {
    throw new ErroConteudo(`Caminho fora da pasta de conteúdos: "${relativo}".`, 'caminho-invalido');
  }
  return absoluto;
}

/** Nome de um item novo (sem pasta). Aceita acentos e espaços; recusa barra, oculto e controle. */
export function nomeSeguro(nome: string): string {
  const limpo = nome.trim();
  if (!limpo || limpo === '.' || limpo === '..') throw new ErroConteudo('Dê um nome ao item.', 'caminho-invalido');
  if (/[/\\]/.test(limpo)) throw new ErroConteudo('O nome não pode ter barra.', 'caminho-invalido');
  if (limpo.startsWith('.')) throw new ErroConteudo('O nome não pode começar com ponto.', 'caminho-invalido');
  if (/[\x00-\x1f]/.test(limpo)) throw new ErroConteudo('O nome tem um caractere inválido.', 'caminho-invalido');
  return limpo;
}
