import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { IA } from '../ia/ia.ts';
import { MARCA_PADRAO, lerMarca } from './marca.ts';

/**
 * Memória de branding: o app anota o que a pessoa escolhe, aprova, rejeita e corrige; calcula preferências;
 * e, de tempos em tempos, a IA consolida um perfil da marca. Tudo legível em conteudo/branding/; os eventos
 * brutos ficam em conteudo/.estudio/ (estado de máquina, fora do git).
 * Regra: o app só reescreve as notas automáticas (aprendizados/). Identidade e objetivo são da pessoa.
 */

export const PASTA = 'branding';
export const CONSOLIDAR_A_CADA = 10;
export const TIPOS_EVENTO = ['peca-aprovada', 'peca-rejeitada', 'quadro-salvo', 'quadro-produzido', 'geracao-ia', 'edicao-apos-ia',
  'sugestao-usada', 'sugestao-descartada', 'referencia-analisada'] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export interface Evento {
  tipo: TipoEvento;
  quando: string;
  dados: Record<string, unknown>;
}

const EVENTOS = '.estudio/eventos.jsonl';
const CONTROLE = '.estudio/memoria.json';

const SEMENTES: Record<string, string> = {
  'marca.json': `${JSON.stringify(MARCA_PADRAO)}\n`,
  'README.md': `# Memória de branding

O app aprende aqui como a marca se comporta. O nome da marca fica em \`marca.json\`. Você pode editar à vontade as notas
de **identidade** e o **objetivo**: são a palavra final. As notas de **aprendizados** são escritas pelo app (preferências
calculadas, diário de escolhas e o perfil consolidado pela IA a cada ${CONSOLIDAR_A_CADA} eventos ou pelo botão "Consolidar memória").

- [[objetivo]]
- [[visual]] · [[voz-e-tom]] · [[personagem]] · [[pronuncia]]
- [[aprovadas]] · [[rejeitadas]]
- [[preferencias]] · [[perfil]]
`,
  'objetivo.md': `# Objetivo da marca

A preencher: o que a marca quer ensinar ou vender, para quem, em quais formatos e pelo que quer ser lembrada.
`,
  'identidade/visual.md': `# Identidade visual

A preencher: cores, fontes (com licença), estética, transições preferidas e o que evitar.
`,
  'identidade/voz-e-tom.md': `# Voz e tom

A preencher: como a marca fala, tipo de humor, voz da narração, frase de fechamento e o que nunca dizer.
`,
  'identidade/personagem.md': `# Personagem

A preencher: aparência, características que nunca mudam, quando aparece e quais expressões usa.
`,
  'identidade/pronuncia.md': `# Pronúncia

Como a narração deve falar cada termo. A tela e a legenda continuam com a grafia normal.

| termo | fala |
| --- | --- |
| MIT | ême í tê |
| Apache | Apátchi |
| BSD | bê ésse dê |
| GPL | gê pê éle |
| AGPL | á gê pê éle |
| React | Riáct |
| Kubernetes | Kubernêtis |
| Django | Djângo |
| Linux | Línux |
| WordPress | Uôrdprés |
| JavaScript | Djávascript |
| TypeScript | Táipscript |
| bug | bâg |
| deploy | diplói |
| API | a pê í |
`,
  'escolhas/aprovadas.md': '# Peças aprovadas\n\nO app acrescenta aqui cada peça aprovada.\n',
  'escolhas/rejeitadas.md': '# Peças rejeitadas\n\nO app acrescenta aqui cada peça rejeitada, com o motivo quando houver.\n',
  'aprendizados/preferencias.md': '# Preferências aprendidas (automático)\n\nAinda sem escolhas registradas.\n',
  'aprendizados/perfil.md': '# Perfil da marca (automático)\n\nAinda não consolidado. A IA escreve aqui depois das primeiras escolhas.\n',
};

const abs = (raiz: string, rel: string) => path.join(raiz, ...rel.split('/'));
const existe = (p: string) => stat(p).then(() => true, () => false);
const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function prepararMemoria(raiz: string): Promise<void> {
  for (const [rel, texto] of Object.entries(SEMENTES)) {
    const destino = abs(raiz, `${PASTA}/${rel}`);
    if (await existe(destino)) continue;
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, texto);
  }
}

