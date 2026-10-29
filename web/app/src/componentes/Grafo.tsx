import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from 'd3-force';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ArestaGrafo, NoGrafo } from '../../../../core/conteudo/ligacoes.ts';
import { filtrarGrupos, prepararGrafo, vizinhos, type NoDesenho } from '../logica/grafo.ts';

type NoSim = NoDesenho & SimulationNodeDatum;

export function Grafo({ dados, aoAbrir, atual }: { dados: { nos: NoGrafo[]; arestas: ArestaGrafo[] }; aoAbrir: (id: string) => void; atual?: string }) {
  const grupos = useMemo(() => [...new Set(dados.nos.map((n) => n.grupo))].sort(), [dados]);
  const [ligados, setLigados] = useState<Set<string>>(new Set());
  const [foco, setFoco] = useState<string | null>(null);
  const [vista, setVista] = useState({ x: 0, y: 0, k: 1 });
  const [, setTique] = useState(0);
  const nosRef = useRef<NoSim[]>([]);
  const arrasto = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => setLigados(new Set(grupos)), [grupos]);
  const visivel = useMemo(() => prepararGrafo(filtrarGrupos(dados, ligados.size ? ligados : new Set(grupos))), [dados, ligados, grupos]);

  useEffect(() => {
    const antigos = new Map(nosRef.current.map((n) => [n.id, n]));
    const nos: NoSim[] = visivel.nos.map((n) => ({ ...n, x: antigos.get(n.id)?.x, y: antigos.get(n.id)?.y }));
    nosRef.current = nos;
    const ids = new Set(nos.map((n) => n.id));
    const links = visivel.arestas.filter((a) => ids.has(a.de) && ids.has(a.para)).map((a) => ({ source: a.de, target: a.para }));
    const sim = forceSimulation(nos)
      .force('carga', forceManyBody().strength(-160))
      .force('ligacao', forceLink(links).id((d) => (d as NoSim).id).distance(70).strength(0.6))
      .force('centro', forceCenter(0, 0))
      // gravidade leve: itens sem ligação ficam por perto em vez de fugir para a borda
      .force('x', forceX(0).strength(0.07))
      .force('y', forceY(0).strength(0.07))
      .force('colisao', forceCollide<NoSim>().radius((d) => d.raio + 6))
      .on('tick', () => setTique((t) => t + 1));
    return () => { sim.stop(); };
  }, [visivel]);

  const viz = foco ? vizinhos(visivel.arestas, foco) : null;
  const pos = new Map(nosRef.current.map((n) => [n.id, n]));
  const largura = caixa.current?.clientWidth ?? 900;
  const altura = caixa.current?.clientHeight ?? 600;

  return (
    <div className="pagina grafo" ref={caixa}>
      <div className="grafo-filtros">
        {grupos.map((g) => {
          const cor = prepararGrafo({ nos: [{ id: g, nome: g, tipo: 'nota', grupo: g }], arestas: [] }).nos[0]!.cor;
          const ativo = ligados.has(g);
          return (
            <button key={g} type="button" className={`chip${ativo ? '' : ' desligado'}`} style={{ borderColor: cor }}
              onClick={() => setLigados((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; })}>
              <span className="bolinha" style={{ background: cor }} />{g || 'raiz'}
            </button>
          );
        })}
        <span className="suave">{visivel.nos.length} itens · {visivel.arestas.length} ligações</span>
      </div>
      <svg className="grafo-svg" role="img" aria-label="Grafo de conteúdos" viewBox={`${-largura / 2} ${-altura / 2} ${largura} ${altura}`}
        onWheel={(e) => setVista((v) => ({ ...v, k: Math.min(4, Math.max(0.25, v.k * (e.deltaY < 0 ? 1.1 : 0.9))) }))}
        onPointerDown={(e) => { if ((e.target as Element).tagName === 'svg') arrasto.current = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y }; }}
        onPointerMove={(e) => { const a = arrasto.current; if (a) setVista((v) => ({ ...v, x: a.vx + e.clientX - a.x, y: a.vy + e.clientY - a.y })); }}
        onPointerUp={() => { arrasto.current = null; }} onPointerLeave={() => { arrasto.current = null; }}>
        <g transform={`translate(${vista.x} ${vista.y}) scale(${vista.k})`}>
          {visivel.arestas.map((a, i) => {
            const de = pos.get(a.de);
            const para = pos.get(a.para);
            if (!de?.x || !para?.x) return null;
            const aceso = foco && (a.de === foco || a.para === foco);
            return <line key={i} x1={de.x} y1={de.y} x2={para.x} y2={para.y} className={`aresta${aceso ? ' acesa' : ''}${foco && !aceso ? ' apagada' : ''}`} />;
          })}
          {nosRef.current.map((n) => {
            if (n.x === undefined) return null;
            const apagado = foco && n.id !== foco && !viz?.has(n.id);
            return (
              <g key={n.id} transform={`translate(${n.x} ${n.y})`} className={`no-grafo${apagado ? ' apagado' : ''}${n.id === atual ? ' atual' : ''} tipo-${n.tipo}`}
                onMouseEnter={() => setFoco(n.id)} onMouseLeave={() => setFoco(null)} onClick={() => n.tipo !== 'pendente' && aoAbrir(n.id)}>
                <circle r={n.raio} fill={n.cor} />
                {(n.grau > 1 || foco === n.id || vista.k > 1.4) && <text y={n.raio + 13}>{n.nome}</text>}
              </g>
            );
          })}
        </g>
      </svg>
      <p className="suave legenda-grafo">Passe o mouse para destacar as ligações, clique para abrir. Roda do mouse aproxima; arraste o fundo para mover.</p>
    </div>
  );
}
