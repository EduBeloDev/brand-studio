import {
  Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, type Connection, type Edge, type Node, type NodeChange, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { memo, useMemo } from 'react';
import { NOMES_TIPO, cartoesPermitidos, type Cartao, type Quadro, type TipoCartao } from '../../../../core/quadro/quadro.ts';
import type { Acao } from '../logica/quadro.ts';
import { nomeDe } from './CartaoEditor.tsx';

type DadosNo = { cartao: Cartao; ordem?: number; marcado: boolean };

function resumo(c: Cartao): string {
  if (c.tipo === 'fala') return c.campos.tela || c.campos.fala || 'Fala vazia';
  if (c.tipo === 'slide') return c.campos.titulo || c.campos.mito || c.campos.modelo || 'Slide vazio';
  if (c.tipo === 'transicao') return nomeDe(c.campos.efeito || 'dissolucao');
  const e = c.campos.efeito;
  if (!e) return 'Escolha o efeito';
  return `${nomeDe(e)}${c.campos.demo ? `: ${nomeDe(c.campos.demo)}` : c.campos.detalhe ? `: ${nomeDe(c.campos.detalhe)}` : ''}`;
}

const NoCartao = memo(function NoCartao({ data, selected }: NodeProps<Node<DadosNo>>) {
  const c = data.cartao;
  return (
    <div className={`no-cartao tipo-${c.tipo}${selected ? ' selecionado' : ''}${data.marcado ? ' marcado' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="no-topo">
        <span className="no-tipo">{NOMES_TIPO[c.tipo]}{data.ordem ? ` ${data.ordem}` : ''}</span>
        {c.geradoPorIA?.length ? <em className="marca-ia">IA</em> : null}
      </div>
      <p className="no-resumo">{resumo(c).replace(/\*/g, '')}</p>
      {c.tipo === 'fala' && c.campos.fala && c.campos.tela && <p className="no-fala">"{c.campos.fala}"</p>}
      {c.instrucoes && <p className="no-instrucao">{c.instrucoes}</p>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
const TIPOS_NO = { cartao: NoCartao };

interface Props {
  quadro: Quadro;
  ordem: string[];
  selecionado?: string;
  marcados?: string[];
  aoAcao: (a: Acao) => void;
  aoSelecionar: (id?: string) => void;
}

const ADICIONAR: Record<TipoCartao, string> = { fala: '+ Fala', transicao: '+ Transição', animacao: '+ Animação', slide: '+ Slide' };

export function QuadroCanvas({ quadro, ordem, selecionado, marcados = [], aoAcao, aoSelecionar }: Props) {
  const nodes: Node<DadosNo>[] = useMemo(() => quadro.cartoes.map((c) => ({
    id: c.id, type: 'cartao', position: { x: c.x, y: c.y }, selected: c.id === selecionado,
    data: { cartao: c, ordem: ordem.indexOf(c.id) + 1 || undefined, marcado: marcados.includes(c.id) },
  })), [quadro.cartoes, ordem, selecionado, marcados]);
  const edges: Edge[] = useMemo(() => quadro.conexoes.map((x) => ({
    id: x.id, source: x.de, target: x.para, animated: true, markerEnd: { type: MarkerType.ArrowClosed },
  })), [quadro.conexoes]);

  const aoMudarNos = (mudancas: NodeChange<Node<DadosNo>>[]) => {
    for (const m of mudancas) {
      if (m.type === 'position' && m.position) aoAcao({ tipo: 'mover', id: m.id, x: m.position.x, y: m.position.y });
      if (m.type === 'select' && m.selected) aoSelecionar(m.id);
    }
  };

  return (
    <div className="quadro-canvas">
      <div className="barra-quadro">
        {cartoesPermitidos(quadro.tipo).map((t) => (
          <button key={t} type="button" className={`mini tipo-${t}`} onClick={() => aoAcao({ tipo: 'adicionar', cartao: t })}>{ADICIONAR[t]}</button>
        ))}
        <span className="suave dica-quadro">Ligue arrastando da bolinha direita de um cartão para a esquerda de outro. Delete apaga o que estiver selecionado.</span>
      </div>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={TIPOS_NO} onNodesChange={aoMudarNos}
        onConnect={(c: Connection) => c.source && c.target && aoAcao({ tipo: 'conectar', de: c.source, para: c.target })}
        onEdgesDelete={(es) => es.forEach((e) => aoAcao({ tipo: 'desconectar', id: e.id }))}
        onNodesDelete={(ns) => ns.forEach((n) => aoAcao({ tipo: 'remover', id: n.id }))}
        onPaneClick={() => aoSelecionar(undefined)} deleteKeyCode={['Delete', 'Backspace']}
        fitView fitViewOptions={{ padding: 0.25, maxZoom: 1 }} minZoom={0.2} proOptions={{ hideAttribution: true }} colorMode="dark">
        <Background gap={24} size={2} color="#3b2a66" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={(n) => ({ fala: '#b44dff', transicao: '#ff3dca', animacao: '#ffcc33', slide: '#5ab4ff' }[(n.data as DadosNo).cartao.tipo])} />
      </ReactFlow>
    </div>
  );
}