export function descreverEvento(e: Pick<Evento, 'tipo' | 'dados'>): string {
  const d = e.dados as Record<string, unknown>;
  const lista = (v: unknown) => (Array.isArray(v) && v.length ? v.join(', ') : 'nenhuma');
  switch (e.tipo) {
    case 'peca-aprovada': return `Peça aprovada: ${d.tema ?? 'sem tema'}`;
    case 'peca-rejeitada': return `Peça rejeitada: ${d.tema ?? 'sem tema'}${d.motivo ? ` (motivo: ${d.motivo})` : ''}`;
    case 'quadro-salvo':
    case 'quadro-produzido': return `${e.tipo === 'quadro-produzido' ? 'Quadro produzido' : 'Quadro salvo'}${d.nome ? ` "${d.nome}"` : ''}: transições ${lista(d.transicoes)}; animações ${lista(d.animacoes)}; expressões ${lista(d.expressoes)}; modelos ${lista(d.modelos)}`;
    case 'geracao-ia': return `A IA gerou ${d.oque ?? 'conteúdo'}${d.quadro ? ` em "${d.quadro}"` : ''}`;
    case 'edicao-apos-ia': return `Corrigido depois da IA (${d.campo}): "${d.antes}" virou "${d.depois}"`;
    case 'sugestao-usada': return `Sugestão usada: ${d.titulo ?? ''}${d.tipo ? ` (${d.tipo})` : ''}`;
    case 'sugestao-descartada': return `Sugestão descartada: ${d.titulo ?? ''}`;
    case 'referencia-analisada': return `Referência analisada: ${d.nome ?? ''}`;
  }
}

async function lerControle(raiz: string): Promise<{ consolidadoEm: number }> {
  try {
    return JSON.parse(await readFile(abs(raiz, CONTROLE), 'utf8'));
  } catch {
    return { consolidadoEm: 0 };
  }
}

