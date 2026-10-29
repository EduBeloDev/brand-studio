import { MODELOS, modeloPorId, validarCampos } from '../carrossel/modelos.ts';
import {
  CATALOGO,
  conectar,
  novoCartao,
  novoQuadro,
  ordenarCarrossel,
  ordenarVideo,
  type Cartao,
  type Quadro,
  type TipoQuadro,
} from '../quadro/quadro.ts';
import { ErroIA, extrairJson, type IA } from './ia.ts';

/** Geração com IA: preenche cartões e monta quadros inteiros, sempre com a memória da marca no contexto. */

export interface Contexto {
  marca: string;
  fontes: { caminho: string; texto: string }[];
}

export function montarContexto(c: Contexto, limite = 12_000): string {
  const partes = [`## Memória da marca\n${c.marca.trim()}`, ...c.fontes.map((f) => `## Fonte: ${f.caminho}\n${f.texto.trim()}`)];
  const texto = partes.join('\n\n');
  return texto.length <= limite ? texto : texto.slice(0, limite);
}

const SISTEMA = `Você é o roteirista e diretor de arte da marca descrita na memória da marca (nome, objetivo, identidade), em português do Brasil.
Escreva em pt-BR natural, simples e preciso, com humor leve sobre a situação, sem humilhar quem está começando.
Siga a memória da marca. Não invente números, citações ou fatos sem fonte.
Escreva sempre com a grafia normal (bug, API, MIT, deploy), inclusive na fala: a tabela de pronúncia da marca é aplicada
pelo app só na voz. Nunca escreva a forma de pronunciar ("bâg", "ême í tê") em nenhum campo.
Responda SOMENTE com JSON válido, sem texto extra.`;

const catalogo = () => `Catálogo do motor (use só estes valores):
- transições: ${CATALOGO.transicoes.join(', ')}
- animações: ${CATALOGO.animacoes.join(', ')} (demonstracao precisa de "demo"; personagem usa "detalhe" com uma expressão; som usa "detalhe" com um som; bombinha explode o texto da tela no fim da fala ou na palavra "gatilho")
- demonstrações: codigo (campos "codigo" e "saida"), terminal (campos "codigo" com os comandos e "saida"), lista (campo "itens", um por linha), comparacao (campos "esquerda" e "direita", cada um "Título: texto")
- expressões do personagem: ${CATALOGO.expressoes.join(', ')}
- sons: ${CATALOGO.sons.join(', ')}`;

function descreverModelos(ids?: string[]) {
  return MODELOS.filter((m) => !ids || ids.includes(m.id)).map((m) =>
    `- ${m.id} (${m.nome}): ${m.descricao}\n` + m.campos.map((c) =>
      `    ${c.chave}: ${c.rotulo}${c.obrigatorio ? ' (obrigatório)' : ''}${c.max ? `, até ${c.max}${c.tipo === 'lista' ? ' itens' : ' caracteres'}` : ''}${c.dica ? `. ${c.dica}` : ''}`).join('\n')).join('\n');
}

const cartaoDe = (q: Quadro, id: string, tipo: Cartao['tipo']) => {
  const c = q.cartoes.find((x) => x.id === id);
  if (!c || c.tipo !== tipo) throw new ErroIA(`Não encontrei esse cartão de ${tipo === 'slide' ? 'slide' : 'fala'} no quadro.`);
  return c;
};

async function comRepeticao<T>(ia: IA, pedido: { sistema: string; prompt: string }, validar: (json: unknown) => { ok: true; valor: T } | { ok: false; erro: string }, oque: string) {
  let prompt = pedido.prompt;
  let ultimo = '';
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const r = await ia.gerar({ sistema: pedido.sistema, prompt });
    let json: unknown;
    try {
      json = extrairJson(r.texto);
    } catch {
      ultimo = 'a resposta não era JSON válido';
      prompt = `${pedido.prompt}\n\nSua resposta anterior não era JSON válido. Responda só com o JSON pedido.`;
      continue;
    }
    const v = validar(json);
    if (v.ok) return v.valor;
    ultimo = v.erro;
    prompt = `${pedido.prompt}\n\nSua resposta anterior teve problemas: ${v.erro} Corrija e responda de novo só com o JSON.`;
  }
  throw new ErroIA(`A IA não conseguiu ${oque}: ${ultimo}.`);
}

