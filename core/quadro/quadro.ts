/**
 * Quadros: o roteiro visual de um vídeo (falas, transições, animações) ou de um carrossel (slides).
 * Ficam como arquivos .quadro.json no cofre. Este módulo também roda no navegador: só usa o que existe nos dois.
 */

export type TipoQuadro = 'video' | 'carrossel';
export type TipoCartao = 'fala' | 'transicao' | 'animacao' | 'slide';

export interface Cartao {
  id: string;
  tipo: TipoCartao;
  x: number;
  y: number;
  instrucoes: string;
  campos: Record<string, string>;
  anexos: string[];
  /** Campos preenchidos pela IA e ainda não editados pela pessoa (editar vira aprendizado da marca). */
  geradoPorIA?: string[];
}
export interface Conexao {
  id: string;
  de: string;
  para: string;
}
export interface Fonte {
  caminho: string;
  ativo: boolean;
}
export interface Quadro {
  versao: 1;
  tipo: TipoQuadro;
  nome: string;
  instrucoes: string;
  legenda: boolean;
  cartoes: Cartao[];
  conexoes: Conexao[];
  fontes: Fonte[];
}
export interface Cena {
  fala: Cartao;
  animacoes: Cartao[];
  transicao?: Cartao;
}
export interface Problema {
  nivel: 'erro' | 'aviso';
  mensagem: string;
  cartoes: string[];
}

export const CATALOGO = {
  transicoes: ['dissolucao', 'desmontagem', 'blocos', 'glitch', 'zoom', 'cacos'],
  animacoes: ['demonstracao', 'bombinha', 'personagem', 'destaque', 'som'],
  expressoes: ['ok', 'joinha', 'ideia', 'feliz', 'pensativo', 'confuso', 'surpreso', 'determinado', 'focado', 'digitando', 'lendo',
    'cansado', 'irritado', 'bracos', 'paz', 'polegar_baixo'],
  demos: ['codigo', 'terminal', 'lista', 'comparacao', 'livro', 'formula', 'esteira', 'erro', 'pcs'],
  sons: ['pop', 'ding', 'alerta', 'whoosh', 'vidro', 'glitch', 'sucesso', 'erro', 'tecla', 'zum', 'explosao'],
} as const;

export const NOMES_TIPO: Record<TipoCartao, string> = { fala: 'Fala', transicao: 'Transição', animacao: 'Animação', slide: 'Slide' };

export class ErroQuadro extends Error {}

const novoId = () => globalThis.crypto.randomUUID();

export function novoQuadro(tipo: TipoQuadro, nome: string): Quadro {
  return { versao: 1, tipo, nome, instrucoes: '', legenda: false, cartoes: [], conexoes: [], fontes: [] };
}

export function novoCartao(tipo: TipoCartao, x: number, y: number, campos: Record<string, string> = {}): Cartao {
  return { id: novoId(), tipo, x, y, instrucoes: '', campos: { ...campos }, anexos: [] };
}

export function cartoesPermitidos(tipo: TipoQuadro): TipoCartao[] {
  return tipo === 'video' ? ['fala', 'transicao', 'animacao'] : ['slide'];
}