export async function lerEventos(raiz: string): Promise<Evento[]> {
  try {
    return (await readFile(abs(raiz, EVENTOS), 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

export async function registrar(raiz: string, evento: Omit<Evento, 'quando'>, agora = new Date()) {
  const e: Evento = { ...evento, quando: agora.toISOString() };
  await mkdir(abs(raiz, '.estudio'), { recursive: true });
  await appendFile(abs(raiz, EVENTOS), JSON.stringify(e) + '\n');
  const texto = descreverEvento(e);
  const diario = abs(raiz, `${PASTA}/aprendizados/diario/${dia(agora)}.md`);
  await mkdir(path.dirname(diario), { recursive: true });
  if (!(await existe(diario))) await writeFile(diario, `# Diário de escolhas: ${dia(agora)}\n\n`);
  const hora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
  await appendFile(diario, `- ${hora} ${texto}\n`);
  if (e.tipo === 'peca-aprovada' || e.tipo === 'peca-rejeitada') {
    const nota = abs(raiz, `${PASTA}/escolhas/${e.tipo === 'peca-aprovada' ? 'aprovadas' : 'rejeitadas'}.md`);
    await mkdir(path.dirname(nota), { recursive: true });
    await appendFile(nota, `- ${dia(agora)}: ${texto}\n`);
  }
  const total = (await lerEventos(raiz)).length;
  return { total, desdeConsolidacao: total - (await lerControle(raiz)).consolidadoEm };
}

type Contagem = [string, number][];
export interface Preferencias {
  transicoes: Contagem;
  animacoes: Contagem;
  expressoes: Contagem;
  modelos: Contagem;
  aprovadas: string[];
  rejeitadas: { tema: string; motivo: string }[];
  camposEditados: Contagem;
}

function contar(valores: string[]): Contagem {
  const m = new Map<string, number>();
  for (const v of valores) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function calcularPreferencias(eventos: Evento[]): Preferencias {
  const juntar = (chave: string) => eventos.flatMap((e) => (Array.isArray(e.dados[chave]) ? (e.dados[chave] as unknown[]).map(String) : []));
  return {
    transicoes: contar(juntar('transicoes')),
    animacoes: contar(juntar('animacoes')),
    expressoes: contar(juntar('expressoes')),
    modelos: contar(juntar('modelos')),
    aprovadas: eventos.filter((e) => e.tipo === 'peca-aprovada').map((e) => String(e.dados.tema ?? '')),
    rejeitadas: eventos.filter((e) => e.tipo === 'peca-rejeitada').map((e) => ({ tema: String(e.dados.tema ?? ''), motivo: String(e.dados.motivo ?? '') })),
    camposEditados: contar(eventos.filter((e) => e.tipo === 'edicao-apos-ia').map((e) => String(e.dados.campo ?? ''))),
  };
}

export async function escreverPreferencias(raiz: string, p: Preferencias): Promise<void> {
  const secao = (titulo: string, c: Contagem) => `## ${titulo}\n\n${c.length ? c.map(([k, n]) => `- ${k} (${n})`).join('\n') : '- ainda nada'}\n`;
  const texto = [
    '# Preferências aprendidas (automático)\n',
    'Calculado a partir das escolhas registradas. Não edite: o app reescreve.\n',
    secao('Transições mais usadas', p.transicoes),
    secao('Animações mais usadas', p.animacoes),
    secao('Expressões do personagem', p.expressoes),
    secao('Modelos de slide', p.modelos),
    secao('Campos que você mais corrige depois da IA', p.camposEditados),
    `## Aprovadas\n\n${p.aprovadas.length ? p.aprovadas.map((t) => `- ${t}`).join('\n') : '- ainda nada'}\n`,
    `## Rejeitadas\n\n${p.rejeitadas.length ? p.rejeitadas.map((r) => `- ${r.tema}${r.motivo ? `: ${r.motivo}` : ''}`).join('\n') : '- ainda nada'}\n`,
  ].join('\n');
  await mkdir(abs(raiz, `${PASTA}/aprendizados`), { recursive: true });
  await writeFile(abs(raiz, `${PASTA}/aprendizados/preferencias.md`), texto);
}

export async function precisaConsolidar(raiz: string): Promise<boolean> {
  const total = (await lerEventos(raiz)).length;
  return total - (await lerControle(raiz)).consolidadoEm >= CONSOLIDAR_A_CADA;
}

async function lerNota(raiz: string, rel: string) {
  try {
    return await readFile(abs(raiz, `${PASTA}/${rel}`), 'utf8');
  } catch {
    return '';
  }
}

export async function consolidar(raiz: string, ia: IA, agora = new Date()): Promise<string> {
  const eventos = await lerEventos(raiz);
  const prefs = calcularPreferencias(eventos);
  await escreverPreferencias(raiz, prefs);
  const notas = await Promise.all(['objetivo.md', 'identidade/visual.md', 'identidade/voz-e-tom.md', 'identidade/personagem.md',
    'aprendizados/perfil.md', 'aprendizados/preferencias.md'].map((r) => lerNota(raiz, r)));
  const recentes = eventos.slice(-40).map((e) => `- ${e.quando.slice(0, 10)} ${descreverEvento(e)}`).join('\n');
  const r = await ia.gerar({
    sistema: `Você mantém a memória de branding da marca ${(await lerMarca(raiz)).nome}. Escreva em pt-BR, em Markdown, de forma objetiva. Não invente fatos.`,
    prompt: `Atualize o perfil da marca com base nas notas de identidade (palavra final da pessoa), no perfil atual, nas preferências
calculadas e nas escolhas recentes. Seções: "Como a marca soa", "O que funciona", "O que evitar", "Escolhas favoritas" e
"Próximos experimentos". Aponte padrões concretos (ex.: transições e modelos preferidos, campos que a pessoa costuma corrigir).
Responda só com o Markdown do perfil, começando por "# Perfil da marca".

${notas.join('\n\n---\n\n')}

## Escolhas recentes
${recentes || '- nenhuma'}`,
  });
  const perfil = r.texto.trim();
  await writeFile(abs(raiz, `${PASTA}/aprendizados/perfil.md`), `${perfil}\n\n_Consolidado pelo app em ${dia(agora)}._\n`);
  await mkdir(abs(raiz, '.estudio'), { recursive: true });
  await writeFile(abs(raiz, CONTROLE), JSON.stringify({ consolidadoEm: eventos.length, quando: agora.toISOString() }));
  return perfil;
}

export async function lerPronuncias(raiz: string): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for (const linha of (await lerNota(raiz, 'identidade/pronuncia.md')).split('\n')) {
    const cel = linha.split('|').map((x) => x.trim());
    if (cel.length < 4 || !cel[1] || cel[1] === 'termo' || /^-+$/.test(cel[1])) continue;
    if (cel[2]) m.set(cel[1], cel[2]);
  }
  return m;
}

export async function adicionarPronuncia(raiz: string, termo: string, fala: string): Promise<boolean> {
  const t = termo.trim();
  const f = fala.trim().replaceAll('|', '');
  if (!t || !f || t.includes('|')) return false;
  const atuais = await lerPronuncias(raiz);
  if ([...atuais.keys()].some((k) => k.toLowerCase() === t.toLowerCase())) return false;
  const arquivo = abs(raiz, `${PASTA}/identidade/pronuncia.md`);
  await mkdir(path.dirname(arquivo), { recursive: true });
  if (!(await existe(arquivo))) await writeFile(arquivo, SEMENTES['identidade/pronuncia.md']!);
  const atual = await readFile(arquivo, 'utf8');
  await writeFile(arquivo, `${atual.replace(/\n*$/, '\n')}| ${t} | ${f} |\n`);
  return true;
}

export async function contextoDaMarca(raiz: string, limite = 8000): Promise<string> {
  const pron = [...(await lerPronuncias(raiz)).entries()].map(([k, v]) => `${k}: ${v}`).join('; ');
  const partes = await Promise.all(['objetivo.md', 'identidade/visual.md', 'identidade/voz-e-tom.md', 'identidade/personagem.md',
    'aprendizados/perfil.md', 'aprendizados/preferencias.md'].map((r) => lerNota(raiz, r)));
  const texto = [`# Marca\nNome: ${(await lerMarca(raiz)).nome}`, ...partes.filter(Boolean), pron ? `# Pronúncias\n${pron}` : '']
    .filter(Boolean).join('\n\n');
  return texto.length <= limite ? texto : texto.slice(0, limite);
}