export async function gerarSlide(ia: IA, q: Quadro, cartaoId: string, ctx: Contexto) {
  const c = cartaoDe(q, cartaoId, 'slide');
  const fixo = c.campos.modelo && modeloPorId(c.campos.modelo) ? c.campos.modelo : '';
  const { slides } = ordenarCarrossel(q);
  const pos = slides.findIndex((s) => s.id === c.id);
  const vizinhos = slides.map((s, i) => `${i + 1}. ${s.id === c.id ? '(ESTE SLIDE)' : s.campos.titulo || s.campos.mito || s.instrucoes || 'vazio'}`).join('\n');
  const prompt = `Crie o conteúdo de um slide de carrossel do Instagram (1080x1350).
Carrossel: ${q.nome}
Instruções do carrossel: ${q.instrucoes || 'nenhuma'}
Posição: slide ${pos + 1} de ${slides.length || 1}
Sequência atual:
${vizinhos || '(só este)'}
Instruções deste slide: ${c.instrucoes || 'nenhuma'}
${fixo ? `Use o modelo "${fixo}".` : 'Escolha o modelo que melhor comunica a ideia.'}
Modelos disponíveis:
${descreverModelos(fixo ? [fixo] : undefined)}
${catalogo()}
Texto curto: o slide precisa ser lido em 3 segundos no celular. Só a escrita necessária para entender.

${montarContexto(ctx)}

Responda com: {"modelo": "<id>", "campos": {"<chave>": "<valor>"}}`;
  return comRepeticao(ia, { sistema: SISTEMA, prompt }, (json) => {
    const j = json as { modelo?: string; campos?: Record<string, unknown> };
    const modelo = fixo || String(j?.modelo ?? '');
    const v = validarCampos(modelo, j?.campos ?? {});
    return v.ok ? { ok: true, valor: { modelo, campos: v.campos } } : { ok: false, erro: v.erros.join(' ') };
  }, 'gerar o slide');
}

const EXPRESSOES = CATALOGO.expressoes as readonly string[];

export async function gerarFala(ia: IA, q: Quadro, cartaoId: string, ctx: Contexto) {
  const c = cartaoDe(q, cartaoId, 'fala');
  const { cenas } = ordenarVideo(q);
  const i = cenas.findIndex((x) => x.fala.id === c.id);
  const antes = cenas.slice(Math.max(0, i - 2), Math.max(0, i)).map((x) => x.fala.campos.fala).filter(Boolean);
  const depois = i >= 0 ? cenas.slice(i + 1, i + 3).map((x) => x.fala.campos.fala).filter(Boolean) : [];
  const prompt = `Escreva uma fala de um vídeo vertical curto (Reels/TikTok) da marca.
Vídeo: ${q.nome}
Instruções do vídeo: ${q.instrucoes || 'nenhuma'}
Falas anteriores: ${antes.length ? antes.map((f) => `"${f}"`).join(' / ') : 'nenhuma (é a abertura)'}
Falas seguintes: ${depois.length ? depois.map((f) => `"${f}"`).join(' / ') : 'nenhuma'}
Instruções desta fala: ${c.instrucoes || 'nenhuma'}
Texto atual: ${c.campos.fala || 'vazio'}
Regras: fala natural para ser narrada (1 a 3 frases, até ~25 palavras); "tela" é a frase curta que aparece escrita (até 60
caracteres, *destaque* opcional); "expressao" é uma destas: ${EXPRESSOES.join(', ')}.

${montarContexto(ctx)}

Responda com: {"fala": "...", "tela": "...", "expressao": "..."}`;
  return comRepeticao(ia, { sistema: SISTEMA, prompt }, (json) => {
    const j = json as { fala?: string; tela?: string; expressao?: string };
    const fala = String(j?.fala ?? '').trim();
    if (!fala) return { ok: false, erro: 'A fala veio vazia.' };
    const tela = String(j?.tela ?? '').trim() || fala.split(/[.!?]/)[0]!.slice(0, 60);
    const expressao = EXPRESSOES.includes(String(j?.expressao)) ? String(j?.expressao) : 'ok';
    return { ok: true, valor: { fala, tela, expressao } };
  }, 'gerar a fala');
}

const marcarIA = (c: Cartao): Cartao => ({ ...c, geradoPorIA: Object.keys(c.campos) });
const LARGURA = 360;