const texto = (v: unknown, padrao = '') => (typeof v === 'string' ? v : padrao);
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function lerQuadro(json: string): Quadro {
  let bruto: Record<string, unknown>;
  try {
    bruto = JSON.parse(json);
  } catch {
    throw new ErroQuadro('O arquivo do quadro está corrompido (JSON inválido).');
  }
  if (!bruto || typeof bruto !== 'object') throw new ErroQuadro('O arquivo do quadro está vazio.');
  const tipo = bruto.tipo;
  if (tipo !== 'video' && tipo !== 'carrossel') throw new ErroQuadro(`Tipo de quadro desconhecido: "${String(tipo)}".`);
  const permitidos = cartoesPermitidos(tipo);
  const ids = new Set<string>();
  const cartoes: Cartao[] = (Array.isArray(bruto.cartoes) ? bruto.cartoes : []).map((c: Record<string, unknown>) => {
    const t = c.tipo as TipoCartao;
    if (!permitidos.includes(t)) {
      throw new ErroQuadro(`O quadro de ${tipo === 'video' ? 'vídeo' : 'carrossel'} não aceita cartão do tipo "${String(c.tipo)}".`);
    }
    const id = texto(c.id);
    if (!id) throw new ErroQuadro('Há um cartão sem id.');
    if (ids.has(id)) throw new ErroQuadro(`Id de cartão repetido: "${id}".`);
    ids.add(id);
    const campos: Record<string, string> = {};
    if (c.campos && typeof c.campos === 'object') {
      for (const [k, v] of Object.entries(c.campos as Record<string, unknown>)) campos[k] = String(v ?? '');
    }
    const cartao: Cartao = { id, tipo: t, x: numero(c.x), y: numero(c.y), instrucoes: texto(c.instrucoes), campos,
      anexos: Array.isArray(c.anexos) ? c.anexos.filter((a): a is string => typeof a === 'string') : [] };
    if (Array.isArray(c.geradoPorIA)) cartao.geradoPorIA = c.geradoPorIA.filter((a): a is string => typeof a === 'string');
    return cartao;
  });
  const conexoes = (Array.isArray(bruto.conexoes) ? bruto.conexoes : [])
    .filter((x: Record<string, unknown>) => ids.has(texto(x.de)) && ids.has(texto(x.para)) && x.de !== x.para)
    .map((x: Record<string, unknown>) => ({ id: texto(x.id) || novoId(), de: texto(x.de), para: texto(x.para) }));
  const fontes = (Array.isArray(bruto.fontes) ? bruto.fontes : [])
    .filter((f: Record<string, unknown>) => typeof f.caminho === 'string')
    .map((f: Record<string, unknown>) => ({ caminho: f.caminho as string, ativo: f.ativo !== false }));
  return { versao: 1, tipo, nome: texto(bruto.nome, 'Sem nome'), instrucoes: texto(bruto.instrucoes), legenda: bruto.legenda === true,
    cartoes, conexoes, fontes };
}

export function serializar(q: Quadro): string {
  return JSON.stringify(q, null, 2) + '\n';
}

export function conectar(q: Quadro, de: string, para: string): Quadro {
  if (de === para) throw new ErroQuadro('Um cartão não pode ligar nele mesmo.');
  if (!q.cartoes.some((c) => c.id === de) || !q.cartoes.some((c) => c.id === para)) throw new ErroQuadro('Cartão não encontrado.');
  if (q.conexoes.some((c) => c.de === de && c.para === para)) return q;
  return { ...q, conexoes: [...q.conexoes, { id: novoId(), de, para }] };
}

export function desconectar(q: Quadro, conexaoId: string): Quadro {
  return { ...q, conexoes: q.conexoes.filter((c) => c.id !== conexaoId) };
}

export function removerCartao(q: Quadro, id: string): Quadro {
  return { ...q, cartoes: q.cartoes.filter((c) => c.id !== id), conexoes: q.conexoes.filter((c) => c.de !== id && c.para !== id) };
}

const resumo = (c: Cartao) => {
  const t = (c.campos.fala || c.campos.titulo || c.campos.tela || c.instrucoes || NOMES_TIPO[c.tipo]).trim();
  return t.length > 40 ? `${t.slice(0, 40)}...` : t;
};
const porPosicao = (a: Cartao, b: Cartao) => a.x - b.x || a.y - b.y;
const ordenarProblemas = (p: Problema[]) => [...p.filter((x) => x.nivel === 'erro'), ...p.filter((x) => x.nivel === 'aviso')];

/**
 * Segue as ligações entre os cartões principais (falas no vídeo, slides no carrossel). Devolve a sequência,
 * os anexos de cada principal (cartões alcançados antes da próxima fala) e os problemas.
 */
