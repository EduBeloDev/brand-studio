/** Markdown simples e seguro (o HTML é escapado antes): títulos, negrito, itálico, listas, tabelas, links e [[ligações]]. */

const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function linha(t: string) {
  return escapar(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<mark>$2</mark>')
    .replace(/!?\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, alvo: string, apelido?: string) =>
      `<a href="#" class="ligacao" data-alvo="${alvo.trim()}">${apelido ?? alvo}</a>`)
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

export function renderizar(md: string): string {
  const corpo = md.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const saida: string[] = [];
  let lista: 'ul' | 'ol' | null = null;
  let tabela: string[][] | null = null;
  let codigo: string[] | null = null;
  const fecharLista = () => { if (lista) { saida.push(`</${lista}>`); lista = null; } };
  const fecharTabela = () => {
    if (!tabela) return;
    const [cab, ...resto] = tabela.filter((l) => !l.every((c) => /^-+$/.test(c.trim())));
    saida.push(`<table><thead><tr>${cab!.map((c) => `<th>${linha(c)}</th>`).join('')}</tr></thead><tbody>${resto.map((l) =>
      `<tr>${l.map((c) => `<td>${linha(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    tabela = null;
  };
  for (const l of corpo.split('\n')) {
    if (l.startsWith('```')) {
      if (codigo) { saida.push(`<pre><code>${escapar(codigo.join('\n'))}</code></pre>`); codigo = null; } else { fecharLista(); fecharTabela(); codigo = []; }
      continue;
    }
    if (codigo) { codigo.push(l); continue; }
    if (/^\|.*\|\s*$/.test(l)) { fecharLista(); (tabela ??= []).push(l.trim().slice(1, -1).split('|').map((c) => c.trim())); continue; }
    fecharTabela();
    const t = l.match(/^(#{1,4})\s+(.*)$/);
    const ul = l.match(/^\s*[-*]\s+(.*)$/);
    const ol = l.match(/^\s*\d+[.)]\s+(.*)$/);
    if (t) { fecharLista(); saida.push(`<h${t[1]!.length}>${linha(t[2]!)}</h${t[1]!.length}>`); }
    else if (ul || ol) {
      const tipo = ul ? 'ul' : 'ol';
      if (lista !== tipo) { fecharLista(); saida.push(`<${tipo}>`); lista = tipo; }
      saida.push(`<li>${linha((ul ?? ol)![1]!)}</li>`);
    } else if (l.startsWith('> ')) { fecharLista(); saida.push(`<blockquote>${linha(l.slice(2))}</blockquote>`); }
    else if (!l.trim()) fecharLista();
    else { fecharLista(); saida.push(`<p>${linha(l)}</p>`); }
  }
  fecharLista();
  fecharTabela();
  if (codigo) saida.push(`<pre><code>${escapar((codigo as string[]).join('\n'))}</code></pre>`);
  return saida.join('\n');
}

export function Markdown({ texto, aoLigacao, className }: { texto: string; aoLigacao?: (alvo: string) => void; className?: string }) {
  return (
    <div className={`markdown ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: renderizar(texto) }}
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest('a[data-alvo]');
        if (a) { e.preventDefault(); aoLigacao?.(a.getAttribute('data-alvo')!); }
      }} />
  );
}
