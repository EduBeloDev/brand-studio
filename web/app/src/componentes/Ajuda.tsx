import { useState } from 'react';
import { buscar, type Topico } from '../ajuda/conteudo.ts';

export function Ajuda() {
  const [consulta, setConsulta] = useState('');
  const [aberto, setAberto] = useState<Topico | null>(null);
  const achados = buscar(consulta);
  return (
    <div className="pagina ajuda">
      <h2>Ajuda</h2>
      <input className="busca grande" type="search" placeholder="Qual a sua dúvida? (ex.: lixeira, gerar vídeo, pausar aprendizado)"
        value={consulta} onChange={(e) => { setConsulta(e.target.value); setAberto(null); }} autoFocus />
      <div className="ajuda-corpo">
        <ul className="ajuda-lista">
          {achados.map((t) => (
            <li key={t.id} className={aberto?.id === t.id ? 'atual' : ''}>
              <button type="button" onClick={() => setAberto(t)}><strong>{t.titulo}</strong><span className="suave">{t.resumo}</span></button>
            </li>
          ))}
          {!achados.length && <li className="vazio">Nada encontrado. Tente outra palavra.</li>}
        </ul>
        {aberto && (
          <article className="ajuda-topico cartao-vidro">
            <h3>{aberto.titulo}</h3>
            <p>{aberto.resumo}</p>
            <ol>{aberto.passos.map((p) => <li key={p}>{p}</li>)}</ol>
            {aberto.dica && <p className="dica">{aberto.dica}</p>}
          </article>
        )}
      </div>
    </div>
  );
}
