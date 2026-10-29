import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ErroConteudo, nomeSeguro, normalizar, resolver } from './caminhos.ts';
import { substituirLigacoes } from './ligacoes.ts';

/**
 * A pasta de conteúdos ("cofre", como no Obsidian): pastas e arquivos reais em disco. Notas são .md, quadros
 * são .quadro.json e o resto é anexo. Itens que começam com ponto são do app (lixeira, estado) e não aparecem.
 */

export type TipoItem = 'pasta' | 'nota' | 'quadro' | 'anexo';
export interface Item {
  nome: string;
  caminho: string;
  tipo: TipoItem;
  filhos?: Item[];
}
export interface ItemLixeira {
  id: string;
  nome: string;
  origem: string;
  quando: string;
  tipo: TipoItem;
}

const LIXEIRA = '.lixeira';
const juntar = (pasta: string, nome: string) => (pasta ? `${pasta}/${nome}` : nome);
const ordem = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });

export function tipoDe(nome: string): Exclude<TipoItem, 'pasta'> {
  if (nome.endsWith('.quadro.json')) return 'quadro';
  if (nome.toLowerCase().endsWith('.md')) return 'nota';
  return 'anexo';
}

async function info(abs: string) {
  try {
    return await stat(abs);
  } catch {
    return null;
  }
}

async function exigir(raiz: string, caminho: string) {
  const rel = normalizar(caminho);
  const abs = resolver(raiz, rel);
  const s = await info(abs);
  if (!s) throw new ErroConteudo(`Não encontrei "${rel || 'raiz'}".`, 'nao-encontrado');
  return { rel, abs, pasta: s.isDirectory() };
}

export async function listarArvore(raiz: string, pasta = ''): Promise<Item[]> {
  const entradas = (await readdir(resolver(raiz, pasta), { withFileTypes: true })).filter((e) => !e.name.startsWith('.'));
  const pastas = entradas.filter((e) => e.isDirectory()).sort((a, b) => ordem(a.name, b.name));
  const arquivos = entradas.filter((e) => e.isFile()).sort((a, b) => ordem(a.name, b.name));
  const itens: Item[] = [];
  for (const p of pastas) {
    const caminho = juntar(pasta, p.name);
    itens.push({ nome: p.name, caminho, tipo: 'pasta', filhos: await listarArvore(raiz, caminho) });
  }
  for (const a of arquivos) itens.push({ nome: a.name, caminho: juntar(pasta, a.name), tipo: tipoDe(a.name) });
  return itens;
}

export async function listarArquivos(raiz: string): Promise<{ caminho: string; tipo: Exclude<TipoItem, 'pasta'> }[]> {
  const r: { caminho: string; tipo: Exclude<TipoItem, 'pasta'> }[] = [];
  const visitar = (itens: Item[]) => {
    for (const i of itens) {
      if (i.tipo === 'pasta') visitar(i.filhos ?? []);
      else r.push({ caminho: i.caminho, tipo: i.tipo });
    }
  };
  visitar(await listarArvore(raiz));
  return r;
}

export async function criarPasta(raiz: string, caminho: string): Promise<string> {
  const rel = normalizar(caminho);
  if (!rel) throw new ErroConteudo('Dê um nome à pasta.', 'caminho-invalido');
  for (const parte of rel.split('/')) nomeSeguro(parte);
  const abs = resolver(raiz, rel);
  if (await info(abs)) throw new ErroConteudo(`Já existe "${rel}".`, 'ja-existe');
  await mkdir(abs, { recursive: true });
  return rel;
}

/** Cria um arquivo de texto novo (criando as pastas do caminho). Usado por notas e quadros. */
export async function criarTexto(raiz: string, caminho: string, conteudo: string): Promise<string> {
  const rel = normalizar(caminho);
  for (const parte of rel.split('/')) nomeSeguro(parte);
  const abs = resolver(raiz, rel);
  if (await info(abs)) throw new ErroConteudo(`Já existe "${rel}".`, 'ja-existe');
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, conteudo, { flag: 'wx' });
  return rel;
}

export async function criarNota(raiz: string, caminho: string, conteudo = ''): Promise<string> {
  let rel = normalizar(caminho);
  if (!rel) throw new ErroConteudo('Dê um nome à nota.', 'caminho-invalido');
  if (!rel.toLowerCase().endsWith('.md')) rel += '.md';
  return criarTexto(raiz, rel, conteudo);
}

export async function lerTexto(raiz: string, caminho: string): Promise<string> {
  const { abs, pasta, rel } = await exigir(raiz, caminho);
  if (pasta) throw new ErroConteudo(`"${rel}" é uma pasta.`, 'tipo-invalido');
  return readFile(abs, 'utf8');
}

