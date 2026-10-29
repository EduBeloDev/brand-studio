import { spawn } from 'node:child_process';
import type { Cartao, Cena, Quadro } from '../quadro/quadro.ts';

/**
 * Ponte com o motor de renderização em Python (amostras/estudio_render.py), o mesmo que fez as amostras aprovadas.
 * Protocolo: o pedido vai em JSON pela entrada; o script imprime "progresso: ..." e termina com "resultado: {json}".
 */

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Troca termos pela forma de falar (ex.: MIT vira "ême í tê"), só em palavras inteiras. */
export function aplicarPronuncia(texto: string, mapa: Map<string, string>): string {
  let r = texto;
  for (const [termo, fala] of [...mapa.entries()].sort((a, b) => b[0].length - a[0].length)) {
    r = r.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapar(termo)}(?![\\p{L}\\p{N}])`, 'gu'), fala);
  }
  return r;
}

export interface CenaMotor {
  fala: string;
  legenda: string;
  tela: string;
  expressao: string;
  transicao: string;
  animacoes: Record<string, string>[];
}

export function roteiroParaMotor(q: Quadro, cenas: Cena[], pronuncias: Map<string, string>) {
  return {
    legenda: q.legenda,
    cenas: cenas.map((c): CenaMotor => ({
      fala: aplicarPronuncia(c.fala.campos.fala ?? '', pronuncias),
      legenda: c.fala.campos.fala ?? '',
      tela: c.fala.campos.tela ?? '',
      expressao: c.fala.campos.expressao || 'ok',
      transicao: c.transicao?.campos.efeito || 'dissolucao',
      animacoes: c.animacoes.map((a) => ({ ...a.campos })),
    })),
  };
}

export function slidesParaMotor(slides: Cartao[]) {
  return { slides: slides.map((s) => { const { modelo = '', ...campos } = s.campos; return { modelo, campos }; }) };
}

export interface Motor {
  cena(entrada: unknown, destino: string): Promise<string>;
  slides(entrada: unknown, pasta: string): Promise<{ imagens: string[]; zip: string }>;
  video(entrada: unknown, destino: string, progredir: (t: string) => void): Promise<string>;
  tecnica(entrada: unknown, destino: string): Promise<string>;
}

export function criarMotorPython(o: { script: string; cwd: string; python?: string }): Motor {
  const rodar = (modo: string, entrada: object, progredir?: (t: string) => void) =>
    new Promise<Record<string, unknown>>((ok, falha) => {
      const filho = spawn(o.python ?? 'python3', [o.script, modo], { cwd: o.cwd, stdio: ['pipe', 'pipe', 'pipe'] });
      let resto = '';
      let stderr = '';
      let resultado: Record<string, unknown> | undefined;
      let erro = '';
      filho.stdout.on('data', (b) => {
        resto += b;
        const linhas = resto.split('\n');
        resto = linhas.pop() ?? '';
        for (const l of linhas) {
          if (l.startsWith('progresso: ')) progredir?.(l.slice(11));
          else if (l.startsWith('resultado: ')) resultado = JSON.parse(l.slice(11));
          else if (l.startsWith('erro: ')) erro = l.slice(6);
        }
      });
      filho.stderr.on('data', (b) => (stderr += b));
      filho.on('error', (e) => falha(new Error(`Não consegui rodar o Python: ${e.message}`)));
      filho.on('close', (codigo) => {
        if (codigo === 0 && resultado) ok(resultado);
        else falha(new Error(erro || stderr.trim().split('\n').slice(-3).join(' ') || `O motor falhou (código ${codigo}).`));
      });
      filho.stdin.end(JSON.stringify(entrada));
    });
  return {
    async cena(entrada, destino) {
      return String((await rodar('cena', { ...(entrada as object), destino })).arquivo);
    },
    async slides(entrada, pasta) {
      const r = await rodar('slides', { ...(entrada as object), pasta });
      return { imagens: r.imagens as string[], zip: String(r.zip) };
    },
    async video(entrada, destino, progredir) {
      return String((await rodar('video', { ...(entrada as object), destino }, progredir)).arquivo);
    },
    async tecnica(entrada, destino) {
      return String((await rodar('tecnica', { ...(entrada as object), destino })).arquivo);
    },
  };
}
