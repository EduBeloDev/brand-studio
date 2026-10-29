import type { ConfigRadar, EstadoRadar, ResumoSugestao } from '../../../../core/radar/radar.ts';

interface Props {
  radar: EstadoRadar;
  sugestoes: ResumoSugestao[];
  config?: ConfigRadar;
  aoPausar: () => void;
  aoRetomar: () => void;
  aoAgora: () => void;
  aoCriarQuadro: (caminho: string, tipo: 'video' | 'carrossel') => void;
  aoDescartar: (caminho: string) => void;
  aoAbrir?: (caminho: string) => void;
  aoConfig?: (parcial: Partial<ConfigRadar>) => void;
  ocupado?: string;
}

const SITUACAO: Record<EstadoRadar['situacao'], string> = {
  parado: 'Parado', rodando: 'Pesquisando agora...', aguardando: 'Esperando a próxima pesquisa', pausado: 'Pausado',
  limite: 'Parou: chegou ao limite de hoje', erro: 'A última pesquisa deu erro',
};

export const reais = (v: number) => `US$ ${v.toFixed(2).replace('.', ',')}`;
const hora = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');

export function Inicio({ radar, sugestoes, config, aoPausar, aoRetomar, aoAgora, aoCriarQuadro, aoDescartar, aoAbrir, aoConfig, ocupado }: Props) {
  const pausado = radar.situacao === 'pausado' || radar.situacao === 'parado';
  const novas = sugestoes.filter((s) => s.status === 'nova');
  const outras = sugestoes.filter((s) => s.status !== 'nova');
  return (
    <div className="pagina inicio">
      <section className={`radar cartao-vidro situacao-${radar.situacao}`}>
        <div className="radar-cabeca">
          <span className="pulso" aria-hidden />
          <div>
            <h2>Modo de aprendizado</h2>
            <p className="suave">{SITUACAO[radar.situacao]}{radar.proximoEm && radar.situacao === 'aguardando' ? `: próximo às ${hora(radar.proximoEm)}` : ''}</p>
          </div>
          <div className="radar-acoes">
            {pausado ? <button type="button" onClick={aoRetomar}>Retomar</button> : <button type="button" className="fantasma" onClick={aoPausar}>Pausar</button>}
            <button type="button" onClick={aoAgora} disabled={radar.situacao === 'rodando' || ocupado === 'radar'}>
              {ocupado === 'radar' ? 'Pesquisando...' : 'Pesquisar agora'}
            </button>
          </div>
        </div>
        <dl className="numeros">
          <div><dt>Pesquisas desde que o app abriu</dt><dd>{radar.ciclosNaSessao}{config ? ` de ${config.maxCiclosPorSessao}` : ''}</dd></div>
          <div><dt>Uso de IA hoje (estimado)</dt><dd>{reais(radar.custoHoje)}{config ? ` de ${reais(config.tetoDiarioUsd)}` : ''}</dd></div>
          <div><dt>Sugestões esperando você</dt><dd>{novas.length}</dd></div>
        </dl>
        <p className="suave nota-uso">O uso é medido pelo preço da API do Claude. Com login pela assinatura do Claude, não é cobrança à parte:
          ele gasta o limite de uso da assinatura. O limite por dia faz o radar parar antes de gastar demais.</p>
        {radar.ultimoErro && <p className="erro-texto">{radar.ultimoErro}</p>}
        {radar.ultimasDescobertas.length > 0 && (
          <p className="descobertas">A última pesquisa trouxe: {radar.ultimasDescobertas.slice(0, 6).map((c) => (
            <button key={c} type="button" className="ligacao" onClick={() => aoAbrir?.(c)}>{c.split('/').pop()!.replace(/\.md$/, '')}</button>))}
          </p>
        )}
        {config && aoConfig && (
          <details className="config">
            <summary>Configurações do radar</summary>
            <label><input type="checkbox" checked={config.ativoAoAbrir} onChange={(e) => aoConfig({ ativoAoAbrir: e.target.checked })} /> Pesquisar sozinho quando o app abrir</label>
            <label>Minutos entre uma pesquisa e outra <input type="number" min={1} max={1440} value={config.intervaloMin} onChange={(e) => aoConfig({ intervaloMin: Number(e.target.value) })} /></label>
            <label>Máximo de pesquisas cada vez que o app abre <input type="number" min={1} max={100} value={config.maxCiclosPorSessao} onChange={(e) => aoConfig({ maxCiclosPorSessao: Number(e.target.value) })} /></label>
            <label>Limite de uso de IA por dia (US$ estimado) <input type="number" min={0} max={50} step={0.1} value={config.tetoDiarioUsd} onChange={(e) => aoConfig({ tetoDiarioUsd: Number(e.target.value) })} /></label>
          </details>
        )}
      </section>

      <section>
        <h2 className="titulo-secao">Sugestões para produzir</h2>
        {!novas.length && <p className="suave">Ainda sem sugestões novas. Clique em "Pesquisar agora" ou jogue uma referência em Roubar ideias.</p>}
        <div className="grade-sugestoes">
          {novas.map((s) => (
            <article key={s.caminho} className="sugestao cartao-vidro">
              <span className={`selo origem-${s.origem}`}>{s.origem === 'referencia' ? 'de uma referência' : 'do radar'}</span>
              <h3><button type="button" className="ligacao forte" onClick={() => aoAbrir?.(s.caminho)}>{s.titulo}</button></h3>
              <p className="suave">{s.criada} · {s.formato === 'ambos' ? 'vídeo ou carrossel' : s.formato}</p>
              <div className="acoes">
                <button type="button" onClick={() => aoCriarQuadro(s.caminho, 'video')} disabled={!!ocupado}>Vídeo</button>
                <button type="button" onClick={() => aoCriarQuadro(s.caminho, 'carrossel')} disabled={!!ocupado}>Carrossel</button>
                <button type="button" className="fantasma" onClick={() => aoDescartar(s.caminho)}>Descartar</button>
              </div>
              {ocupado === s.caminho && <p className="suave">A IA está montando o quadro...</p>}
            </article>
          ))}
        </div>
        {outras.length > 0 && (
          <details className="historico">
            <summary>Já usadas ou descartadas ({outras.length})</summary>
            <ul>{outras.map((s) => <li key={s.caminho}><button type="button" className="ligacao" onClick={() => aoAbrir?.(s.caminho)}>{s.titulo}</button> <span className="suave">({s.status})</span></li>)}</ul>
          </details>
        )}
      </section>
    </div>
  );
}
