import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { adicionarPronuncia, contextoDaMarca } from '../branding/memoria.ts';
import { escreverFrente, lerFrente } from '../conteudo/ligacoes.ts';
import { dataLocal, slug } from '../conteudo/slug.ts';
import { extrairJson, type IA } from '../ia/ia.ts';

/**
 * Modo de aprendizado (radar): de tempos em tempos a IA pesquisa na web o que está em alta em tecnologia e escreve
 * notas ligadas entre si em conteudo/conhecimento/ (tendências, jargões, sugestões de vídeo). Respeita teto de custo
 * por dia e de ciclos por sessão, e pode ser pausado a qualquer momento.
 */

export interface ConfigRadar {
  ativoAoAbrir: boolean;
  intervaloMin: number;
  maxCiclosPorSessao: number;
  tetoDiarioUsd: number;
  modelo: string;
}
export const CONFIG_PADRAO: ConfigRadar = { ativoAoAbrir: true, intervaloMin: 20, maxCiclosPorSessao: 6, tetoDiarioUsd: 1, modelo: 'sonnet' };

export interface Fonte { url: string; titulo: string; data?: string }
export interface Tendencia { titulo: string; resumo: string; porque_importa: string; evidencia: 'comprovada' | 'indicio' | 'proposta'; fontes: Fonte[]; termos: string[] }
export interface Jargao { termo: string; significado: string; exemplo: string; pronuncia?: string }
export interface Sugestao { titulo: string; gancho: string; formato: 'video' | 'carrossel' | 'ambos'; pontos: string[]; porque_agora: string; fontes: Fonte[]; termos: string[] }
export interface Descoberta { tendencias: Tendencia[]; jargoes: Jargao[]; sugestoes: Sugestao[] }

export interface EstadoRadar {
  situacao: 'parado' | 'rodando' | 'aguardando' | 'pausado' | 'limite' | 'erro';
  ciclosNaSessao: number;
  custoHoje: number;
  proximoEm?: string;
  ultimoErro?: string;
  ultimasDescobertas: string[];
}

const PASTA = 'conhecimento';
const INDICE = '.estudio/radar.json';

