import { execFile } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { contextoDaMarca, registrar } from '../branding/memoria.ts';
import { resolver } from '../conteudo/caminhos.ts';
import { escreverFrente } from '../conteudo/ligacoes.ts';
import { dataLocal, slug } from '../conteudo/slug.ts';
import { extrairJson, type IA } from '../ia/ia.ts';
import { CATALOGO } from '../quadro/quadro.ts';

/**
 * Roubar ideias (como artista): a pessoa joga um vídeo, áudio, imagem ou texto e o app extrai o que dá localmente
 * (ritmo, cortes, quadros-chave, transcrição, cores). A IA analisa olhando os quadros e devolve técnicas e ideias
 * ADAPTADAS para a marca. Regra: pegar a ideia como referência, nunca copiar. Uma trava descarta ideias que
 * repetem trechos da fala original.
 */

const exec = promisify(execFile);
export type TipoMidia = 'video' | 'audio' | 'imagem' | 'texto';

export interface Extracao {
  tipo: TipoMidia;
  duracao: number;
  largura: number;
  altura: number;
  cortes: number[];
  quadros: string[];
  transcricao: string;
  palavras: number;
  cores: string[];
}

const EXTENSOES: Record<TipoMidia, string[]> = {
  video: ['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus'],
  imagem: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'],
  texto: ['.txt', '.md', '.srt', '.vtt'],
};

export function classificarMidia(nome: string): TipoMidia | null {
  const ext = path.extname(nome).toLowerCase();
  for (const [tipo, exts] of Object.entries(EXTENSOES)) if (exts.includes(ext)) return tipo as TipoMidia;
  return null;
}

const palavrasDe = (t: string) => t.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);

/** Verdadeiro se o texto repete n ou mais palavras seguidas da transcrição original. */
export function trechoCopiado(texto: string, transcricao: string, n = 8): boolean {
  const orig = palavrasDe(transcricao);
  if (orig.length < n) return false;
  const grams = new Set<string>();
  for (let i = 0; i + n <= orig.length; i++) grams.add(orig.slice(i, i + n).join(' '));
  const novo = palavrasDe(texto);
  for (let i = 0; i + n <= novo.length; i++) if (grams.has(novo.slice(i, i + n).join(' '))) return true;
  return false;
}

async function sondar(arquivo: string) {
  const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', arquivo]);
  const j = JSON.parse(stdout) as { format?: { duration?: string }; streams?: { codec_type: string; width?: number; height?: number }[] };
  const v = j.streams?.find((s) => s.codec_type === 'video');
  return { duracao: Number(j.format?.duration ?? 0) || 0, largura: v?.width ?? 0, altura: v?.height ?? 0, temAudio: !!j.streams?.some((s) => s.codec_type === 'audio') };
}

async function detectarCortes(arquivo: string): Promise<number[]> {
  const { stderr } = await exec('ffmpeg', ['-hide_banner', '-i', arquivo, '-vf', "select='gt(scene,0.3)',showinfo", '-an', '-f', 'null', '-'],
    { maxBuffer: 64 * 1024 * 1024 });
  return [...stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Math.round(Number(m[1]) * 100) / 100);
}

