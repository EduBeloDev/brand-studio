import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  calcularPreferencias, consolidar, contextoDaMarca, lerEventos, lerPronuncias, precisaConsolidar, registrar, TIPOS_EVENTO, type TipoEvento,
} from '../core/branding/memoria.ts';
import { lerMarca } from '../core/branding/marca.ts';
import { ErroConteudo, resolver } from '../core/conteudo/caminhos.ts';
import {
  anexar, criarPasta, criarTexto, criarNota, esvaziarLixeira, excluir, lerBinario, lerTexto, listarArquivos, listarArvore, listarLixeira,
  mover, renomear, restaurar, salvarTexto,
} from '../core/conteudo/cofre.ts';
import { extrairLigacoes, lerFrente, montarGrafo, resolverAlvo } from '../core/conteudo/ligacoes.ts';
import { dataLocal, slug } from '../core/conteudo/slug.ts';
import { gerarFala, gerarSlide, quadroDeSugestao, type Contexto } from '../core/ia/geracao.ts';
import { ErroIA, type IA } from '../core/ia/ia.ts';
import {
  CATALOGO, ErroQuadro, escolhasDoQuadro, lerQuadro, novoQuadro, ordenarCarrossel, ordenarVideo, serializar, type Quadro, type TipoQuadro,
} from '../core/quadro/quadro.ts';
import { lerSugestoes, marcarSugestao, type Radar } from '../core/radar/radar.ts';
import { analisarReferencia, classificarMidia, type Extracao } from '../core/referencias/referencias.ts';
import { Fila } from '../core/render/fila.ts';
import { roteiroParaMotor, slidesParaMotor, type Motor } from '../core/render/motor.ts';

/**
 * API do estúdio. Fina: traduz pedidos HTTP em chamadas ao núcleo (core/). Só escuta em 127.0.0.1 (quem chama
 * listen decide; o servidor do app usa 127.0.0.1). Pedidos que mudam algo exigem JSON, o que impede outra página
 * aberta no navegador de disparar ações às cegas; uploads exigem cabeçalhos próprios (x-nome), pelo mesmo motivo.
 */

export interface OpcoesServidor {
  raiz: string;
  ia: IA;
  motor: Motor;
  pastaSaida: string;
  radar: Radar;
  limiteUpload?: number;
  limiteReferencia?: number;
  extrairReferencia?: (arquivo: string, pasta: string) => Promise<Extracao>;
  /** Pasta da interface já construída (web/dist); sem ela, só a API responde. */
  estatico?: string;
  /** Rotas antigas (peças da esteira); devolve true se tratou o pedido. */
  extra?: (req: IncomingMessage, res: ServerResponse, rota: string) => Promise<boolean>;
}

class ErroHttp extends Error {
  status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.status = status;
  }
}

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.pdf': 'application/pdf',
  '.zip': 'application/zip', '.woff2': 'font/woff2',
};
const tipoDoArquivo = (nome: string) => TIPOS[path.extname(nome).toLowerCase()] ?? 'application/octet-stream';

const STATUS_CONTEUDO: Record<string, number> = {
  'caminho-invalido': 400, 'nao-encontrado': 404, 'ja-existe': 409, 'tipo-invalido': 400, 'destino-invalido': 400, 'muito-grande': 413,
};

function enviar(res: ServerResponse, status: number, corpo: string | Uint8Array, tipo: string, extra: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': tipo, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', ...extra });
  res.end(corpo);
}
const json = (res: ServerResponse, status: number, dados: unknown) => enviar(res, status, JSON.stringify(dados), TIPOS['.json']!);

async function lerCorpo(req: IncomingMessage, limite: number): Promise<Buffer> {
  const tamanho = Number(req.headers['content-length'] ?? 0);
  if (tamanho > limite) throw new ErroConteudo('O arquivo é grande demais.', 'muito-grande');
  const partes: Buffer[] = [];
  let total = 0;
  for await (const parte of req) {
    total += (parte as Buffer).length;
    if (total > limite) throw new ErroConteudo('O arquivo é grande demais.', 'muito-grande');
    partes.push(parte as Buffer);
  }
  return Buffer.concat(partes);
}

async function lerJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new ErroHttp(415, 'Envie os dados em JSON.');
  const bruto = (await lerCorpo(req, 2_000_000)).toString('utf8');
  try {
    const d = JSON.parse(bruto || '{}');
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error();
    return d as Record<string, unknown>;
  } catch {
    throw new ErroHttp(400, 'O JSON enviado está quebrado.');
  }
}