/** Monta um quadro inteiro a partir de uma sugestão (do radar ou do roubar ideias). */
export async function quadroDeSugestao(ia: IA, sugestao: { titulo: string; texto: string }, tipo: TipoQuadro, ctx: Contexto): Promise<Quadro> {
  const video = tipo === 'video';
  const prompt = video
    ? `Monte o roteiro de um vídeo vertical curto (35 a 60 s) da marca a partir desta sugestão.
Sugestão: ${sugestao.titulo}
${sugestao.texto}
Estrutura: gancho forte na primeira cena, desenvolvimento com uma analogia ou demonstração, fechamento curto com chamada.
De 4 a 7 cenas. Cada cena: "fala" (narração natural, até ~25 palavras), "tela" (até 60 caracteres, *destaque* opcional),
"expressao", "transicao" (saída da cena) e "animacoes" (opcional, no máximo 2 por cena, com propósito; varie, sem poluir).
Não repita a mesma transição em todas as cenas; use no máximo 3 tipos no vídeo.
${catalogo()}

${montarContexto(ctx)}

Responda com: {"nome": "...", "instrucoes": "tom e intenção em uma frase", "cenas": [{"fala": "...", "tela": "...", "expressao": "...",
"transicao": "...", "animacoes": [{"efeito": "...", "demo": "...", "codigo": "...", "saida": "...", "itens": "...", "esquerda": "...",
"direita": "...", "detalhe": "...", "gatilho": "..."}]}]}`
    : `Monte um carrossel do Instagram (1080x1350) da marca a partir desta sugestão.
Sugestão: ${sugestao.titulo}
${sugestao.texto}
De 5 a 8 slides: capa, desenvolvimento variado (explicação, comparação, código, passos ou mito e verdade) e fechamento.
Só a escrita necessária para entender; varie os modelos.
Modelos:
${descreverModelos()}
${catalogo()}

${montarContexto(ctx)}

Responda com: {"nome": "...", "instrucoes": "tom e intenção em uma frase", "slides": [{"modelo": "...", "campos": {...}}]}`;
  const r = await ia.gerar({ sistema: SISTEMA, prompt });
  const j = extrairJson<Record<string, unknown>>(r.texto);
  let q = { ...novoQuadro(tipo, String(j.nome || sugestao.titulo)), instrucoes: String(j.instrucoes || '') };
  if (video) {
    const cenas = (Array.isArray(j.cenas) ? j.cenas : []).filter((c: Record<string, unknown>) => String(c?.fala ?? '').trim());
    if (!cenas.length) throw new ErroIA('A IA não devolveu nenhuma cena válida.');
    const falas: Cartao[] = [];
    const extras: { de: string; cartao: Cartao; entre?: boolean }[] = [];
    cenas.forEach((c: Record<string, unknown>, i: number) => {
      const fala = marcarIA({ ...novoCartao('fala', i * LARGURA, 0, {
        fala: String(c.fala).trim(), tela: String(c.tela ?? '').trim(),
        expressao: EXPRESSOES.includes(String(c.expressao)) ? String(c.expressao) : 'ok' }) });
      falas.push(fala);
      const efeito = (CATALOGO.transicoes as readonly string[]).includes(String(c.transicao)) ? String(c.transicao) : 'dissolucao';
      extras.push({ de: fala.id, entre: true, cartao: marcarIA(novoCartao('transicao', i * LARGURA + LARGURA / 2, 170, { efeito })) });
      const anims = (Array.isArray(c.animacoes) ? c.animacoes : []).slice(0, 2);
      anims.forEach((a: Record<string, unknown>, k: number) => {
        const ef = String(a?.efeito ?? '');
        if (!(CATALOGO.animacoes as readonly string[]).includes(ef)) return;
        if (ef === 'demonstracao' && !(CATALOGO.demos as readonly string[]).includes(String(a.demo))) return;
        const campos: Record<string, string> = { efeito: ef };
        for (const chave of ['demo', 'codigo', 'saida', 'itens', 'esquerda', 'direita', 'detalhe', 'gatilho']) {
          if (a[chave] !== undefined && String(a[chave]).trim()) campos[chave] = String(a[chave]);
        }
        extras.push({ de: fala.id, cartao: marcarIA(novoCartao('animacao', i * LARGURA, 340 + k * 170, campos)) });
      });
    });
    q = { ...q, cartoes: [...falas, ...extras.map((e) => e.cartao)] };
    falas.forEach((f, i) => {
      const t = extras.find((e) => e.de === f.id && e.entre)!.cartao;
      q = conectar(q, f.id, t.id);
      if (falas[i + 1]) q = conectar(q, t.id, falas[i + 1]!.id);
    });
    for (const e of extras.filter((x) => !x.entre)) q = conectar(q, e.de, e.cartao.id);
  } else {
    const slides: Cartao[] = [];
    for (const s of Array.isArray(j.slides) ? j.slides : []) {
      const v = validarCampos(String(s?.modelo ?? ''), s?.campos ?? {});
      if (v.ok) slides.push(marcarIA(novoCartao('slide', slides.length * 320, 0, { modelo: String(s.modelo), ...v.campos })));
    }
    if (!slides.length) throw new ErroIA('A IA não devolveu nenhum slide válido.');
    q = { ...q, cartoes: slides.slice(0, 10) };
    for (let i = 1; i < q.cartoes.length; i++) q = conectar(q, q.cartoes[i - 1]!.id, q.cartoes[i]!.id);
  }
  return q;
}
