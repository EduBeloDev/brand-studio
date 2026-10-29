import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolver } from '../conteudo/caminhos.ts';

/**
 * A IA do app: o Claude Code em modo restrito. Por padrão nenhuma ferramenta; a pesquisa libera só busca e leitura
 * de páginas da web; a análise de referências libera só a leitura de arquivos, e só na pasta daquela referência.
 * Nunca libera comandos nem escrita: quem grava arquivos é o app.
 */

export interface Pedido {
  sistema: string;
  prompt: string;
  web?: boolean;
  modelo?: string;
  /** Pasta (relativa ao cofre) que a IA pode ler. */
  leitura?: string;
}
export interface RespostaIA {
  texto: string;
  custoUsd: number;
  duracaoMs: number;
}
export interface IA {
  gerar(pedido: Pedido): Promise<RespostaIA>;
}

export class ErroIA extends Error {}

export function argumentosClaude(p: Pedido): string[] {
  const args = ['-p', '--output-format', 'json'];
  if (p.web) args.push('--tools', 'WebSearch', 'WebFetch', '--allowedTools', 'WebSearch', 'WebFetch');
  else if (p.leitura) args.push('--tools', 'Read', '--allowedTools', 'Read', '--add-dir', p.leitura);
  else args.push('--tools', '');
  args.push('--permission-prompts', 'none', '--safe-mode', '--no-session-persistence', '--system-prompt', p.sistema);
  if (p.modelo) args.push('--model', p.modelo);
  return args;
}

export function lerSaidaClaude(stdout: string): RespostaIA {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(stdout);
  } catch {
    throw new ErroIA('A resposta do Claude Code veio num formato inesperado.');
  }
  if (d.is_error) throw new ErroIA(`O Claude Code respondeu com erro: ${String(d.result ?? 'sem detalhes')}`);
  return { texto: String(d.result ?? ''), custoUsd: Number(d.total_cost_usd ?? 0), duracaoMs: Number(d.duration_ms ?? 0) };
}

export type Executor = (args: string[], entrada: string) => Promise<{ codigo: number; stdout: string; stderr: string }>;

function executorPadrao(bin: string, tempoMaxMs: number): Executor {
  return (args, entrada) =>
    new Promise((ok, falha) => {
      const filho = spawn(bin, args, { cwd: tmpdir(), stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      const limite = setTimeout(() => {
        filho.kill('SIGTERM');
        falha(new ErroIA(`A IA passou do tempo limite (${Math.round(tempoMaxMs / 60_000)} min).`));
      }, tempoMaxMs);
      filho.stdout.on('data', (b) => (stdout += b));
      filho.stderr.on('data', (b) => (stderr += b));
      filho.on('error', (e) => {
        clearTimeout(limite);
        falha(new ErroIA(`Não consegui abrir o Claude Code (${e.message}). Ele está instalado e com login?`));
      });
      filho.on('close', (codigo) => {
        clearTimeout(limite);
        ok({ codigo: codigo ?? 1, stdout, stderr });
      });
      filho.stdin.end(entrada);
    });
}

export function criarClaudeCode(opcoes: { bin?: string; modelo?: string; raiz?: string; executar?: Executor; tempoMaxMs?: number } = {}): IA {
  const executar = opcoes.executar ?? executorPadrao(opcoes.bin ?? 'claude', opcoes.tempoMaxMs ?? 10 * 60_000);
  return {
    async gerar(p) {
      const leitura = p.leitura && opcoes.raiz ? resolver(opcoes.raiz, p.leitura) : p.leitura;
      const args = argumentosClaude({ ...p, modelo: p.modelo ?? opcoes.modelo, leitura });
      const r = await executar(args, p.prompt);
      if (r.codigo !== 0) {
        const detalhe = (r.stderr || r.stdout || 'sem detalhes').trim().slice(0, 500);
        throw new ErroIA(`O Claude Code falhou: ${detalhe}`);
      }
      return lerSaidaClaude(r.stdout);
    },
  };
}

/** Acha o JSON na resposta: puro, entre cercas ```json ou com texto em volta. */
export function extrairJson<T = unknown>(texto: string): T {
  const t = texto.trim();
  try {
    return JSON.parse(t) as T;
  } catch {
    // segue procurando
  }
  const cerca = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cerca) {
    try {
      return JSON.parse(cerca[1]!.trim()) as T;
    } catch {
      // segue procurando
    }
  }
  const inicio = t.search(/[{[]/);
  if (inicio !== -1) {
    const abre = t[inicio]!;
    const fecha = abre === '{' ? '}' : ']';
    let nivel = 0;
    let emTexto = false;
    for (let i = inicio; i < t.length; i++) {
      const ch = t[i]!;
      if (emTexto) {
        if (ch === '\\') i++;
        else if (ch === '"') emTexto = false;
        continue;
      }
      if (ch === '"') emTexto = true;
      else if (ch === abre) nivel++;
      else if (ch === fecha && --nivel === 0) {
        try {
          return JSON.parse(t.slice(inicio, i + 1)) as T;
        } catch {
          break;
        }
      }
    }
  }
  throw new ErroIA('A IA não devolveu um JSON válido.');
}

/** IA de mentira para os testes: devolve as respostas na ordem e guarda os pedidos. */
export class IAFalsa implements IA {
  respostas: (string | { texto: string; custoUsd?: number })[];
  pedidos: Pedido[] = [];
  constructor(respostas: (string | { texto: string; custoUsd?: number })[] = []) {
    this.respostas = respostas;
  }
  async gerar(p: Pedido): Promise<RespostaIA> {
    this.pedidos.push(p);
    const r = this.respostas.shift();
    if (r === undefined) throw new ErroIA('A IA falsa ficou sem respostas.');
    return typeof r === 'string' ? { texto: r, custoUsd: 0, duracaoMs: 0 } : { texto: r.texto, custoUsd: r.custoUsd ?? 0, duracaoMs: 0 };
  }
}