async function quadroEm(arquivo: string, t: number, destino: string) {
  await exec('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(t), '-i', arquivo, '-frames:v', '1', '-vf', 'scale=480:-2', destino]);
}

async function paleta(imagem: string): Promise<string[]> {
  const codigo = 'import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert("RGB").resize((64,64))\n' +
    'q=im.quantize(5)\np=q.getpalette()[:15]\ncont=sorted(q.getcolors(),reverse=True)\n' +
    'print(" ".join("#%02x%02x%02x"%tuple(p[i*3:i*3+3]) for _,i in cont))';
  try {
    const { stdout } = await exec('python3', ['-c', codigo, imagem]);
    return stdout.trim().split(/\s+/).filter((c) => /^#[0-9a-f]{6}$/.test(c));
  } catch {
    return [];
  }
}

export type Transcritor = (audioWav: string) => Promise<{ texto: string; palavras: number }>;

/** Transcrição local com o Whisper do ambiente amostras/.venv-asr, quando ele existe. */
export function transcritorPadrao(pastaAmostras: string): Transcritor {
  return async (wav) => {
    const python = path.join(pastaAmostras, '.venv-asr', 'bin', 'python');
    try {
      await stat(python);
    } catch {
      return { texto: '', palavras: 0 };
    }
    const { stdout } = await exec(python, [path.join(pastaAmostras, 'transcrever.py'), wav], { maxBuffer: 16 * 1024 * 1024, timeout: 15 * 60_000 });
    const j = JSON.parse(stdout.trim().split('\n').pop() ?? '{}') as { texto?: string };
    const texto = j.texto ?? '';
    return { texto, palavras: palavrasDe(texto).length };
  };
}

export async function extrairMidia(arquivo: string, pasta: string, opcoes: { transcrever?: Transcritor } = {}): Promise<Extracao> {
  const tipo = classificarMidia(arquivo);
  if (!tipo) throw new Error('Formato não suportado para análise.');
  await mkdir(pasta, { recursive: true });
  const e: Extracao = { tipo, duracao: 0, largura: 0, altura: 0, cortes: [], quadros: [], transcricao: '', palavras: 0, cores: [] };
  if (tipo === 'texto') {
    e.transcricao = (await readFile(arquivo, 'utf8')).slice(0, 20_000);
    e.palavras = palavrasDe(e.transcricao).length;
    return e;
  }
  const s = await sondar(arquivo);
  Object.assign(e, { duracao: s.duracao, largura: s.largura, altura: s.altura });
  if (tipo === 'video' || tipo === 'imagem') {
    if (tipo === 'video') e.cortes = await detectarCortes(arquivo);
    const tempos = tipo === 'video' ? [Math.min(0.5, s.duracao / 2), ...e.cortes.map((c) => c + 0.1)].slice(0, 8) : [0];
    for (const [i, t] of tempos.entries()) {
      const nome = `quadro-${i + 1}.jpg`;
      try {
        await quadroEm(arquivo, t, path.join(pasta, nome));
        e.quadros.push(nome);
      } catch {
        // quadro além do fim: ignora
      }
    }
    if (e.quadros[0]) e.cores = await paleta(path.join(pasta, e.quadros[0]));
  }
  if ((tipo === 'video' && s.temAudio) || tipo === 'audio') {
    const wav = path.join(pasta, 'audio-16k.wav');
    await exec('ffmpeg', ['-y', '-loglevel', 'error', '-i', arquivo, '-ac', '1', '-ar', '16000', wav]);
    const t = await (opcoes.transcrever ?? (async () => ({ texto: '', palavras: 0 })))(wav);
    e.transcricao = t.texto;
    e.palavras = t.palavras;
  }
  return e;
}

export function promptAnalise(e: Extracao, marca: string, pastaRel: string) {
  const media = e.cortes.length ? (e.duracao / (e.cortes.length + 1)).toFixed(1) : e.duracao ? e.duracao.toFixed(1) : '-';
  const sistema = `Você estuda referências para a marca descrita no pedido como um artista que "rouba como artista": usa a peça só como referência,
para entender ideias, estruturas e técnicas. Regras: não copie falas, textos, imagens, personagens, marcas nem músicas;
descreva técnicas com suas palavras; toda ideia precisa ser adaptada para a voz, o personagem e a identidade dessa marca,
com falas novas. Responda SOMENTE com JSON válido.`;
  const prompt = `Analise esta referência (${e.tipo}). Os quadros-chave estão na pasta liberada para leitura: ${e.quadros.join(', ') || 'nenhum'}.
Dados extraídos: duração ${e.duracao.toFixed(1)} s; ${e.cortes.length} cortes (plano médio de ${media} s); tamanho ${e.largura}x${e.altura};
cores principais ${e.cores.join(', ') || 'não medidas'}; ${e.palavras} palavras faladas.
Transcrição (só para entender a estrutura; não copie): """${e.transcricao.slice(0, 6000) || 'sem fala'}"""

Extraia: resumo; estrutura (gancho, desenvolvimento, fechamento); ritmo; técnicas (transições, textos na tela, câmera, sons,
memes, roteiro), cada uma com "efeito_proximo", o efeito do motor mais parecido (${CATALOGO.transicoes.join(', ')});
humor; e até 3 ideias ADAPTADAS para a marca (título, como adaptar, formato video|carrossel|ambos, fala sugerida nova).

Marca:
${marca}

Responda com: {"resumo": "", "estrutura": {"gancho": "", "desenvolvimento": "", "fechamento": ""}, "ritmo": "",
"tecnicas": [{"nome": "", "tipo": "transicao|texto|camera|som|meme|roteiro", "como_usar": "", "efeito_proximo": ""}], "humor": [],
"ideias": [{"titulo": "", "como_adaptar": "", "formato": "", "fala_sugerida": ""}]}`;
  return { sistema, prompt, leitura: pastaRel };
}

export interface Tecnica { nome: string; tipo: string; como_usar: string; efeito_proximo: string }
export interface Ideia { titulo: string; como_adaptar: string; formato: 'video' | 'carrossel' | 'ambos'; fala_sugerida: string }
export interface Analise {
  resumo: string;
  estrutura: { gancho: string; desenvolvimento: string; fechamento: string };
  ritmo: string;
  tecnicas: Tecnica[];
  humor: string[];
  ideias: Ideia[];
  descartadas: number;
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function validarAnalise(json: unknown, e: Extracao): Analise {
  const j = (json ?? {}) as Record<string, unknown>;
  const est = (j.estrutura ?? {}) as Record<string, unknown>;
  const tecnicas = (Array.isArray(j.tecnicas) ? j.tecnicas : []).filter((t: Record<string, unknown>) => s(t?.nome)).slice(0, 8)
    .map((t: Record<string, unknown>) => ({ nome: s(t.nome), tipo: s(t.tipo) || 'roteiro', como_usar: s(t.como_usar),
      efeito_proximo: (CATALOGO.transicoes as readonly string[]).includes(s(t.efeito_proximo)) ? s(t.efeito_proximo) : 'dissolucao' }));
  let descartadas = 0;
  const ideias: Ideia[] = [];
  for (const i of Array.isArray(j.ideias) ? j.ideias : []) {
    const ideia = { titulo: s(i?.titulo), como_adaptar: s(i?.como_adaptar),
      formato: (['video', 'carrossel', 'ambos'].includes(s(i?.formato)) ? s(i?.formato) : 'ambos') as Ideia['formato'], fala_sugerida: s(i?.fala_sugerida) };
    if (!ideia.titulo || !ideia.como_adaptar) continue;
    if (trechoCopiado(`${ideia.titulo} ${ideia.como_adaptar} ${ideia.fala_sugerida}`, e.transcricao)) { descartadas++; continue; }
    ideias.push(ideia);
  }
  return { resumo: s(j.resumo), estrutura: { gancho: s(est.gancho), desenvolvimento: s(est.desenvolvimento), fechamento: s(est.fechamento) },
    ritmo: s(j.ritmo), tecnicas, humor: (Array.isArray(j.humor) ? j.humor : []).map(s).filter(Boolean), ideias: ideias.slice(0, 5), descartadas };
}

const absDe = (raiz: string, rel: string) => path.join(raiz, ...rel.split('/'));
const existe = (p: string) => stat(p).then(() => true, () => false);
async function escrever(raiz: string, rel: string, texto: string) {
  await mkdir(path.dirname(absDe(raiz, rel)), { recursive: true });
  await writeFile(absDe(raiz, rel), texto);
}

export async function gravarAnalise(raiz: string, pastaRel: string, a: Analise, e: Extracao, agora = new Date()) {
  const hoje = dataLocal(agora);
  const criadas: string[] = [];
  const sugestoes: string[] = [];
  const analiseRel = `${pastaRel}/analise.md`;
  const corpo = `# Análise da referência

> Só referência: pegamos a ideia, não o conteúdo. Nada desta peça (falas, imagens, marca, música) vai para a nossa marca;
> as ideias abaixo foram reescritas para a nossa voz e o nosso personagem.

## Resumo

${a.resumo || 'sem resumo'}

## Estrutura

- Gancho: ${a.estrutura.gancho || '-'}
- Desenvolvimento: ${a.estrutura.desenvolvimento || '-'}
- Fechamento: ${a.estrutura.fechamento || '-'}

## Ritmo

${a.ritmo || '-'} (${e.duracao.toFixed(1)} s, ${e.cortes.length} cortes)

## Técnicas

${a.tecnicas.map((t) => `- [[${slug(t.nome)}]] (${t.tipo}): ${t.como_usar} Efeito mais próximo no nosso motor: ${t.efeito_proximo}.`).join('\n') || '- nenhuma'}

## Humor

${a.humor.map((h) => `- ${h}`).join('\n') || '- nenhum'}

## Ideias para a marca

${a.ideias.map((i) => `- [[${slug(i.titulo)}]] (${i.formato}): ${i.como_adaptar}`).join('\n') || '- nenhuma'}
${a.descartadas ? `\n${a.descartadas} ideia(s) descartada(s) por repetir a fala original.\n` : ''}`;
  await escrever(raiz, analiseRel, escreverFrente({ tipo: 'referencia', midia: e.tipo, data: hoje, duracao: e.duracao.toFixed(1) }, corpo));
  criadas.push(analiseRel);
  // cópia estruturada para a tela (arquivo oculto: não aparece na barra lateral nem no grafo)
  await escrever(raiz, `${pastaRel}/.analise.json`, JSON.stringify({ ...a, data: hoje, duracao: e.duracao, cortes: e.cortes.length, cores: e.cores }, null, 2));
  for (const t of a.tecnicas) {
    const rel = `conhecimento/tecnicas/${slug(t.nome)}.md`;
    if (await existe(absDe(raiz, rel))) {
      const atual = await readFile(absDe(raiz, rel), 'utf8');
      await writeFile(absDe(raiz, rel), `${atual.replace(/\n*$/, '\n')}\n- Vista também em [[${pastaRel}/analise]] (${hoje}).\n`);
      continue;
    }
    await escrever(raiz, rel, escreverFrente({ tipo: 'tecnica', categoria: t.tipo, efeito_proximo: t.efeito_proximo, data: hoje },
      `# ${t.nome}\n\nStatus: sugestão vinda de referência (não está no catálogo aprovado).\n\n${t.como_usar}\n\n` +
      `Efeito mais próximo no motor: ${t.efeito_proximo}.\n\nVista em [[${pastaRel}/analise]].\n`));
    criadas.push(rel);
  }
  for (const i of a.ideias) {
    const rel = `conhecimento/sugestoes/${slug(i.titulo)}.md`;
    if (await existe(absDe(raiz, rel))) continue;
    await escrever(raiz, rel, escreverFrente({ tipo: 'sugestao', formato: i.formato, status: 'nova', criada: hoje, origem: 'referencia', referencia: pastaRel },
      `# ${i.titulo}\n\n**Como adaptar:** ${i.como_adaptar}\n\n**Fala sugerida:** ${i.fala_sugerida || 'a escrever'}\n\n` +
      `Inspirada (só como referência) em [[${pastaRel}/analise]].\n`));
    criadas.push(rel);
    sugestoes.push(rel);
  }
  return { criadas, sugestoes };
}

export async function analisarReferencia(raiz: string, arquivoRel: string, ia: IA,
  opcoes: { extrair?: (abs: string, pasta: string) => Promise<Extracao>; transcrever?: Transcritor; agora?: Date } = {}) {
  const pastaRel = path.posix.dirname(arquivoRel);
  const abs = resolver(raiz, arquivoRel);
  const pastaAbs = resolver(raiz, pastaRel);
  const extrair = opcoes.extrair ?? ((a, p) => extrairMidia(a, p, { transcrever: opcoes.transcrever }));
  const e = await extrair(abs, pastaAbs);
  const marca = await contextoDaMarca(raiz, 3000);
  const r = await ia.gerar(promptAnalise(e, marca, pastaRel));
  const a = validarAnalise(extrairJson(r.texto), e);
  const g = await gravarAnalise(raiz, pastaRel, a, e, opcoes.agora);
  await registrar(raiz, { tipo: 'referencia-analisada', dados: { nome: path.posix.basename(arquivoRel), ideias: a.ideias.length } }, opcoes.agora);
  return { analise: `${pastaRel}/analise.md`, sugestoes: g.sugestoes, extracao: e, tecnicas: a.tecnicas, resumo: a.resumo };
}
