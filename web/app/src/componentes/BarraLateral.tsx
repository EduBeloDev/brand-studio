import { useMemo, useRef, useState } from 'react';
import type { Item } from '../../../../core/conteudo/cofre.ts';
import { achatar, filtrar, nomeVisivel } from '../logica/arvore.ts';
import { estaSelecionado, raizesDaSelecao } from '../logica/selecao.ts';

export type AcaoBarra = 'nova-nota' | 'nova-pasta' | 'novo-quadro' | 'mover' | 'renomear' | 'excluir' | 'fonte' | 'limpar' | 'lixeira' | 'anexar';

interface Props {
  itens: Item[];
  selecao: Set<string>;
  aoAlternar: (caminho: string, shift: boolean) => void;
  aoAbrir: (item: Item) => void;
  aoAcao: (acao: AcaoBarra, caminhos: string[]) => void;
  aberto?: string;
  quadroAberto?: boolean;
  aoSoltarArquivos?: (arquivos: File[], pasta: string) => void;
}

const ICONE: Record<Item['tipo'], string> = { pasta: '▸', nota: '≡', quadro: '▦', anexo: '◆' };

export function BarraLateral({ itens, selecao, aoAlternar, aoAbrir, aoAcao, aberto, quadroAberto, aoSoltarArquivos }: Props) {
  const [busca, setBusca] = useState('');
  const [fechadas, setFechadas] = useState<Set<string>>(new Set());
  const [soltando, setSoltando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const visiveis = useMemo(() => {
    const filtrados = filtrar(itens, busca);
    const todas = achatar(filtrados);
    if (busca.trim()) return todas;
    const abertas = new Set(todas.filter((i) => i.tipo === 'pasta' && !fechadas.has(i.caminho)).map((i) => i.caminho));
    return achatar(filtrados, 0, abertas);
  }, [itens, busca, fechadas]);
  const raizes = raizesDaSelecao(selecao);
  const n = raizes.length;

  const alternarPasta = (c: string) => setFechadas((f) => { const s = new Set(f); if (s.has(c)) s.delete(c); else s.add(c); return s; });

  return (
    <aside className={`barra${soltando ? ' soltando' : ''}`}
      onDragOver={(e) => { if (aoSoltarArquivos && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setSoltando(true); } }}
      onDragLeave={() => setSoltando(false)}
      onDrop={(e) => {
        setSoltando(false);
        if (!aoSoltarArquivos || !e.dataTransfer.files.length) return;
        e.preventDefault();
        const pasta = raizes.length === 1 && itens.length ? (achatar(itens).find((i) => i.caminho === raizes[0])?.tipo === 'pasta' ? raizes[0]! : '') : '';
        aoSoltarArquivos([...e.dataTransfer.files], pasta);
      }}>
      <div className="barra-topo">
        <button type="button" className="mini" onClick={() => aoAcao('nova-nota', raizes)}>+ Nota</button>
        <button type="button" className="mini" onClick={() => aoAcao('nova-pasta', raizes)}>+ Pasta</button>
        <button type="button" className="mini" onClick={() => aoAcao('novo-quadro', raizes)}>+ Quadro</button>
        <button type="button" className="mini" title="Anexar arquivo" onClick={() => entrada.current?.click()}>Anexar</button>
        <input ref={entrada} type="file" hidden multiple aria-label="Anexar arquivo" onChange={(e) => {
          const arquivos = [...(e.target.files ?? [])];
          if (arquivos.length && aoSoltarArquivos) {
            const primeiro = achatar(itens).find((i) => i.caminho === raizes[0]);
            aoSoltarArquivos(arquivos, primeiro?.tipo === 'pasta' ? primeiro.caminho : '');
          }
          e.target.value = '';
        }} />
      </div>
      <input className="busca" type="search" placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      {n > 0 && (
        <div className="lote">
          <span>{n} selecionado{n > 1 ? 's' : ''}</span>
          <button type="button" className="mini" onClick={() => aoAcao('mover', raizes)}>Mover</button>
          {n === 1 && <button type="button" className="mini" onClick={() => aoAcao('renomear', raizes)}>Renomear</button>}
          {quadroAberto && <button type="button" className="mini" onClick={() => aoAcao('fonte', raizes)}>Usar como fonte</button>}
          <button type="button" className="mini perigo" onClick={() => aoAcao('excluir', raizes)}>Excluir ({n})</button>
          <button type="button" className="mini fantasma" onClick={() => aoAcao('limpar', [])}>Limpar</button>
        </div>
      )}
      <ul className="arvore" role="tree">
        {visiveis.map((i) => {
          const marcado = estaSelecionado(selecao, i.caminho);
          const nome = nomeVisivel(i.nome);
          return (
            <li key={i.caminho} role="treeitem" aria-selected={marcado} className={`no tipo-${i.tipo}${aberto === i.caminho ? ' atual' : ''}${marcado ? ' marcado' : ''}`}
              style={{ paddingLeft: 8 + i.nivel * 16 }}>
              <input type="checkbox" aria-label={`Selecionar ${nome}`} checked={marcado}
                onChange={(e) => aoAlternar(i.caminho, (e.nativeEvent as MouseEvent).shiftKey ?? false)} />
              <button type="button" className="no-nome" onClick={() => { const { nivel: _, ...item } = i; if (i.tipo === 'pasta') alternarPasta(i.caminho); else aoAbrir(item); }}>
                <span className={`icone${i.tipo === 'pasta' && !fechadas.has(i.caminho) ? ' aberta' : ''}`} aria-hidden>{ICONE[i.tipo]}</span>
                <span>{nome}</span>
              </button>
            </li>
          );
        })}
        {!visiveis.length && <li className="vazio">{busca ? 'Nada com esse nome.' : 'Nenhum conteúdo ainda.'}</li>}
      </ul>
      <div className="barra-pe">
        <button type="button" className="mini fantasma" onClick={() => aoAcao('lixeira', [])}>Lixeira</button>
        <span className="dica-soltar">Arraste arquivos aqui para anexar</span>
      </div>
    </aside>
  );
}
