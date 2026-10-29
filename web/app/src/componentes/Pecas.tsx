import { useEffect, useState } from 'react';
import { api } from '../api.ts';

interface Peca { id: string; criadaEm: string; status: string; pedido: { tema: string }; roteiro: { titulo: string; legenda: string }; visual: string; avisos: string[] }
const ROTULOS: Record<string, string> = { 'aguardando-aprovacao': 'Aguardando', aprovada: 'Aprovada', rejeitada: 'Rejeitada' };

/** A esteira de peças (painel antigo): gerar a partir de um tema e aprovar ou rejeitar. */
export function Pecas({ aoErro }: { aoErro: (m: string) => void }) {
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [tema, setTema] = useState('');
  const carregar = () => api.get<Peca[]>('/api/pecas').then(setPecas).catch((e) => aoErro(e.message));
  useEffect(() => { void carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="pagina pecas">
      <h2>Peças da esteira</h2>
      <form className="linha-form" onSubmit={async (e) => {
        e.preventDefault();
        try { await api.post('/api/pecas', { tema }); setTema(''); await carregar(); } catch (er) { aoErro((er as Error).message); }
      }}>
        <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Tema da peça" aria-label="Tema da peça" />
        <button type="submit" disabled={!tema.trim()}>Gerar</button>
      </form>
      <div className="grade-producoes">
        {pecas.map((p) => (
          <article key={p.id} className="cartao-vidro producao">
            <img src={`/pecas/${encodeURIComponent(p.id)}/${encodeURIComponent(p.visual)}`} alt={p.roteiro.titulo} />
            <h3>{p.roteiro.titulo}</h3>
            <p className="suave">{ROTULOS[p.status]}</p>
            {p.status === 'aguardando-aprovacao' && (
              <div className="acoes">
                <button type="button" className="mini" onClick={() => api.post(`/api/pecas/${p.id}/status`, { status: 'aprovada' }).then(carregar)}>Aprovar</button>
                <button type="button" className="mini fantasma" onClick={() => api.post(`/api/pecas/${p.id}/status`, { status: 'rejeitada' }).then(carregar)}>Rejeitar</button>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
