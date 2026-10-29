import type { Evento } from '../../../../core/branding/memoria.ts';

/** Frase curta para mostrar um evento da memória da marca na tela (sem importar código de servidor). */
export function descreverEventoTela(e: Evento): string {
  const d = e.dados as Record<string, unknown>;
  const lista = (v: unknown) => (Array.isArray(v) && v.length ? v.join(', ') : '');
  switch (e.tipo) {
    case 'peca-aprovada': return `Aprovou: ${d.tema ?? ''}`;
    case 'peca-rejeitada': return `Rejeitou: ${d.tema ?? ''}${d.motivo ? ` (${d.motivo})` : ''}`;
    case 'quadro-produzido': return `Produziu "${d.nome ?? ''}"${lista(d.transicoes) ? `, transições ${lista(d.transicoes)}` : ''}`;
    case 'quadro-salvo': return `Salvou "${d.nome ?? ''}"`;
    case 'geracao-ia': return `A IA gerou ${d.oque ?? 'conteúdo'}${d.quadro ? ` em "${d.quadro}"` : ''}`;
    case 'edicao-apos-ia': return `Corrigiu a IA (${d.campo}): "${d.depois}"`;
    case 'sugestao-usada': return `Usou a sugestão "${d.titulo ?? ''}"`;
    case 'sugestao-descartada': return `Descartou a sugestão "${d.titulo ?? ''}"`;
    case 'referencia-analisada': return `Estudou a referência ${d.nome ?? ''}`;
  }
}
