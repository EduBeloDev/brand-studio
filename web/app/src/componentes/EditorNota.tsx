import { useEffect, useRef, useState } from 'react';
import { api, q, urlArquivo } from '../api.ts';
import { Markdown } from './Markdown.tsx';

interface Nota { caminho: string; conteudo: string; ligacoes: { alvo: string; caminho: string | null }[]; retroligacoes: string[] }

interface Props {
  caminho: string;
  aoAbrir: (caminho: string) => void;
  aoCriarPendente: (alvo: string) => void;
  aoErro: (m: string) => void;
}

export function EditorNota({ caminho, aoAbrir, aoCriarPendente, aoErro }: Props) {
  const [nota, setNota] = useState<Nota | null>(null);
  const [texto, setTexto] = useState('');
  const [modo, setModo] = useState<'ler' | 'editar'>('ler');
  const [estado, setEstado] = useState<'salvo' | 'salvando' | 'alterado'>('salvo');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const carregar = () => api.get<Nota>(`/api/nota?caminho=${q(caminho)}`).then((n) => { setNota(n); setTexto(n.conteudo); }).catch((e) => aoErro(e.message));
  useEffect(() => {
    setNota(null);
    setModo('ler');
    void carregar();
    return () => clearTimeout(timer.current);
  }, [caminho]); // eslint-disable-line react-hooks/exhaustive-deps

  const mudar = (v: string) => {
    setTexto(v);
    setEstado('alterado');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setEstado('salvando');
      try {
        await api.put('/api/nota', { caminho, conteudo: v });
        setEstado('salvo');
        const n = await api.get<Nota>(`/api/nota?caminho=${q(caminho)}`);
        setNota(n);
      } catch (e) {
        aoErro((e as Error).message);
        setEstado('alterado');
      }
    }, 700);
  };

  const irPara = (alvo: string) => {
    const l = nota?.ligacoes.find((x) => x.alvo === alvo);
    if (l?.caminho) aoAbrir(l.caminho);
    else aoCriarPendente(alvo);
  };

  if (!nota) return <div className="pagina"><p className="suave">Abrindo...</p></div>;
  const imagens = nota.ligacoes.filter((l) => l.caminho && /\.(png|jpe?g|gif|webp)$/i.test(l.caminho));
  return (
    <div className="pagina editor-nota">
      <header className="cabeca-doc">
        <h2>{caminho.split('/').pop()!.replace(/\.md$/, '')}</h2>
        <span className="suave caminho">{caminho}</span>
        <span className={`estado-salvo ${estado}`}>{estado === 'salvo' ? 'Salvo' : estado === 'salvando' ? 'Salvando...' : 'Editando'}</span>
        <div className="alternar">
          <button type="button" className={modo === 'ler' ? 'ativo' : ''} onClick={() => setModo('ler')}>Ler</button>
          <button type="button" className={modo === 'editar' ? 'ativo' : ''} onClick={() => setModo('editar')}>Editar</button>
        </div>
      </header>
      {modo === 'editar'
        ? <textarea className="texto-nota" value={texto} onChange={(e) => mudar(e.target.value)} spellCheck autoFocus aria-label="Texto da nota" />
        : <div className="leitura" onDoubleClick={() => setModo('editar')}><Markdown texto={texto} aoLigacao={irPara} />
          {imagens.map((l) => <img key={l.caminho} className="anexo-img" src={urlArquivo(l.caminho!)} alt={l.alvo} />)}</div>}
      <footer className="ligacoes-nota">
        <div>
          <h4>Ligações</h4>
          {!nota.ligacoes.length && <p className="suave">Nenhuma. Escreva [[nome]] para ligar.</p>}
          {nota.ligacoes.map((l, i) => (
            <button key={i} type="button" className={`chip${l.caminho ? '' : ' pendente'}`} onClick={() => irPara(l.alvo)}
              title={l.caminho ? l.caminho : 'Ainda não existe: clique para criar'}>{l.alvo}</button>
          ))}
        </div>
        <div>
          <h4>Retroligações</h4>
          {!nota.retroligacoes.length && <p className="suave">Nenhuma nota aponta para esta.</p>}
          {nota.retroligacoes.map((c) => <button key={c} type="button" className="chip" onClick={() => aoAbrir(c)}>{c.replace(/\.md$/, '')}</button>)}
        </div>
      </footer>
    </div>
  );
}

export function VerAnexo({ caminho }: { caminho: string }) {
  const url = urlArquivo(caminho);
  const ext = caminho.split('.').pop()!.toLowerCase();
  return (
    <div className="pagina anexo">
      <header className="cabeca-doc"><h2>{caminho.split('/').pop()}</h2><a className="mini botao-link" href={url} download>Baixar</a></header>
      {['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) && <img className="anexo-grande" src={url} alt={caminho} />}
      {['mp4', 'webm', 'mov'].includes(ext) && <video className="anexo-grande" src={url} controls />}
      {['mp3', 'wav', 'ogg', 'm4a'].includes(ext) && <audio src={url} controls />}
      {ext === 'pdf' && <iframe className="anexo-grande" src={url} title={caminho} />}
      {['txt', 'json', 'srt', 'vtt'].includes(ext) && <iframe className="anexo-grande texto" src={url} title={caminho} />}
    </div>
  );
}
