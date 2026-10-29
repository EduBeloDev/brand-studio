import path from 'node:path';
import { lerTexto, listarArquivos, type TipoItem } from './cofre.ts';

/** Ligações no estilo do Obsidian: [[alvo]], [[alvo|apelido]], [[alvo#seção]] e ![[anexo]] (embutido). */
export interface Ligacao {
  alvo: string;
  embutida: boolean;
  apelido?: string;
  secao?: string;
}

const PADRAO = /(!?)\[\[([^[\]\n]+?)\]\]/g;

/** Troca blocos de código (``` e `inline`) por espaços, para não achar ligações dentro deles. */
function semCodigo(texto: string): string {
  return texto
    .replace(/```[\s\S]*?```/g, (m) => ' '.repeat(m.length))
    .replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));
}

function partes(interno: string): { alvo: string; apelido?: string; secao?: string } {
  const [antes, apelido] = interno.split('|', 2) as [string, string | undefined];
  const [alvo, secao] = antes.split('#', 2) as [string, string | undefined];
  const r: { alvo: string; apelido?: string; secao?: string } = { alvo: alvo.trim() };
  if (apelido !== undefined) r.apelido = apelido.trim();
  if (secao !== undefined) r.secao = secao.trim();
  return r;
}

export function extrairLigacoes(texto: string): Ligacao[] {
  const r: Ligacao[] = [];
  for (const m of semCodigo(texto).matchAll(PADRAO)) {
    const p = partes(m[2]!);
    if (p.alvo) r.push({ alvo: p.alvo, embutida: m[1] === '!', ...(p.apelido !== undefined && { apelido: p.apelido }),
      ...(p.secao !== undefined && { secao: p.secao }) });
  }
  return r;
}

const semMd = (caminho: string) => (caminho.toLowerCase().endsWith('.md') ? caminho.slice(0, -3) : caminho);

/**
 * Acha o arquivo de uma ligação como o Obsidian: pelo nome (sem diferenciar maiúsculas) ou pelo caminho, se a
 * ligação tiver pasta. Havendo mais de um, fica o caminho mais curto.
 */
export function resolverAlvo(alvo: string, caminhos: string[]): string | null {
  const a = alvo.trim().replaceAll('\\', '/').toLowerCase();
  if (!a) return null;
  const comPasta = a.includes('/');
  const achados = caminhos.filter((c) => {
    const baixo = c.toLowerCase();
    if (comPasta) return semMd(baixo) === a || baixo === a;
    const nome = path.posix.basename(baixo);
    return semMd(nome) === a || nome === a;
  });
  achados.sort((x, y) => x.split('/').length - y.split('/').length || x.length - y.length || x.localeCompare(y));
  return achados[0] ?? null;
}

/** Troca o alvo das ligações que apontam para `de`, mantendo apelido, seção e o "!" de embutido. */
export function substituirLigacoes(texto: string, de: string, para: string): string {
  const alvo = de.toLowerCase();
  return texto.replace(PADRAO, (inteiro, excl: string, interno: string) => {
    const corte = interno.search(/[|#]/);
    const nome = corte === -1 ? interno : interno.slice(0, corte);
    if (nome.trim().toLowerCase() !== alvo) return inteiro;
    return `${excl}[[${para}${corte === -1 ? '' : interno.slice(corte)}]]`;
  });
}

/** Cabeçalho simples entre "---" (chave: valor por linha), como nas notas geradas pelo app. */
export function lerFrente(texto: string): { dados: Record<string, string>; corpo: string } {
  if (!texto.startsWith('---\n')) return { dados: {}, corpo: texto };
  const fim = texto.indexOf('\n---', 3);
  if (fim === -1) return { dados: {}, corpo: texto };
  const dados: Record<string, string> = {};
  for (const linha of texto.slice(4, fim).split('\n')) {
    const i = linha.indexOf(':');
    if (i > 0) dados[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
  }
  let corpo = texto.slice(fim + 4);
  if (corpo.startsWith('\n')) corpo = corpo.slice(1);
  return { dados, corpo };
}

export function escreverFrente(dados: Record<string, string>, corpo: string): string {
  const linhas = Object.entries(dados).map(([k, v]) => `${k}: ${String(v).replaceAll('\n', ' ')}`);
  return `---\n${linhas.join('\n')}\n---\n${corpo}`;
}

export interface NoGrafo {
  id: string;
  nome: string;
  tipo: Exclude<TipoItem, 'pasta'> | 'pendente';
  grupo: string;
}
export interface ArestaGrafo {
  de: string;
  para: string;
}

const nomeExibido = (caminho: string) => path.posix.basename(caminho).replace(/\.quadro\.json$/, '').replace(/\.md$/i, '');
const grupoDe = (caminho: string) => (caminho.includes('/') ? caminho.split('/')[0]! : 'raiz');

/** Grafo do cofre: notas e quadros sempre; anexos só quando algo aponta para eles; ligação sem nota vira "pendente". */
export async function montarGrafo(raiz: string): Promise<{ nos: NoGrafo[]; arestas: ArestaGrafo[] }> {
  const arquivos = await listarArquivos(raiz);
  const caminhos = arquivos.map((a) => a.caminho);
  const existentes = new Set(caminhos);
  const nos = new Map<string, NoGrafo>();
  const arestas = new Map<string, ArestaGrafo>();
  const ligar = (de: string, para: string) => {
    if (de !== para) arestas.set(`${de}>${para}`, { de, para });
  };
  const garantir = (caminho: string, tipo: NoGrafo['tipo']) => {
    if (!nos.has(caminho)) nos.set(caminho, { id: caminho, nome: nomeExibido(caminho), tipo, grupo: grupoDe(caminho) });
  };
  for (const a of arquivos) {
    if (a.tipo === 'nota' || a.tipo === 'quadro') garantir(a.caminho, a.tipo);
  }
  for (const a of arquivos) {
    if (a.tipo === 'nota') {
      for (const l of extrairLigacoes(await lerTexto(raiz, a.caminho))) {
        const alvo = resolverAlvo(l.alvo, caminhos);
        if (alvo) {
          if (alvo === a.caminho) continue;
          garantir(alvo, arquivos.find((x) => x.caminho === alvo)!.tipo as NoGrafo['tipo']);
          ligar(a.caminho, alvo);
        } else {
          const id = `pendente:${l.alvo.toLowerCase()}`;
          if (!nos.has(id)) nos.set(id, { id, nome: l.alvo, tipo: 'pendente', grupo: 'pendente' });
          ligar(a.caminho, id);
        }
      }
    } else if (a.tipo === 'quadro') {
      let q: { fontes?: { caminho: string; ativo: boolean }[]; cartoes?: { anexos?: string[] }[] };
      try {
        q = JSON.parse(await lerTexto(raiz, a.caminho));
      } catch {
        continue;
      }
      const usados = [...(q.fontes ?? []).filter((f) => f.ativo).map((f) => f.caminho), ...(q.cartoes ?? []).flatMap((c) => c.anexos ?? [])];
      for (const u of usados) {
        if (!existentes.has(u)) continue;
        garantir(u, arquivos.find((x) => x.caminho === u)!.tipo as NoGrafo['tipo']);
        ligar(a.caminho, u);
      }
    }
  }
  return { nos: [...nos.values()], arestas: [...arestas.values()] };
}