export async function lerBinario(raiz: string, caminho: string): Promise<Uint8Array> {
  const { abs, pasta, rel } = await exigir(raiz, caminho);
  if (pasta) throw new ErroConteudo(`"${rel}" é uma pasta.`, 'tipo-invalido');
  return new Uint8Array(await readFile(abs));
}

export async function salvarTexto(raiz: string, caminho: string, conteudo: string): Promise<void> {
  const { abs, pasta, rel } = await exigir(raiz, caminho);
  if (pasta || tipoDe(rel) === 'anexo') throw new ErroConteudo(`"${rel}" não é uma nota nem um quadro.`, 'tipo-invalido');
  await writeFile(abs, conteudo);
}

/** "nota.md" vira "nota (2).md"; "x.quadro.json" vira "x (2).quadro.json"; pasta vira "pasta (2)". */
async function nomeLivre(raiz: string, pasta: string, nome: string): Promise<string> {
  if (!(await info(resolver(raiz, juntar(pasta, nome))))) return nome;
  const ext = nome.endsWith('.quadro.json') ? '.quadro.json' : path.extname(nome);
  const base = ext ? nome.slice(0, -ext.length) : nome;
  for (let n = 2; ; n++) {
    const candidato = `${base} (${n})${ext}`;
    if (!(await info(resolver(raiz, juntar(pasta, candidato))))) return candidato;
  }
}

/** Atualiza fontes e anexos dos quadros depois de renomear ou mover. */
async function atualizarQuadros(raiz: string, trocar: (caminho: string) => string | null) {
  for (const a of await listarArquivos(raiz)) {
    if (a.tipo !== 'quadro') continue;
    const texto = await readFile(resolver(raiz, a.caminho), 'utf8');
    let q: { fontes?: { caminho: string }[]; cartoes?: { anexos?: string[] }[] };
    try {
      q = JSON.parse(texto);
    } catch {
      continue;
    }
    let mudou = false;
    for (const f of q.fontes ?? []) {
      const novo = trocar(f.caminho);
      if (novo !== null && novo !== f.caminho) { f.caminho = novo; mudou = true; }
    }
    for (const c of q.cartoes ?? []) {
      c.anexos = (c.anexos ?? []).map((x) => {
        const novo = trocar(x);
        if (novo !== null && novo !== x) { mudou = true; return novo; }
        return x;
      });
    }
    if (mudou) await writeFile(resolver(raiz, a.caminho), JSON.stringify(q, null, 2) + '\n');
  }
}

async function atualizarLigacoes(raiz: string, pares: [string, string][]) {
  if (!pares.length) return;
  for (const a of await listarArquivos(raiz)) {
    if (a.tipo !== 'nota') continue;
    const abs = resolver(raiz, a.caminho);
    const texto = await readFile(abs, 'utf8');
    let novo = texto;
    for (const [de, para] of pares) novo = substituirLigacoes(novo, de, para);
    if (novo !== texto) await writeFile(abs, novo);
  }
}

const semMd = (c: string) => (c.toLowerCase().endsWith('.md') ? c.slice(0, -3) : c);
const trocaPrefixo = (de: string, para: string) => (c: string) =>
  c === de ? para : c.startsWith(de + '/') ? para + c.slice(de.length) : null;

async function depoisDeMudar(raiz: string, antigo: string, novo: string, pasta: boolean) {
  await atualizarQuadros(raiz, trocaPrefixo(antigo, novo));
  if (pasta) return;
  const pares: [string, string][] = [];
  const nomeAntigo = path.posix.basename(antigo);
  const nomeNovo = path.posix.basename(novo);
  if (tipoDe(antigo) === 'nota') {
    if (nomeAntigo !== nomeNovo) pares.push([semMd(nomeAntigo), semMd(nomeNovo)]);
    if (antigo.includes('/') || novo.includes('/')) pares.push([semMd(antigo), semMd(novo)]);
  } else {
    if (nomeAntigo !== nomeNovo) pares.push([nomeAntigo, nomeNovo]);
    if (antigo.includes('/') || novo.includes('/')) pares.push([antigo, novo]);
  }
  await atualizarLigacoes(raiz, pares);
}

export async function renomear(raiz: string, caminho: string, novoNome: string): Promise<string> {
  const { rel, abs, pasta } = await exigir(raiz, caminho);
  let nome = nomeSeguro(novoNome);
  if (!pasta) {
    const tipo = tipoDe(path.posix.basename(rel));
    if (tipo === 'nota' && !nome.toLowerCase().endsWith('.md')) nome += '.md';
    if (tipo === 'quadro' && !nome.endsWith('.quadro.json')) nome += '.quadro.json';
  }
  const novo = juntar(path.posix.dirname(rel) === '.' ? '' : path.posix.dirname(rel), nome);
  if (novo === rel) return rel;
  if (await info(resolver(raiz, novo))) throw new ErroConteudo(`Já existe "${novo}".`, 'ja-existe');
  await rename(abs, resolver(raiz, novo));
  await depoisDeMudar(raiz, rel, novo, pasta);
  return novo;
}