export function promptRadar(conhecidos: string[], marca: string, agora: Date) {
  const sistema = 'Você é o pesquisador de pautas da marca descrita abaixo. Pesquise na web com cuidado, cite fontes reais com data e responda SOMENTE com JSON válido.';
  const prompt = `Hoje é ${dataLocal(agora)}. Pesquise na web o que está em alta em tecnologia e programação nos últimos 7 a 30 dias,
pensando no público e no objetivo da marca descrita abaixo (Brasil): lançamentos, ferramentas, debates, erros comuns,
assuntos que viralizaram entre devs (notícias, GitHub, comunidades, vídeos curtos de tecnologia) e jargões que aparecem neles.
Evite repetir estes assuntos e termos já conhecidos: ${conhecidos.length ? conhecidos.slice(-150).join('; ') : 'nenhum ainda'}.

Regras:
- No máximo 3 tendências, 5 jargões e 3 sugestões de vídeo/carrossel.
- "evidencia": "comprovada" (há fonte confiável e recente), "indicio" (sinais, mas pouco dado) ou "proposta" (ideia editorial).
- Toda tendência comprovada precisa de fonte com URL e data. Não invente números nem citações.
- Jargões: explique em pt-BR simples e diga como pronunciar na narração em português ("pronuncia").
- Escreva títulos, ganchos e pontos com a grafia normal (bug, API, deploy); a forma de pronunciar vai só no campo "pronuncia".
- "termo" é só o termo (sem sigla entre parênteses); se houver sigla, registre a sigla como outro jargão.
- Sugestões precisam caber em 35 a 60 s de vídeo ou 5 a 8 slides, com gancho forte, e usar a marca abaixo.

Marca:
${marca}

Responda com: {"tendencias": [{"titulo": "", "resumo": "", "porque_importa": "", "evidencia": "", "fontes": [{"url": "", "titulo": "", "data": ""}], "termos": []}],
"jargoes": [{"termo": "", "significado": "", "exemplo": "", "pronuncia": ""}],
"sugestoes": [{"titulo": "", "gancho": "", "formato": "video|carrossel|ambos", "pontos": [], "porque_agora": "", "fontes": [{"url": "", "titulo": ""}], "termos": []}]}`;
  return { sistema, prompt };
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const lista = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const fontes = (v: unknown): Fonte[] => (Array.isArray(v) ? v : [])
  .filter((f: Record<string, unknown>) => /^https?:\/\//.test(str(f?.url)))
  .map((f: Record<string, unknown>) => ({ url: str(f.url), titulo: str(f.titulo) || str(f.url), ...(str(f.data) && { data: str(f.data) }) }));

export function validarDescoberta(json: unknown): Descoberta {
  const j = (json ?? {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  const tendencias = arr(j.tendencias).filter((t) => str(t?.titulo)).slice(0, 5).map((t) => {
    const f = fontes(t.fontes);
    const ev = ['comprovada', 'indicio', 'proposta'].includes(str(t.evidencia)) ? str(t.evidencia) as Tendencia['evidencia'] : 'proposta';
    return { titulo: str(t.titulo), resumo: str(t.resumo), porque_importa: str(t.porque_importa), evidencia: f.length ? ev : 'proposta',
      fontes: f, termos: lista(t.termos) } as Tendencia;
  });
  const jargoes = arr(j.jargoes).filter((x) => str(x?.termo) && str(x?.significado)).slice(0, 8).map((x) => ({
    termo: str(x.termo), significado: str(x.significado), exemplo: str(x.exemplo), ...(str(x.pronuncia) && { pronuncia: str(x.pronuncia) }) }));
  const sugestoes = arr(j.sugestoes).filter((s) => str(s?.titulo)).slice(0, 5).map((s) => ({
    titulo: str(s.titulo), gancho: str(s.gancho),
    formato: (['video', 'carrossel', 'ambos'].includes(str(s.formato)) ? str(s.formato) : 'ambos') as Sugestao['formato'],
    pontos: lista(s.pontos), porque_agora: str(s.porque_agora), fontes: fontes(s.fontes), termos: lista(s.termos) }));
  return { tendencias, jargoes, sugestoes };
}

const abs = (raiz: string, rel: string) => path.join(raiz, ...rel.split('/'));

/** "pull request (PR)" + "púl riquést (pê érre)" viram duas entradas; a narração só troca palavras inteiras. */
export function paresDePronuncia(termo: string, fala: string): [string, string][] {
  const t = termo.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  const f = fala.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (t && f) return [[t[1]!.trim(), f[1]!.trim()], [t[2]!.trim(), f[2]!.trim()]];
  if (t) return [[t[1]!.trim(), fala.trim()]];
  return [[termo.trim(), fala.trim()]];
}
const existe = (p: string) => stat(p).then(() => true, () => false);
const ligacoes = (termos: string[]) => termos.map((t) => `[[${slug(t)}]]`).join(', ');
const listaFontes = (f: Fonte[]) => (f.length ? f.map((x) => `- [${x.titulo}](${x.url})${x.data ? ` (${x.data})` : ''}`).join('\n') : '- sem fonte (proposta editorial)');

async function escrever(raiz: string, rel: string, texto: string) {
  await mkdir(path.dirname(abs(raiz, rel)), { recursive: true });
  await writeFile(abs(raiz, rel), texto);
}

export async function gravarDescoberta(raiz: string, d: Descoberta, agora = new Date()) {
  const hoje = dataLocal(agora);
  const criadas: string[] = [];
  const atualizadas: string[] = [];
  for (const t of d.tendencias) {
    const rel = `${PASTA}/tendencias/${hoje}-${slug(t.titulo)}.md`;
    (await existe(abs(raiz, rel)) ? atualizadas : criadas).push(rel);
    await escrever(raiz, rel, escreverFrente({ tipo: 'tendencia', evidencia: t.evidencia, data: hoje, fontes: t.fontes.map((f) => f.url).join(' ') },
      `# ${t.titulo}\n\n${t.resumo}\n\n**Por que importa:** ${t.porque_importa || 'a conferir'}\n\n**Evidência:** ${t.evidencia}\n\n` +
      `**Termos:** ${ligacoes(t.termos) || 'nenhum'}\n\n## Fontes\n\n${listaFontes(t.fontes)}\n`));
  }
  for (const j of d.jargoes) {
    const rel = `${PASTA}/jargoes/${slug(j.termo)}.md`;
    if (await existe(abs(raiz, rel))) {
      const atual = await readFile(abs(raiz, rel), 'utf8');
      await writeFile(abs(raiz, rel), `${atual.replace(/\n*$/, '\n')}\n## Visto também em ${hoje}\n\n${j.significado}\n`);
      atualizadas.push(rel);
    } else {
      await escrever(raiz, rel, escreverFrente({ tipo: 'jargao', termo: j.termo, data: hoje },
        `# ${j.termo}\n\n${j.significado}\n\n**Exemplo:** ${j.exemplo || 'a completar'}\n\n` +
        `**Pronúncia na narração:** ${j.pronuncia || 'grafia normal'}\n`));
      criadas.push(rel);
    }
    if (j.pronuncia) for (const [t, f] of paresDePronuncia(j.termo, j.pronuncia)) await adicionarPronuncia(raiz, t, f);
  }
  for (const s of d.sugestoes) {
    const rel = `${PASTA}/sugestoes/${slug(s.titulo)}.md`;
    if (await existe(abs(raiz, rel))) { atualizadas.push(rel); continue; }
    await escrever(raiz, rel, escreverFrente({ tipo: 'sugestao', formato: s.formato, status: 'nova', criada: hoje, origem: 'radar' },
      `# ${s.titulo}\n\n**Gancho:** ${s.gancho}\n\n## Pontos\n\n${s.pontos.map((p) => `- ${p}`).join('\n') || '- a definir'}\n\n` +
      `**Por que agora:** ${s.porque_agora || 'a conferir'}\n\n**Termos:** ${ligacoes(s.termos) || 'nenhum'}\n\n## Fontes\n\n${listaFontes(s.fontes)}\n`));
    criadas.push(rel);
  }
  return { criadas, atualizadas };
}

export interface ResumoSugestao { caminho: string; titulo: string; formato: string; status: string; criada: string; origem: string }

export async function lerSugestoes(raiz: string): Promise<ResumoSugestao[]> {
  const pasta = abs(raiz, `${PASTA}/sugestoes`);
  if (!(await existe(pasta))) return [];
  const r: ResumoSugestao[] = [];
  for (const nome of (await readdir(pasta)).filter((n) => n.endsWith('.md'))) {
    const texto = await readFile(path.join(pasta, nome), 'utf8');
    const { dados, corpo } = lerFrente(texto);
    const titulo = corpo.match(/^# (.+)$/m)?.[1]?.trim() ?? nome.replace(/\.md$/, '');
    r.push({ caminho: `${PASTA}/sugestoes/${nome}`, titulo, formato: dados.formato ?? 'ambos', status: dados.status ?? 'nova',
      criada: dados.criada ?? '', origem: dados.origem ?? 'radar' });
  }
  return r.sort((a, b) => b.criada.localeCompare(a.criada) || a.titulo.localeCompare(b.titulo));
}

export async function marcarSugestao(raiz: string, caminho: string, status: 'nova' | 'usada' | 'descartada') {
  const texto = await readFile(abs(raiz, caminho), 'utf8');
  const { dados, corpo } = lerFrente(texto);
  await writeFile(abs(raiz, caminho), escreverFrente({ ...dados, status }, corpo));
  return { titulo: corpo.match(/^# (.+)$/m)?.[1]?.trim() ?? caminho, corpo };
}

interface Indice { config: ConfigRadar; conhecidos: string[]; custos: Record<string, number>; ciclos: { quando: string; custo: number; criadas: number }[] }

/** Agenda fn para daqui a ms; devolve como cancelar. fn devolve a promessa do ciclo (quem dispara pode aguardar). */
type Agendar = (fn: () => unknown, ms: number) => () => void;

export class Radar {
  private raiz: string;
  private ia: IA;
  private relogio: () => Date;
  private agendar: Agendar;
  private indice: Indice;
  private carregado = false;
  private pausado = false;
  private cancelar?: () => void;
  private _estado: EstadoRadar = { situacao: 'parado', ciclosNaSessao: 0, custoHoje: 0, ultimasDescobertas: [] };

  constructor(o: { raiz: string; ia: IA; config?: ConfigRadar; relogio?: () => Date; agendar?: Agendar }) {
    this.raiz = o.raiz;
    this.ia = o.ia;
    this.relogio = o.relogio ?? (() => new Date());
    this.agendar = o.agendar ?? ((fn, ms) => { const t = setTimeout(fn, ms); t.unref?.(); return () => clearTimeout(t); });
    this.indice = { config: { ...(o.config ?? CONFIG_PADRAO) }, conhecidos: [], custos: {}, ciclos: [] };
    if (o.config) this.carregado = false;
  }

  async carregar(): Promise<void> {
    try {
      const salvo = JSON.parse(await readFile(abs(this.raiz, INDICE), 'utf8')) as Partial<Indice>;
      this.indice = { config: { ...this.indice.config, ...(salvo.config ?? {}) }, conhecidos: salvo.conhecidos ?? [], custos: salvo.custos ?? {},
        ciclos: salvo.ciclos ?? [] };
    } catch {
      // primeira vez
    }
    this.carregado = true;
  }

  /** Garante o estado salvo carregado (custo do dia, ciclos), mesmo com o radar desligado. */
  async pronto(): Promise<void> {
    if (!this.carregado) await this.carregar();
  }

  private async salvar() {
    await mkdir(path.dirname(abs(this.raiz, INDICE)), { recursive: true });
    await writeFile(abs(this.raiz, INDICE), JSON.stringify(this.indice, null, 2));
  }

  private custoHoje() {
    return this.indice.custos[dataLocal(this.relogio())] ?? 0;
  }

  config(): ConfigRadar {
    return { ...this.indice.config };
  }

  estado(): EstadoRadar {
    return { ...this._estado, custoHoje: Math.round(this.custoHoje() * 10_000) / 10_000, ultimasDescobertas: [...this._estado.ultimasDescobertas] };
  }

  private noLimite() {
    return this._estado.ciclosNaSessao >= this.indice.config.maxCiclosPorSessao || this.custoHoje() >= this.indice.config.tetoDiarioUsd;
  }

  async atualizarConfig(parcial: Partial<ConfigRadar>): Promise<ConfigRadar> {
    if (!this.carregado) await this.carregar();
    const c = { ...this.indice.config, ...parcial };
    if (!(Number.isFinite(c.intervaloMin) && c.intervaloMin >= 1 && c.intervaloMin <= 1440)) throw new Error('O intervalo precisa ficar entre 1 e 1440 minutos.');
    if (!(Number.isInteger(c.maxCiclosPorSessao) && c.maxCiclosPorSessao >= 1 && c.maxCiclosPorSessao <= 100)) throw new Error('O limite de ciclos precisa ficar entre 1 e 100.');
    if (!(Number.isFinite(c.tetoDiarioUsd) && c.tetoDiarioUsd >= 0 && c.tetoDiarioUsd <= 50)) throw new Error('O teto diário precisa ficar entre US$ 0 e US$ 50.');
    if (typeof c.ativoAoAbrir !== 'boolean' || !c.modelo) throw new Error('Configuração inválida.');
    this.indice.config = c;
    await this.salvar();
    return this.config();
  }

  async iniciar(): Promise<void> {
    if (!this.carregado) await this.carregar();
    this.pausado = false;
    await this.rodarEAgendar();
  }

  async iniciarSeConfigurado(): Promise<boolean> {
    if (!this.carregado) await this.carregar();
    if (!this.indice.config.ativoAoAbrir) return false;
    await this.iniciar();
    return true;
  }

  pausar(): void {
    this.pausado = true;
    this.cancelar?.();
    this.cancelar = undefined;
    this._estado.situacao = 'pausado';
    delete this._estado.proximoEm;
  }

  async retomar(): Promise<void> {
    this.pausado = false;
    await this.rodarEAgendar();
  }

  /** Roda um ciclo agora, mesmo pausado, sem mudar a pausa nem o agendamento. */
  async cicloAgora(): Promise<EstadoRadar> {
    if (!this.carregado) await this.carregar();
    const antes = this._estado.situacao;
    try {
      await this.ciclo();
      if (antes !== 'rodando') this._estado.situacao = antes === 'erro' ? 'aguardando' : antes;
      delete this._estado.ultimoErro;
    } catch (e) {
      this._estado.ultimoErro = (e as Error).message;
      if (!this.pausado) this._estado.situacao = 'erro';
    }
    return this.estado();
  }

  private async rodarEAgendar(): Promise<void> {
    if (this.pausado) return;
    if (this.noLimite()) { this._estado.situacao = 'limite'; return; }
    this._estado.situacao = 'rodando';
    let erro: string | undefined;
    try {
      await this.ciclo();
    } catch (e) {
      erro = (e as Error).message;
    }
    if (this.pausado) { this._estado.situacao = 'pausado'; return; }
    if (this.noLimite()) { this._estado.situacao = 'limite'; delete this._estado.proximoEm; return; }
    const ms = this.indice.config.intervaloMin * 60_000;
    this._estado.proximoEm = new Date(this.relogio().getTime() + ms).toISOString();
    this.cancelar = this.agendar(() => this.rodarEAgendar(), ms);
    if (erro) {
      this._estado.situacao = 'erro';
      this._estado.ultimoErro = erro;
    } else {
      this._estado.situacao = 'aguardando';
      delete this._estado.ultimoErro;
    }
  }

  private async ciclo() {
    const marca = await contextoDaMarca(this.raiz, 3000);
    const p = promptRadar(this.indice.conhecidos, marca, this.relogio());
    const r = await this.ia.gerar({ ...p, web: true, modelo: this.indice.config.modelo });
    const hoje = dataLocal(this.relogio());
    this.indice.custos[hoje] = (this.indice.custos[hoje] ?? 0) + r.custoUsd;
    this._estado.ciclosNaSessao += 1;
    await this.salvar();
    const d = validarDescoberta(extrairJson(r.texto));
    const g = await gravarDescoberta(this.raiz, d, this.relogio());
    const novos = [...d.tendencias.map((t) => t.titulo), ...d.jargoes.map((j) => j.termo), ...d.sugestoes.map((s) => s.titulo)].map((x) => x.toLowerCase());
    this.indice.conhecidos = [...new Set([...this.indice.conhecidos, ...novos])].slice(-300);
    this.indice.ciclos = [...this.indice.ciclos, { quando: this.relogio().toISOString(), custo: r.custoUsd, criadas: g.criadas.length }].slice(-200);
    await this.salvar();
    this._estado.ultimasDescobertas = [...g.criadas, ...g.atualizadas];
  }
}
