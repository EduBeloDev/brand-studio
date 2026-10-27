import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Peca, Pedido, Roteiro, StatusPeca, Visual } from './tipos.ts';

/**
 * Onde as peças ficam: uma pasta por peça em saida/, com o registro (peca.json), a legenda
 * pronta para copiar e o visual. Pasta em vez de banco de dados para dar para abrir e olhar
 * cada peça direto; escolha provisória, revista na rodada de arquitetura.
 */
export const PASTA_SAIDA = path.join(import.meta.dirname, '..', 'saida');

const REGISTRO = 'peca.json';

export async function salvarPeca(dados: {
  pastaSaida: string;
  agora: Date;
  pedido: Pedido;
  roteiro: Roteiro;
  visual: Visual;
  avisos: string[];
}): Promise<Peca> {
  const { pastaSaida, agora, pedido, roteiro, visual, avisos } = dados;
  const id = await criarPastaDaPeca(pastaSaida, `${carimbo(agora)}-${slug(pedido.tema)}`);
  const pasta = path.join(pastaSaida, id);
  const peca: Peca = {
    id,
    criadaEm: agora.toISOString(),
    status: 'aguardando-aprovacao',
    pedido,
    roteiro,
    visual: visual.arquivo,
    avisos,
  };
  await writeFile(path.join(pasta, visual.arquivo), visual.conteudo);
  await writeFile(path.join(pasta, 'legenda.txt'), `${roteiro.legenda}\n`);
  await gravarRegistro(pasta, peca);
  return peca;
}

/** Todas as peças, da mais nova para a mais antiga. Pastas sem peca.json são ignoradas. */
export async function listarPecas(pastaSaida: string): Promise<Peca[]> {
  let nomes: string[];
  try {
    nomes = await readdir(pastaSaida);
  } catch (erro) {
    if (codigo(erro) === 'ENOENT') return []; // nada foi gerado ainda
    throw erro;
  }
  const pecas: Peca[] = [];
  for (const nome of nomes) {
    const peca = await lerRegistro(path.join(pastaSaida, nome));
    if (peca) pecas.push(peca);
  }
  return pecas.sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
}

export async function mudarStatus(pastaSaida: string, id: string, status: StatusPeca): Promise<Peca> {
  // O id vem do que foi digitado: só aceita nome de pasta, nunca um caminho como "../algo".
  if (!id || path.basename(id) !== id) throw new Error(`Id inválido: "${id}".`);
  const pasta = path.join(pastaSaida, id);
  const peca = await lerRegistro(pasta);
  if (!peca) throw new Error(`Peça "${id}" não encontrada em ${pastaSaida}.`);
  const atualizada: Peca = { ...peca, status };
  await gravarRegistro(pasta, atualizada);
  return atualizada;
}

async function lerRegistro(pasta: string): Promise<Peca | undefined> {
  let texto: string;
  try {
    texto = await readFile(path.join(pasta, REGISTRO), 'utf8');
  } catch (erro) {
    if (codigo(erro) === 'ENOENT' || codigo(erro) === 'ENOTDIR') return undefined;
    throw erro;
  }
  try {
    return JSON.parse(texto) as Peca;
  } catch {
    throw new Error(`O arquivo ${path.join(pasta, REGISTRO)} está corrompido.`);
  }
}

async function gravarRegistro(pasta: string, peca: Peca): Promise<void> {
  await writeFile(path.join(pasta, REGISTRO), `${JSON.stringify(peca, null, 2)}\n`);
}

/** Cria a pasta e devolve o nome usado. Dois pedidos iguais no mesmo segundo ganham -2, -3... */
async function criarPastaDaPeca(pastaSaida: string, base: string): Promise<string> {
  await mkdir(pastaSaida, { recursive: true });
  for (let n = 1; ; n++) {
    const nome = n === 1 ? base : `${base}-${n}`;
    try {
      await mkdir(path.join(pastaSaida, nome));
      return nome;
    } catch (erro) {
      if (codigo(erro) !== 'EEXIST') throw erro;
    }
  }
}

/** Data e hora locais no começo do nome, para as pastas ficarem em ordem no gerenciador de arquivos. */
function carimbo(data: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}-${p(data.getHours())}${p(data.getMinutes())}${p(data.getSeconds())}`;
}

/** "Promoção de Verão!" vira "promocao-de-verao", para entrar no nome da pasta. */
function slug(texto: string): string {
  const limpo = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return limpo || 'peca';
}

function codigo(erro: unknown): string | undefined {
  return (erro as NodeJS.ErrnoException | undefined)?.code;
}
