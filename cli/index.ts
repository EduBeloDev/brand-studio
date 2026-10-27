import path from 'node:path';
import { produzirPeca } from '../core/linha.ts';
import { PASTA_SAIDA, listarPecas, mudarStatus } from '../core/saida.ts';

/**
 * Os comandos da esteira. Fino de propósito: só entende o que foi digitado e chama o núcleo,
 * para o painel web (quando vier) usar as mesmas funções de core/.
 */

const USO = `Uso:
  npm run gerar -- "tema da peça"       cria a peça em saida/
  npm run revisar                       lista as peças aguardando aprovação
  npm run revisar -- <id> aprovar       (ou rejeitar)`;

const NOVO_STATUS = { aprovar: 'aprovada', rejeitar: 'rejeitada' } as const;

async function gerar(args: string[]): Promise<void> {
  const tema = args.join(' ').trim();
  if (!tema) throw new Error(`Faltou o tema.\n\n${USO}`);
  const peca = await produzirPeca({ tema });
  console.log(`Peça criada: ${path.join(PASTA_SAIDA, peca.id)}`);
  for (const aviso of peca.avisos) console.log(`  Aviso: ${aviso}`);
  console.log(`Para aprovar: npm run revisar -- ${peca.id} aprovar`);
}

async function revisar(args: string[]): Promise<void> {
  const [id, acao] = args;
  if (!id) {
    const pendentes = (await listarPecas(PASTA_SAIDA)).filter((p) => p.status === 'aguardando-aprovacao');
    if (pendentes.length === 0) {
      console.log('Nenhuma peça aguardando aprovação.');
      return;
    }
    console.log(`Aguardando aprovação (pastas em ${PASTA_SAIDA}):`);
    for (const p of pendentes) {
      const avisos = p.avisos.length > 0 ? `  [${p.avisos.length} aviso(s)]` : '';
      console.log(`  ${p.id}  ${p.pedido.tema}${avisos}`);
    }
    return;
  }
  if (acao !== 'aprovar' && acao !== 'rejeitar') throw new Error(`Diga se quer aprovar ou rejeitar.\n\n${USO}`);
  const peca = await mudarStatus(PASTA_SAIDA, id, NOVO_STATUS[acao]);
  console.log(`${peca.id}: ${peca.status}`);
}

const [comando, ...args] = process.argv.slice(2);
try {
  if (comando === 'gerar') await gerar(args);
  else if (comando === 'revisar') await revisar(args);
  else throw new Error(USO);
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
}
