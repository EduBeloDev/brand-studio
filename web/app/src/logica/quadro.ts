import {
  cartoesPermitidos, conectar, desconectar, novoCartao, removerCartao, type Quadro, type TipoCartao,
} from '../../../../core/quadro/quadro.ts';

/** Edição do quadro na tela, como ações puras (fáceis de testar e de desfazer). */

export type Acao =
  | { tipo: 'adicionar'; cartao: TipoCartao; x?: number; y?: number; campos?: Record<string, string> }
  | { tipo: 'campo'; id: string; chave: string; valor: string }
  | { tipo: 'instrucoes'; id: string; valor: string }
  | { tipo: 'mover'; id: string; x: number; y: number }
  | { tipo: 'conectar'; de: string; para: string }
  | { tipo: 'desconectar'; id: string }
  | { tipo: 'remover'; id: string }
  | { tipo: 'gerado'; id: string; campos: Record<string, string> }
  | { tipo: 'fonte'; caminho: string; ativo?: boolean }
  | { tipo: 'tirar-fonte'; caminho: string }
  | { tipo: 'quadro'; campo: 'nome' | 'instrucoes' | 'legenda'; valor: string | boolean }
  | { tipo: 'substituir'; quadro: Quadro };

const PASSO = 320;
const ALTURA_LINHA: Record<TipoCartao, number> = { fala: 0, slide: 0, transicao: 220, animacao: 440 };

/** Próxima posição livre: à direita do último cartão daquela linha. */
export function posicaoLivre(q: Quadro, tipo: TipoCartao = 'fala'): { x: number; y: number } {
  const y = ALTURA_LINHA[tipo];
  const xs = q.cartoes.map((c) => c.x);
  return { x: xs.length ? Math.max(...xs) + PASSO : 0, y };
}

export function reduzir(q: Quadro, a: Acao): Quadro {
  const mudar = (id: string, f: (c: Quadro['cartoes'][number]) => Quadro['cartoes'][number]) =>
    ({ ...q, cartoes: q.cartoes.map((c) => (c.id === id ? f(c) : c)) });
  switch (a.tipo) {
    case 'adicionar': {
      if (!cartoesPermitidos(q.tipo).includes(a.cartao)) return q;
      const p = a.x !== undefined && a.y !== undefined ? { x: a.x, y: a.y } : posicaoLivre(q, a.cartao);
      return { ...q, cartoes: [...q.cartoes, novoCartao(a.cartao, p.x, p.y, a.campos ?? {})] };
    }
    case 'campo':
      // editar um campo que a IA preencheu tira a marca (o servidor registra a correção na memória da marca)
      return mudar(a.id, (c) => {
        const marcas = c.geradoPorIA?.filter((k) => k !== a.chave);
        const { geradoPorIA: _, ...resto } = c;
        return { ...resto, campos: { ...c.campos, [a.chave]: a.valor }, ...(marcas?.length ? { geradoPorIA: marcas } : {}) };
      });
    case 'instrucoes':
      return mudar(a.id, (c) => ({ ...c, instrucoes: a.valor }));
    case 'mover':
      return mudar(a.id, (c) => ({ ...c, x: Math.round(a.x), y: Math.round(a.y) }));
    case 'conectar':
      try {
        return conectar(q, a.de, a.para);
      } catch {
        return q;
      }
    case 'desconectar':
      return desconectar(q, a.id);
    case 'remover':
      return removerCartao(q, a.id);
    case 'gerado':
      return mudar(a.id, (c) => ({ ...c, campos: { ...c.campos, ...a.campos }, geradoPorIA: Object.keys(a.campos) }));
    case 'fonte': {
      const ativo = a.ativo ?? true;
      const existe = q.fontes.some((f) => f.caminho === a.caminho);
      return { ...q, fontes: existe ? q.fontes.map((f) => (f.caminho === a.caminho ? { ...f, ativo } : f)) : [...q.fontes, { caminho: a.caminho, ativo }] };
    }
    case 'tirar-fonte':
      return { ...q, fontes: q.fontes.filter((f) => f.caminho !== a.caminho) };
    case 'quadro':
      return { ...q, [a.campo]: a.valor };
    case 'substituir':
      return a.quadro;
  }
}
