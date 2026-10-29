export interface Producao { tipo: 'video' | 'carrossel'; nome: string; url: string; imagens?: string[]; quando: string }

export function Producoes({ itens, aoAvaliar, avaliadas }: { itens: Producao[]; aoAvaliar: (p: Producao, aprovada: boolean) => void; avaliadas: Record<string, boolean> }) {
  return (
    <div className="pagina producoes">
      <h2>Produções</h2>
      {!itens.length && <p className="suave">Nada produzido ainda. Abra um quadro e clique em "Gerar vídeo" ou "Exportar carrossel".</p>}
      <div className="grade-producoes">
        {itens.map((p) => (
          <article key={p.url} className={`producao cartao-vidro ${p.tipo}`}>
            <header>
              <span className="selo">{p.tipo === 'video' ? 'Vídeo' : 'Carrossel'}</span>
              <h3>{p.nome.replace(/\.mp4$/, '')}</h3>
              <span className="suave">{new Date(p.quando).toLocaleString('pt-BR')}</span>
            </header>
            {p.tipo === 'video' ? <video src={p.url} controls preload="metadata" />
              : <div className="slides-tira">{p.imagens?.map((i) => <a key={i} href={i} target="_blank" rel="noreferrer"><img src={i} alt="Slide" loading="lazy" /></a>)}</div>}
            <footer className="acoes">
              <a className="botao-link mini" href={p.url} download>{p.tipo === 'video' ? 'Baixar MP4' : 'Baixar .zip'}</a>
              {p.url in avaliadas ? <span className={avaliadas[p.url] ? 'ok-texto' : 'erro-texto'}>{avaliadas[p.url] ? 'Aprovada' : 'Rejeitada'}</span> : (
                <>
                  <button type="button" className="mini" onClick={() => aoAvaliar(p, true)}>Aprovar</button>
                  <button type="button" className="mini fantasma" onClick={() => aoAvaliar(p, false)}>Rejeitar</button>
                </>
              )}
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
