import { useState } from 'react';

export interface TecnicaTela { nome: string; tipo: string; como_usar: string; efeito_proximo: string }
export interface ReferenciaTela {
  pasta: string;
  titulo: string;
  resumo: string;
  tecnicas: TecnicaTela[];
  analisada?: boolean;
  midia?: string;
  ritmo?: string;
  cores?: string[];
  ideias?: { titulo: string; como_adaptar: string; formato: string }[];
}
export interface VideoMeu { nome: string; caminho: string; url?: string }

interface Props {
  referencias: ReferenciaTela[];
  aoEnviar: (arquivo: File) => void;
  aoPrevia?: (p: { efeito: string; video: string; inicio?: number }) => void;
  videos?: VideoMeu[];
  previa?: { url: string; efeito: string };
  ocupado?: boolean;
  aoAbrir?: (caminho: string) => void;
}

const EFEITOS: Record<string, string> = { dissolucao: 'dissolução', desmontagem: 'desmontagem em pixels', blocos: 'blocos de pixels', glitch: 'glitch colorido', zoom: 'zoom de impacto', cacos: 'quebra em cacos' };

export function RoubarIdeias({ referencias, aoEnviar, aoPrevia, videos = [], previa, ocupado, aoAbrir }: Props) {
  const [soltando, setSoltando] = useState(false);
  const [video, setVideo] = useState('');
  const [inicio, setInicio] = useState(2);
  const escolhido = video || videos[0]?.caminho || '';
  return (
    <div className="pagina roubar">
      <section className="cartao-vidro regra">
        <h2>Roubar ideias, como artista</h2>
        <p>Jogue aqui um vídeo, áudio, imagem ou texto que você curtiu. O app estuda o ritmo, os cortes, as transições, o humor
          e a estrutura, e devolve ideias <strong>adaptadas à sua marca</strong>, com a nossa voz e o nosso personagem.</p>
        <p className="destaque-regra">A referência serve só de inspiração: o app não copia falas, imagens, marcas nem músicas.
          Ideia que repete trecho da fala original é descartada sozinha.</p>
      </section>
      <label className={`zona-soltar${soltando ? ' ativa' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setSoltando(true); }} onDragLeave={() => setSoltando(false)}
        onDrop={(e) => { e.preventDefault(); setSoltando(false); const f = e.dataTransfer.files[0]; if (f) aoEnviar(f); }}>
        <span className="zona-titulo">{ocupado ? 'Enviando...' : 'Arraste o arquivo aqui'}</span>
        <span className="suave">ou clique para escolher (vídeo, áudio, imagem ou texto)</span>
        <input type="file" aria-label="Escolher arquivo" accept="video/*,audio/*,image/*,.txt,.md,.srt,.vtt"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) aoEnviar(f); e.target.value = ''; }} />
      </label>

      {videos.length > 0 && referencias.some((r) => r.tecnicas.length) && (
        <section className="cartao-vidro escolher-video">
          <h3>Testar nas minhas peças</h3>
          <label>Vídeo <select value={escolhido} onChange={(e) => setVideo(e.target.value)}>
            {videos.map((v) => <option key={v.caminho} value={v.caminho}>{v.nome}</option>)}
          </select></label>
          <label>A partir do segundo <input type="number" min={0} step={0.5} value={inicio} onChange={(e) => setInicio(Number(e.target.value))} /></label>
          {previa && (
            <figure className="previa-tecnica">
              <video src={previa.url} controls autoPlay loop muted={false} />
              <figcaption className="suave">Aproximação com o efeito "{EFEITOS[previa.efeito] ?? previa.efeito}" do nosso motor.</figcaption>
            </figure>
          )}
        </section>
      )}

      <section>
        <h2 className="titulo-secao">Referências estudadas</h2>
        {!referencias.length && <p className="suave">Nenhuma ainda.</p>}
        <div className="lista-referencias">
          {referencias.map((r) => (
            <article key={r.pasta} className="referencia cartao-vidro">
              <header>
                <h3>{r.titulo}</h3>
                {r.analisada === false ? <span className="selo">analisando...</span>
                  : <button type="button" className="mini fantasma" onClick={() => aoAbrir?.(`${r.pasta}/analise.md`)}>Abrir análise</button>}
              </header>
              {r.resumo && <p>{r.resumo}</p>}
              {r.ritmo && <p className="suave">Ritmo: {r.ritmo}</p>}
              {r.cores && r.cores.length > 0 && <div className="paleta">{r.cores.map((c) => <span key={c} style={{ background: c }} title={c} />)}</div>}
              {r.tecnicas.length > 0 && <h4>Técnicas</h4>}
              <ul className="tecnicas">
                {r.tecnicas.map((t) => (
                  <li key={t.nome}>
                    <div><strong>{t.nome}</strong> <span className="selo">{t.tipo}</span><p className="suave">{t.como_usar}</p>
                      <p className="suave">Mais parecido no nosso motor: {EFEITOS[t.efeito_proximo] ?? t.efeito_proximo}</p></div>
                    {aoPrevia && (
                      <button type="button" className="mini" disabled={!escolhido || ocupado}
                        onClick={() => aoPrevia({ efeito: t.efeito_proximo, video: escolhido, ...(video || inicio !== 2 ? { inicio } : {}) })}>
                        Ver no meu vídeo
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {r.ideias && r.ideias.length > 0 && (
                <>
                  <h4>Ideias adaptadas</h4>
                  <ul className="ideias">{r.ideias.map((i) => <li key={i.titulo}><strong>{i.titulo}</strong>: {i.como_adaptar}</li>)}</ul>
                </>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