function seguir(q: Quadro, principal: (c: Cartao) => boolean) {
  const porId = new Map(q.cartoes.map((c) => [c.id, c]));
  const saidas = new Map<string, string[]>();
  for (const c of q.conexoes) saidas.set(c.de, [...(saidas.get(c.de) ?? []), c.para]);
  const principais = q.cartoes.filter(principal);
  const proximas = new Map<string, string[]>();
  const anexos = new Map<string, Cartao[]>();
  const dono = new Map<string, string>();
  const problemas: Problema[] = [];
  for (const p of principais) {
    const vistos = new Set([p.id]);
    const fila = [...(saidas.get(p.id) ?? [])];
    const prox: string[] = [];
    const meus: Cartao[] = [];
    while (fila.length) {
      const id = fila.shift()!;
      if (vistos.has(id)) continue;
      vistos.add(id);
      const c = porId.get(id)!;
      if (principal(c)) {
        if (!prox.includes(id)) prox.push(id);
        continue;
      }
      if (dono.has(id) && dono.get(id) !== p.id) {
        problemas.push({ nivel: 'aviso', mensagem: `"${resumo(c)}" está ligado a mais de uma fala; ficou com a primeira.`, cartoes: [id] });
      } else {
        dono.set(id, p.id);
        meus.push(c);
      }
      fila.push(...(saidas.get(id) ?? []));
    }
    proximas.set(p.id, prox);
    anexos.set(p.id, meus);
  }
  const antecessores = new Map<string, number>();
  for (const prox of proximas.values()) for (const id of prox) antecessores.set(id, (antecessores.get(id) ?? 0) + 1);
  for (const p of principais) {
    if ((proximas.get(p.id) ?? []).length > 1) {
      problemas.push({ nivel: 'erro', mensagem: `"${resumo(p)}" tem mais de um próximo passo; escolha só um caminho.`, cartoes: [p.id] });
    }
  }
  const ligados = principais.filter((p) => (proximas.get(p.id) ?? []).length > 0 || (antecessores.get(p.id) ?? 0) > 0);
  const comecos = ligados.filter((p) => !(antecessores.get(p.id) ?? 0));
  let sequencia: Cartao[] = [];
  if (ligados.length === 0) {
    sequencia = [...principais].sort(porPosicao);
  } else if (comecos.length === 0) {
    problemas.push({ nivel: 'erro', mensagem: 'Há um ciclo: as ligações voltam para um passo anterior.', cartoes: ligados.map((p) => p.id) });
  } else if (comecos.length > 1) {
    problemas.push({ nivel: 'erro', mensagem: 'Há mais de um começo: ligue tudo numa sequência só.', cartoes: comecos.map((p) => p.id) });
    sequencia = [];
  } else {
    const vistos = new Set<string>();
    let atual: Cartao | undefined = comecos[0];
    while (atual) {
      if (vistos.has(atual.id)) {
        problemas.push({ nivel: 'erro', mensagem: 'Há um ciclo: as ligações voltam para um passo anterior.', cartoes: [atual.id] });
        break;
      }
      vistos.add(atual.id);
      sequencia.push(atual);
      const prox: string | undefined = (proximas.get(atual.id) ?? [])[0];
      atual = prox ? porId.get(prox) : undefined;
    }
    for (const p of principais) {
      if (!vistos.has(p.id)) problemas.push({ nivel: 'aviso', mensagem: `"${resumo(p)}" está solto, fora da sequência.`, cartoes: [p.id] });
    }
  }
  for (const c of q.cartoes) {
    if (!principal(c) && !dono.has(c.id)) {
      problemas.push({ nivel: 'aviso', mensagem: `"${resumo(c)}" está solto: ligue-o a uma fala.`, cartoes: [c.id] });
    }
  }
  return { sequencia, anexos, problemas };
}

function montarCenas(sequencia: Cartao[], anexos: Map<string, Cartao[]>, problemas: Problema[]): Cena[] {
  return sequencia.map((fala) => {
    const meus = anexos.get(fala.id) ?? [];
    const transicoes = meus.filter((c) => c.tipo === 'transicao');
    if (transicoes.length > 1) {
      problemas.push({ nivel: 'aviso', mensagem: `"${resumo(fala)}" tem mais de uma transição; vale a primeira.`, cartoes: transicoes.slice(1).map((c) => c.id) });
    }
    if (!(fala.campos.fala ?? '').trim() && !fala.instrucoes.trim()) {
      problemas.push({ nivel: 'aviso', mensagem: 'Há uma fala sem texto: escreva ou peça para a IA gerar.', cartoes: [fala.id] });
    }
    const cena: Cena = { fala, animacoes: meus.filter((c) => c.tipo === 'animacao') };
    if (transicoes[0]) cena.transicao = transicoes[0];
    return cena;
  });
}