export async function mover(raiz: string, caminhos: string[], destino: string): Promise<Record<string, string>> {
  const dest = normalizar(destino);
  const sDest = await info(resolver(raiz, dest));
  if (!sDest?.isDirectory()) throw new ErroConteudo(`"${dest || 'raiz'}" não é uma pasta.`, 'destino-invalido');
  const itens = [];
  for (const c of caminhos) {
    const item = await exigir(raiz, c);
    if (item.pasta && (dest === item.rel || dest.startsWith(item.rel + '/'))) {
      throw new ErroConteudo(`Não dá para mover "${item.rel}" para dentro dela mesma.`, 'destino-invalido');
    }
    itens.push(item);
  }
  const novos: Record<string, string> = {};
  for (const item of itens) {
    const pai = path.posix.dirname(item.rel) === '.' ? '' : path.posix.dirname(item.rel);
    if (pai === dest) { novos[item.rel] = item.rel; continue; }
    const nome = await nomeLivre(raiz, dest, path.posix.basename(item.rel));
    const novo = juntar(dest, nome);
    await rename(item.abs, resolver(raiz, novo));
    novos[item.rel] = novo;
    await depoisDeMudar(raiz, item.rel, novo, item.pasta);
  }
  return novos;
}

export async function excluir(raiz: string, caminhos: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const c of caminhos) {
    const { rel, abs, pasta } = await exigir(raiz, c);
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const dir = resolver(raiz, `${LIXEIRA}/${id}`);
    await mkdir(dir, { recursive: true });
    const nome = path.posix.basename(rel);
    await rename(abs, path.join(dir, nome));
    const meta: ItemLixeira = { id, nome, origem: rel, quando: new Date().toISOString(), tipo: pasta ? 'pasta' : tipoDe(nome) };
    await writeFile(path.join(dir, 'origem.json'), JSON.stringify(meta, null, 2));
    ids.push(id);
  }
  return ids;
}

export async function listarLixeira(raiz: string): Promise<ItemLixeira[]> {
  const pasta = resolver(raiz, LIXEIRA);
  if (!(await info(pasta))) return [];
  const itens: ItemLixeira[] = [];
  for (const id of await readdir(pasta)) {
    try {
      itens.push(JSON.parse(await readFile(path.join(pasta, id, 'origem.json'), 'utf8')));
    } catch {
      // pasta da lixeira sem anotação: ignora
    }
  }
  return itens.sort((a, b) => b.quando.localeCompare(a.quando));
}

export async function restaurar(raiz: string, id: string): Promise<string> {
  if (!/^[\w-]+$/.test(id)) throw new ErroConteudo('Item da lixeira inválido.', 'nao-encontrado');
  const dir = resolver(raiz, `${LIXEIRA}/${id}`);
  let meta: ItemLixeira;
  try {
    meta = JSON.parse(await readFile(path.join(dir, 'origem.json'), 'utf8'));
  } catch {
    throw new ErroConteudo('Esse item não está na lixeira.', 'nao-encontrado');
  }
  const pai = path.posix.dirname(meta.origem) === '.' ? '' : path.posix.dirname(meta.origem);
  await mkdir(resolver(raiz, pai), { recursive: true });
  const nome = await nomeLivre(raiz, pai, meta.nome);
  const destino = juntar(pai, nome);
  await rename(path.join(dir, meta.nome), resolver(raiz, destino));
  await rm(dir, { recursive: true, force: true });
  return destino;
}

export async function esvaziarLixeira(raiz: string): Promise<number> {
  const n = (await listarLixeira(raiz)).length;
  await rm(resolver(raiz, LIXEIRA), { recursive: true, force: true });
  return n;
}

export async function anexar(raiz: string, pasta: string, nomeArquivo: string, dados: Uint8Array): Promise<string> {
  const rel = normalizar(pasta);
  const s = await info(resolver(raiz, rel));
  if (!s?.isDirectory()) throw new ErroConteudo(`A pasta "${rel || 'raiz'}" não existe.`, 'nao-encontrado');
  const base = nomeSeguro(path.posix.basename(nomeArquivo.replaceAll('\\', '/')));
  const nome = await nomeLivre(raiz, rel, base);
  const destino = juntar(rel, nome);
  await writeFile(resolver(raiz, destino), dados, { flag: 'wx' });
  return destino;
}
