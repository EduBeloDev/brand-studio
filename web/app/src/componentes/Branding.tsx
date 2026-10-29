import type { Evento, Preferencias } from '../../../../core/branding/memoria.ts';
import { descreverEventoTela } from '../logica/textos.ts';
import { Markdown } from './Markdown.tsx';

export interface DadosBranding { eventos: number; preferencias: Preferencias; perfil: string; recentes: Evento[]; marca?: { nome: string } }

const NOTAS = [
  ['branding/objetivo.md', 'Objetivo'], ['branding/identidade/visual.md', 'Visual'], ['branding/identidade/voz-e-tom.md', 'Voz e tom'],
  ['branding/identidade/personagem.md', 'Personagem'], ['branding/identidade/pronuncia.md', 'Pronúncia'],
  ['branding/escolhas/aprovadas.md', 'Aprovadas'], ['branding/escolhas/rejeitadas.md', 'Rejeitadas'],
] as const;

function Top({ titulo, itens }: { titulo: string; itens: [string, number][] }) {
  const max = Math.max(1, ...itens.map((i) => i[1]));
  return (
    <div className="top">
      <h4>{titulo}</h4>
      {!itens.length && <p className="suave">Ainda nada.</p>}
      {itens.slice(0, 5).map(([k, n]) => (
        <div key={k} className="barra-top"><span>{k.replace('_', ' ')}</span><i style={{ width: `${(n / max) * 100}%` }} /><b>{n}</b></div>
      ))}
    </div>
  );
}

export function Branding({ dados, aoAbrir, aoConsolidar, consolidando }: { dados: DadosBranding | null; aoAbrir: (c: string) => void; aoConsolidar: () => void; consolidando?: boolean }) {
  if (!dados) return <div className="pagina"><p className="suave">Carregando a memória da marca...</p></div>;
  const p = dados.preferencias;
  return (
    <div className="pagina branding">
      <header className="cabeca-doc">
        <h2>Memória da marca</h2>
        <span className="suave">{dados.eventos} escolha{dados.eventos === 1 ? '' : 's'} registrada{dados.eventos === 1 ? '' : 's'}</span>
        <button type="button" onClick={aoConsolidar} disabled={consolidando}>{consolidando ? 'Consolidando...' : 'Consolidar agora'}</button>
      </header>
      <nav className="notas-marca">{NOTAS.map(([c, n]) => <button key={c} type="button" className="chip" onClick={() => aoAbrir(c)}>{n}</button>)}</nav>
      <div className="branding-grade">
        <section className="cartao-vidro perfil"><Markdown texto={dados.perfil || '# Perfil da marca\n\nAinda não consolidado.'} /></section>
        <section className="cartao-vidro preferencias">
          <h3>O que você mais escolhe</h3>
          <Top titulo="Transições" itens={p.transicoes} />
          <Top titulo="Animações" itens={p.animacoes} />
          <Top titulo="Expressões" itens={p.expressoes} />
          <Top titulo="Modelos de slide" itens={p.modelos} />
          <Top titulo="Campos que você corrige depois da IA" itens={p.camposEditados} />
        </section>
        <section className="cartao-vidro recentes">
          <h3>Escolhas recentes</h3>
          <ul>{dados.recentes.map((e, i) => <li key={i}><span className="suave">{new Date(e.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> {descreverEventoTela(e)}</li>)}</ul>
        </section>
      </div>
    </div>
  );
}