export function ordenarVideo(q: Quadro): { cenas: Cena[]; problemas: Problema[] } {
  const falas = q.cartoes.filter((c) => c.tipo === 'fala');
  if (!falas.length) return { cenas: [], problemas: [{ nivel: 'aviso', mensagem: 'O quadro ainda não tem falas: comece por um cartão de fala.', cartoes: [] }] };
  if (q.conexoes.length === 0) {
    const ordem = [...falas].sort(porPosicao);
    const anexos = new Map<string, Cartao[]>(ordem.map((f) => [f.id, []]));
    for (const c of q.cartoes.filter((c) => c.tipo !== 'fala').sort(porPosicao)) {
      const ancora = [...ordem].reverse().find((f) => f.x <= c.x) ?? ordem[0]!;
      anexos.get(ancora.id)!.push(c);
    }
    const problemas: Problema[] = [{ nivel: 'aviso', mensagem: 'Sem ligações: a ordem segue a posição, da esquerda para a direita. Ligue os cartões para fixar a ordem.', cartoes: [] }];
    const cenas = montarCenas(ordem, anexos, problemas);
    return { cenas, problemas: ordenarProblemas(problemas) };
  }
  const { sequencia, anexos, problemas } = seguir(q, (c) => c.tipo === 'fala');
  const cenas = montarCenas(sequencia, anexos, problemas);
  return { cenas, problemas: ordenarProblemas(problemas) };
}

export const MAX_SLIDES = 10;

export function ordenarCarrossel(q: Quadro): { slides: Cartao[]; problemas: Problema[] } {
  const slides = q.cartoes.filter((c) => c.tipo === 'slide');
  let r: { slides: Cartao[]; problemas: Problema[] };
  if (q.conexoes.length === 0) {
    r = { slides: [...slides].sort(porPosicao), problemas: slides.length > 1
      ? [{ nivel: 'aviso', mensagem: 'Sem ligações: a ordem segue a posição, da esquerda para a direita.', cartoes: [] }] : [] };
  } else {
    const { sequencia, problemas } = seguir(q, (c) => c.tipo === 'slide');
    r = { slides: sequencia, problemas };
  }
  if (slides.length > MAX_SLIDES) {
    r.problemas.push({ nivel: 'erro', mensagem: `O carrossel tem ${slides.length} slides; o máximo é ${MAX_SLIDES}.`, cartoes: [] });
  }
  return { slides: r.slides, problemas: ordenarProblemas(r.problemas) };
}

/** Escolhas que viram aprendizado da marca (contadas na memória de branding). */
export function escolhasDoQuadro(q: Quadro) {
  const e = { transicoes: [] as string[], animacoes: [] as string[], expressoes: [] as string[], modelos: [] as string[] };
  for (const c of q.cartoes) {
    if (c.tipo === 'transicao' && c.campos.efeito) e.transicoes.push(c.campos.efeito);
    if (c.tipo === 'animacao' && c.campos.efeito) e.animacoes.push(c.campos.efeito);
    if (c.tipo === 'fala' && c.campos.expressao) e.expressoes.push(c.campos.expressao);
    if (c.tipo === 'animacao' && c.campos.efeito === 'personagem' && c.campos.detalhe) e.expressoes.push(c.campos.detalhe);
    if (c.tipo === 'slide' && c.campos.modelo) e.modelos.push(c.campos.modelo);
  }
  return e;
}

export function posicionarEmLinha(q: Quadro, passo = 320): Quadro {
  return { ...q, cartoes: q.cartoes.map((c, i) => ({ ...c, x: i * passo })) };
}