const texto = (v: unknown, campo: string): string => {
  if (typeof v !== 'string') throw new ErroHttp(400, `Faltou o campo "${campo}".`);
  return v;
};
const lista = (v: unknown, campo: string): string[] => {
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) throw new ErroHttp(400, `"${campo}" precisa ser uma lista de caminhos.`);
  return v as string[];
};
const cabecalho = (req: IncomingMessage, nome: string) => {
  const v = req.headers[nome];
  return typeof v === 'string' ? decodeURIComponent(v) : '';
};
const existe = (p: string) => stat(p).then(() => true, () => false);

export function criarServidor(o: OpcoesServidor): Server {
  const { raiz, ia, motor, pastaSaida, radar } = o;
  const limiteUpload = o.limiteUpload ?? 200 * 1024 * 1024;
  const limiteReferencia = o.limiteReferencia ?? 1024 * 1024 * 1024;
  const urlSaida = (abs: string) => '/api/saida/' + path.relative(pastaSaida, abs).split(path.sep).map(encodeURIComponent).join('/');

  const fila = new Fila({
    video: async (e, progredir) => {
      const { roteiro, destino } = e as { roteiro: unknown; destino: string };
      return urlSaida(await motor.video(roteiro, destino, progredir));
    },
    carrossel: async (e, progredir) => {
      const { slides, pasta } = e as { slides: unknown; pasta: string };
      progredir('desenhando os slides');
      return urlSaida((await motor.slides(slides, pasta)).zip);
    },
    referencia: async (e, progredir) => {
      const { arquivo } = e as { arquivo: string };
      progredir('extraindo ritmo, quadros, fala e cores; depois a IA analisa');
      const r = await analisarReferencia(raiz, arquivo, ia, { extrair: o.extrairReferencia });
      return r.analise;
    },
  });

  async function contexto(q?: Quadro): Promise<Contexto> {
    const fontes: Contexto['fontes'] = [];
    for (const f of q?.fontes.filter((x) => x.ativo) ?? []) {
      try {
        fontes.push({ caminho: f.caminho, texto: (await lerTexto(raiz, f.caminho)).slice(0, 4000) });
      } catch {
        // fonte apagada ou binária: segue sem ela
      }
    }
    return { marca: await contextoDaMarca(raiz), fontes };
  }

  async function lerQuadroDe(caminho: string) {
    if (!caminho.endsWith('.quadro.json')) throw new ErroHttp(400, 'Isso não é um quadro.');
    return lerQuadro(await lerTexto(raiz, caminho));
  }

  function ordemDe(q: Quadro) {
    if (q.tipo === 'video') {
      const r = ordenarVideo(q);
      return { cenas: r.cenas.map((c) => c.fala.id), problemas: r.problemas };
    }
    const r = ordenarCarrossel(q);
    return { slides: r.slides.map((s) => s.id), problemas: r.problemas };
  }

  /** Registra na memória da marca o que a pessoa mudou em campos que a IA tinha preenchido. */
  async function aprenderEdicoes(antigo: Quadro | null, novo: Quadro): Promise<Quadro> {
    if (!antigo) return novo;
    const cartoes = [];
    for (const c of novo.cartoes) {
      const velho = antigo.cartoes.find((x) => x.id === c.id);
      const marcados = velho?.geradoPorIA ?? [];
      if (!velho || !marcados.length) {
        cartoes.push(c.geradoPorIA && !velho ? { ...c, geradoPorIA: undefined } : c);
        continue;
      }
      const ficam: string[] = [];
      for (const campo of marcados) {
        const antes = velho.campos[campo] ?? '';
        const depois = c.campos[campo] ?? '';
        if (antes === depois) ficam.push(campo);
        else await registrar(raiz, { tipo: 'edicao-apos-ia', dados: { campo, antes, depois, quadro: novo.nome } });
      }
      const { geradoPorIA: _, ...resto } = c;
      cartoes.push(ficam.length ? { ...resto, geradoPorIA: ficam } : resto);
    }
    return { ...novo, cartoes };
  }

  let consolidando = false;
  async function talvezConsolidar() {
    if (consolidando || !(await precisaConsolidar(raiz))) return;
    consolidando = true;
    consolidar(raiz, ia).catch(() => {}).finally(() => { consolidando = false; });
  }

  async function caminhoLivre(pasta: string, base: string, ext: string) {
    for (let n = 1; ; n++) {
      const rel = `${pasta ? `${pasta}/` : ''}${base}${n > 1 ? ` (${n})` : ''}${ext}`;
      if (!(await existe(resolver(raiz, rel)))) return rel;
    }
  }

  async function servirEstatico(res: ServerResponse, rota: string) {
    if (!o.estatico) return enviar(res, 404, 'Não encontrado.', TIPOS['.txt']!);
    const base = path.resolve(o.estatico);
    let arquivo = path.resolve(base, '.' + decodeURIComponent(rota));
    if (!arquivo.startsWith(base)) return enviar(res, 404, 'Não encontrado.', TIPOS['.txt']!);
    if (rota === '/' || !(await existe(arquivo)) || (await stat(arquivo)).isDirectory()) arquivo = path.join(base, 'index.html');
    try {
      enviar(res, 200, await readFile(arquivo), tipoDoArquivo(arquivo), arquivo.endsWith('index.html') ? {} : { 'Cache-Control': 'max-age=3600' });
    } catch {
      enviar(res, 404, 'A interface ainda não foi construída. Rode: npm run build', TIPOS['.txt']!);
    }
  }

  async function tratar(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const rota = url.pathname;
    const m = req.method ?? 'GET';
    const q = (nome: string) => url.searchParams.get(nome) ?? '';
    const r = `${m} ${rota}`;

    // ---------- conteúdos
    if (r === 'GET /api/arvore') return json(res, 200, { itens: await listarArvore(raiz) });
    if (r === 'POST /api/pastas') return json(res, 201, { caminho: await criarPasta(raiz, texto((await lerJson(req)).caminho, 'caminho')) });
    if (r === 'POST /api/notas') {
      const d = await lerJson(req);
      return json(res, 201, { caminho: await criarNota(raiz, texto(d.caminho, 'caminho'), typeof d.conteudo === 'string' ? d.conteudo : '') });
    }
    if (r === 'GET /api/nota') {
      const caminho = q('caminho');
      const conteudo = await lerTexto(raiz, caminho);
      const todos = (await listarArquivos(raiz)).map((a) => a.caminho);
      const ligacoes = extrairLigacoes(conteudo).map((l) => ({ alvo: l.alvo, caminho: resolverAlvo(l.alvo, todos) }));
      const retroligacoes: string[] = [];
      for (const outro of todos.filter((c) => c.endsWith('.md') && c !== caminho)) {
        const t = await lerTexto(raiz, outro).catch(() => '');
        if (extrairLigacoes(t).some((l) => resolverAlvo(l.alvo, todos) === caminho)) retroligacoes.push(outro);
      }
      return json(res, 200, { caminho, conteudo, ligacoes, retroligacoes });
    }
    if (r === 'PUT /api/nota') {
      const d = await lerJson(req);
      await salvarTexto(raiz, texto(d.caminho, 'caminho'), texto(d.conteudo, 'conteudo'));
      return json(res, 200, { ok: true });
    }
    if (r === 'POST /api/renomear') {
      const d = await lerJson(req);
      return json(res, 200, { caminho: await renomear(raiz, texto(d.caminho, 'caminho'), texto(d.nome, 'nome')) });
    }
    if (r === 'POST /api/mover') {
      const d = await lerJson(req);
      return json(res, 200, { novos: await mover(raiz, lista(d.caminhos, 'caminhos'), typeof d.destino === 'string' ? d.destino : '') });
    }
    if (r === 'POST /api/excluir') return json(res, 200, { ids: await excluir(raiz, lista((await lerJson(req)).caminhos, 'caminhos')) });
    if (r === 'GET /api/lixeira') return json(res, 200, { itens: await listarLixeira(raiz) });
    if (r === 'POST /api/lixeira/restaurar') return json(res, 200, { caminho: await restaurar(raiz, texto((await lerJson(req)).id, 'id')) });
    if (r === 'POST /api/lixeira/esvaziar') {
      await lerJson(req);
      return json(res, 200, { apagados: await esvaziarLixeira(raiz) });
    }
    if (r === 'POST /api/anexos') {
      const nome = cabecalho(req, 'x-nome');
      if (!nome) throw new ErroHttp(400, 'Faltou o nome do arquivo.');
      const dados = await lerCorpo(req, limiteUpload);
      return json(res, 201, { caminho: await anexar(raiz, cabecalho(req, 'x-pasta'), nome, dados) });
    }
    if (r === 'GET /api/arquivo') {
      const caminho = q('caminho');
      const extra: Record<string, string> = path.extname(caminho).toLowerCase() === '.svg' ? { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } : {};
      return enviar(res, 200, await lerBinario(raiz, caminho), tipoDoArquivo(caminho), extra);
    }
    if (r === 'GET /api/grafo') return json(res, 200, await montarGrafo(raiz));
    if (r === 'GET /api/catalogo') return json(res, 200, CATALOGO);

    // ---------- quadros
    if (r === 'POST /api/quadros') {
      const d = await lerJson(req);
      const tipo = d.tipo === 'carrossel' ? 'carrossel' : d.tipo === 'video' ? 'video' : null;
      if (!tipo) throw new ErroHttp(400, 'O tipo do quadro precisa ser "video" ou "carrossel".');
      const nome = texto(d.nome, 'nome').trim();
      if (!nome) throw new ErroHttp(400, 'Dê um nome ao quadro.');
      const pasta = typeof d.pasta === 'string' ? d.pasta : '';
      const caminho = await criarTexto(raiz, `${pasta ? `${pasta}/` : ''}${nome}.quadro.json`, serializar(novoQuadro(tipo, nome)));
      return json(res, 201, { caminho });
    }
    if (r === 'GET /api/quadro') {
      const quadro = await lerQuadroDe(q('caminho'));
      return json(res, 200, { quadro, ordem: ordemDe(quadro) });
    }
    if (r === 'PUT /api/quadro') {
      const d = await lerJson(req);
      const caminho = texto(d.caminho, 'caminho');
      const novo = lerQuadro(JSON.stringify(d.quadro ?? null));
      const antigo = await lerQuadroDe(caminho).catch(() => null);
      const final = await aprenderEdicoes(antigo, novo);
      await salvarTexto(raiz, caminho, serializar(final));
      return json(res, 200, { quadro: final, ordem: ordemDe(final) });
    }
    if (r === 'POST /api/quadro/gerar') {
      const d = await lerJson(req);
      const caminho = texto(d.caminho, 'caminho');
      const cartaoId = texto(d.cartaoId, 'cartaoId');
      const quadro = await lerQuadroDe(caminho);
      const c = quadro.cartoes.find((x) => x.id === cartaoId);
      if (!c) throw new ErroHttp(404, 'Esse cartão não existe mais no quadro.');
      const ctx = await contexto(quadro);
      let campos: Record<string, string>;
      if (c.tipo === 'fala') campos = await gerarFala(ia, quadro, cartaoId, ctx);
      else if (c.tipo === 'slide') {
        const s = await gerarSlide(ia, quadro, cartaoId, ctx);
        campos = { modelo: s.modelo, ...s.campos };
      } else throw new ErroHttp(400, 'A IA preenche falas e slides; transições e animações você escolhe no catálogo.');
      const cartao = { ...c, campos: c.tipo === 'slide' ? campos : { ...c.campos, ...campos }, geradoPorIA: Object.keys(campos) };
      const final = { ...quadro, cartoes: quadro.cartoes.map((x) => (x.id === cartaoId ? cartao : x)) };
      await salvarTexto(raiz, caminho, serializar(final));
      await registrar(raiz, { tipo: 'geracao-ia', dados: { oque: c.tipo === 'fala' ? 'uma fala' : 'um slide', quadro: quadro.nome } });
      return json(res, 200, { cartao, quadro: final, ordem: ordemDe(final) });
    }
    if (r === 'POST /api/quadro/previa') {
      const d = await lerJson(req);
      const quadro = await lerQuadroDe(texto(d.caminho, 'caminho'));
      const cartaoId = texto(d.cartaoId, 'cartaoId');
      if (quadro.tipo === 'video') {
        const { cenas } = ordenarVideo(quadro);
        const cena = cenas.find((c) => c.fala.id === cartaoId || c.animacoes.some((a) => a.id === cartaoId) || c.transicao?.id === cartaoId);
        if (!cena) throw new ErroHttp(404, 'Ligue esse cartão a uma fala para ver a prévia.');
        const entrada = roteiroParaMotor(quadro, [cena], await lerPronuncias(raiz)).cenas[0]!;
        const chave = createHash('sha1').update(JSON.stringify(entrada)).digest('hex').slice(0, 16);
        const destino = path.join(pastaSaida, 'previas', `cena-${chave}.png`);
        if (!(await existe(destino))) await motor.cena({ ...entrada, legenda: quadro.legenda }, destino);
        return json(res, 200, { imagem: urlSaida(destino) });
      }
      const { slides } = ordenarCarrossel(quadro);
      const i = slides.findIndex((s) => s.id === cartaoId);
      if (i < 0) throw new ErroHttp(404, 'Esse slide não está no carrossel.');
      const entrada = { ...slidesParaMotor(slides), so: i };
      const chave = createHash('sha1').update(JSON.stringify(entrada)).digest('hex').slice(0, 16);
      const pasta = path.join(pastaSaida, 'previas', `slides-${chave}`);
      const arq = path.join(pasta, `slide-${String(i + 1).padStart(2, '0')}.png`);
      if (!(await existe(arq))) await motor.slides(entrada, pasta);
      return json(res, 200, { imagem: urlSaida(arq) });
    }
    if (r === 'POST /api/quadro/produzir') {
      const d = await lerJson(req);
      const quadro = await lerQuadroDe(texto(d.caminho, 'caminho'));
      const ordem = ordemDe(quadro);
      const erros = ordem.problemas.filter((p) => p.nivel === 'erro');
      if (erros.length) throw new ErroHttp(422, erros.map((p) => p.mensagem).join(' '));
      const nome = `${slug(quadro.nome)}-${dataLocal(new Date())}-${Date.now().toString(36)}`;
      let tarefa;
      if (quadro.tipo === 'video') {
        const roteiro = roteiroParaMotor(quadro, ordenarVideo(quadro).cenas, await lerPronuncias(raiz));
        tarefa = fila.adicionar('video', `Vídeo: ${quadro.nome}`, { roteiro, destino: path.join(pastaSaida, 'videos', `${nome}.mp4`) });
      } else {
        const slides = slidesParaMotor(ordenarCarrossel(quadro).slides);
        tarefa = fila.adicionar('carrossel', `Carrossel: ${quadro.nome}`, { slides, pasta: path.join(pastaSaida, 'carrosseis', nome) });
      }
      await registrar(raiz, { tipo: 'quadro-produzido', dados: { nome: quadro.nome, tipo: quadro.tipo, ...escolhasDoQuadro(quadro) } });
      void talvezConsolidar();
      return json(res, 202, { tarefa });
    }

    // ---------- tarefas e arquivos produzidos
    if (r === 'GET /api/tarefas') return json(res, 200, { tarefas: fila.listar() });
    const tarefaId = rota.match(/^\/api\/tarefas\/([\w-]+)$/);
    if (m === 'GET' && tarefaId) {
      const t = fila.obter(tarefaId[1]!);
      if (!t) throw new ErroHttp(404, 'Tarefa não encontrada.');
      return json(res, 200, t);
    }
    if (m === 'GET' && rota.startsWith('/api/saida/')) {
      const rel = rota.slice('/api/saida/'.length).split('/').map(decodeURIComponent).join('/');
      const abs = resolver(pastaSaida, rel);
      try {
        return enviar(res, 200, await readFile(abs), tipoDoArquivo(abs));
      } catch {
        throw new ErroHttp(404, 'Arquivo não encontrado.');
      }
    }
    if (r === 'GET /api/producoes') {
      const itens: { tipo: string; nome: string; url: string; imagens?: string[]; quando: string }[] = [];
      for (const [tipo, pasta] of [['video', 'videos'], ['carrossel', 'carrosseis']] as const) {
        const dir = path.join(pastaSaida, pasta);
        for (const n of (await readdir(dir).catch(() => [] as string[]))) {
          const abs = path.join(dir, n);
          const s = await stat(abs);
          if (tipo === 'video' && n.endsWith('.mp4')) itens.push({ tipo, nome: n, url: urlSaida(abs), quando: s.mtime.toISOString() });
          if (tipo === 'carrossel' && s.isDirectory()) {
            const imgs = (await readdir(abs)).filter((x) => /^slide-\d+\.png$/.test(x)).sort().map((x) => urlSaida(path.join(abs, x)));
            itens.push({ tipo, nome: n, url: urlSaida(path.join(abs, 'carrossel.zip')), imagens: imgs, quando: s.mtime.toISOString() });
          }
        }
      }
      return json(res, 200, { itens: itens.sort((a, b) => b.quando.localeCompare(a.quando)) });
    }

    // ---------- sugestões e radar
    if (r === 'GET /api/sugestoes') return json(res, 200, { sugestoes: await lerSugestoes(raiz) });
    if (r === 'POST /api/sugestoes/quadro') {
      const d = await lerJson(req);
      const caminho = texto(d.caminho, 'caminho');
      const tipo: TipoQuadro = d.tipo === 'carrossel' ? 'carrossel' : 'video';
      const { corpo } = lerFrente(await lerTexto(raiz, caminho));
      const titulo = corpo.match(/^# (.+)$/m)?.[1]?.trim() ?? path.posix.basename(caminho, '.md');
      const quadro = await quadroDeSugestao(ia, { titulo, texto: corpo }, tipo, await contexto());
      const destino = await caminhoLivre('quadros', slug(quadro.nome || titulo), '.quadro.json');
      await mkdir(resolver(raiz, 'quadros'), { recursive: true });
      const final = { ...quadro, fontes: [{ caminho, ativo: true }] };
      await criarTexto(raiz, destino, serializar(final));
      await marcarSugestao(raiz, caminho, 'usada');
      await registrar(raiz, { tipo: 'sugestao-usada', dados: { titulo, tipo } });
      return json(res, 201, { caminho: destino });
    }
    if (r === 'POST /api/sugestoes/descartar') {
      const caminho = texto((await lerJson(req)).caminho, 'caminho');
      const { titulo } = await marcarSugestao(raiz, caminho, 'descartada');
      await registrar(raiz, { tipo: 'sugestao-descartada', dados: { titulo } });
      return json(res, 200, { ok: true });
    }
    if (r === 'GET /api/radar') {
      await radar.pronto();
      return json(res, 200, { estado: radar.estado(), config: radar.config() });
    }
    if (r === 'POST /api/radar/agora') {
      await lerJson(req);
      return json(res, 200, await radar.cicloAgora());
    }
    if (r === 'POST /api/radar/pausar') {
      await lerJson(req);
      radar.pausar();
      return json(res, 200, radar.estado());
    }
    if (r === 'POST /api/radar/retomar') {
      await lerJson(req);
      void radar.retomar();
      await new Promise((ok) => setTimeout(ok, 10));
      return json(res, 200, radar.estado());
    }
    if (r === 'PUT /api/radar/config') {
      const d = await lerJson(req);
      try {
        return json(res, 200, { config: await radar.atualizarConfig(d) });
      } catch (e) {
        throw new ErroHttp(400, (e as Error).message);
      }
    }

    // ---------- branding
    if (r === 'GET /api/branding') {
      const eventos = await lerEventos(raiz);
      const perfil = await lerTexto(raiz, 'branding/aprendizados/perfil.md').catch(() => '');
      return json(res, 200, { eventos: eventos.length, preferencias: calcularPreferencias(eventos), perfil,
        recentes: eventos.slice(-12).reverse(), marca: await lerMarca(raiz) });
    }
    if (r === 'POST /api/branding/consolidar') {
      await lerJson(req);
      return json(res, 200, { perfil: await consolidar(raiz, ia) });
    }
    if (r === 'POST /api/branding/evento') {
      const d = await lerJson(req);
      if (!(TIPOS_EVENTO as readonly string[]).includes(String(d.tipo))) throw new ErroHttp(400, 'Tipo de evento desconhecido.');
      const dados = d.dados && typeof d.dados === 'object' ? (d.dados as Record<string, unknown>) : {};
      const total = await registrar(raiz, { tipo: d.tipo as TipoEvento, dados });
      void talvezConsolidar();
      return json(res, 201, total);
    }

    // ---------- roubar ideias
    if (r === 'POST /api/referencias') {
      const nome = cabecalho(req, 'x-nome');
      if (!nome) throw new ErroHttp(400, 'Faltou o nome do arquivo.');
      if (!classificarMidia(nome)) throw new ErroHttp(400, 'Não sei analisar esse formato. Use vídeo, áudio, imagem ou texto.');
      const dados = await lerCorpo(req, limiteReferencia);
      const base = `${dataLocal(new Date())}-${slug(path.parse(nome).name, 40)}`;
      const pasta = await caminhoLivre('referencias', base, '');
      await mkdir(resolver(raiz, pasta), { recursive: true });
      const arquivo = await anexar(raiz, pasta, nome, dados);
      const tarefa = fila.adicionar('referencia', `Roubar ideias: ${nome}`, { arquivo });
      return json(res, 202, { tarefa, pasta, arquivo });
    }
    if (r === 'GET /api/referencias') {
      const dir = resolver(raiz, 'referencias');
      const referencias = [];
      for (const n of (await readdir(dir).catch(() => [] as string[])).filter((x) => !x.startsWith('.'))) {
        const pasta = `referencias/${n}`;
        if (!(await stat(path.join(dir, n))).isDirectory()) continue;
        const arquivos = await readdir(path.join(dir, n));
        const midia = arquivos.find((x) => classificarMidia(x) && !/^quadro-\d+\.jpg$/.test(x) && x !== 'audio-16k.wav' && x !== 'analise.md') ?? '';
        let analise: { resumo?: string; tecnicas?: unknown[]; ideias?: unknown[]; ritmo?: string; cores?: string[] } = {};
        try {
          analise = JSON.parse(await readFile(path.join(dir, n, '.analise.json'), 'utf8'));
        } catch {
          // ainda analisando, ou analisada antes da cópia estruturada existir
        }
        referencias.push({ pasta, titulo: n, midia: midia ? `${pasta}/${midia}` : '', analisada: arquivos.includes('analise.md'),
          resumo: analise.resumo ?? '', ritmo: analise.ritmo ?? '', cores: analise.cores ?? [], tecnicas: analise.tecnicas ?? [], ideias: analise.ideias ?? [] });
      }
      return json(res, 200, { referencias: referencias.sort((a, b) => b.titulo.localeCompare(a.titulo)) });
    }
    if (r === 'GET /api/videos') {
      const dir = path.join(pastaSaida, 'videos');
      const videos = [];
      for (const n of (await readdir(dir).catch(() => [] as string[])).filter((x) => x.endsWith('.mp4'))) {
        videos.push({ nome: n, caminho: `videos/${n}`, url: urlSaida(path.join(dir, n)), quando: (await stat(path.join(dir, n))).mtime.toISOString() });
      }
      return json(res, 200, { videos: videos.sort((a, b) => b.quando.localeCompare(a.quando)) });
    }
    if (r === 'POST /api/referencias/previa') {
      const d = await lerJson(req);
      const rel = texto(d.video, 'video');
      const efeito = texto(d.efeito, 'efeito');
      if (!(CATALOGO.transicoes as readonly string[]).includes(efeito)) throw new ErroHttp(400, 'Esse efeito não existe no motor.');
      if (!rel.startsWith('videos/')) throw new ErroHttp(400, 'Escolha um dos seus vídeos.');
      const abs = resolver(pastaSaida, rel);
      if (!(await existe(abs))) throw new ErroHttp(404, 'Vídeo não encontrado.');
      const inicio = Number(d.inicio ?? 0) || 0;
      const destino = path.join(pastaSaida, 'previas', `tecnica-${efeito}-${createHash('sha1').update(`${rel}|${inicio}`).digest('hex').slice(0, 10)}.mp4`);
      if (!(await existe(destino))) await motor.tecnica({ video: abs, inicio, efeito }, destino);
      return json(res, 200, { video: urlSaida(destino) });
    }

    if (o.extra && (await o.extra(req, res, rota))) return;
    if (rota.startsWith('/api/')) throw new ErroHttp(404, 'Essa rota não existe.');
    if (m === 'GET') return servirEstatico(res, rota);
    throw new ErroHttp(405, 'Método não permitido.');
  }

  return createServer((req, res) => {
    tratar(req, res).catch((e: unknown) => {
      if (res.headersSent) return res.end();
      if (e instanceof ErroHttp) return json(res, e.status, { erro: e.message });
      if (e instanceof ErroConteudo) return json(res, STATUS_CONTEUDO[e.codigo] ?? 400, { erro: e.message, codigo: e.codigo });
      if (e instanceof ErroQuadro) return json(res, 422, { erro: e.message });
      if (e instanceof ErroIA) return json(res, 502, { erro: e.message });
      console.error(e);
      json(res, 500, { erro: e instanceof Error ? e.message : 'Erro inesperado.' });
    });
  });
}
