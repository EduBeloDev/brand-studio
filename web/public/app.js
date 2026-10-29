const grade = document.getElementById('grade');
const vazio = document.getElementById('vazio');
const mensagem = document.getElementById('mensagem');
const formGerar = document.getElementById('form-gerar');
const campoTema = document.getElementById('tema-campo');
const botaoGerar = document.getElementById('botao-gerar');
const botaoTema = document.getElementById('tema');
const rotuloTema = document.getElementById('tema-rotulo');

const ROTULOS = { 'aguardando-aprovacao': 'Aguardando', aprovada: 'Aprovada', rejeitada: 'Rejeitada' };

let pecas = [];
let filtro = 'aguardando-aprovacao';

function dizer(texto, ehErro = false) {
  mensagem.textContent = texto;
  mensagem.classList.toggle('erro', ehErro);
}

async function api(caminho, opcoes) {
  const resposta = await fetch(caminho, opcoes);
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || 'Algo deu errado.');
  return dados;
}

function enviar(caminho, corpo) {
  return api(caminho, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
}

/* Tema claro/escuro */
function aplicarTema(tema) {
  document.documentElement.dataset.theme = tema;
  rotuloTema.textContent = tema === 'dark' ? 'Tema claro' : 'Tema escuro';
  try { localStorage.setItem('tema', tema); } catch {}
}
botaoTema.addEventListener('click', () => {
  aplicarTema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
aplicarTema(document.documentElement.dataset.theme);

/* A luz que segue o mouse nos botões */
document.addEventListener('pointermove', (evento) => {
  const botao = evento.target.closest?.('.botao');
  if (!botao) return;
  const caixa = botao.getBoundingClientRect();
  botao.style.setProperty('--mx', `${evento.clientX - caixa.left}px`);
  botao.style.setProperty('--my', `${evento.clientY - caixa.top}px`);
});

/* Lista de peças. textContent em tudo que veio do usuário: nunca innerHTML. */
function criarCartao(peca) {
  const cartao = document.createElement('article');
  cartao.className = 'peca';

  const imagem = document.createElement('img');
  imagem.className = 'peca-visual';
  imagem.alt = `Visual da peça: ${peca.roteiro.titulo}`;
  imagem.src = `/pecas/${encodeURIComponent(peca.id)}/${encodeURIComponent(peca.visual)}`;

  const corpo = document.createElement('div');
  corpo.className = 'peca-corpo';

  const selo = document.createElement('span');
  selo.className = `selo selo-${peca.status}`;
  selo.textContent = ROTULOS[peca.status];

  const titulo = document.createElement('h3');
  titulo.className = 'peca-titulo';
  titulo.textContent = peca.roteiro.titulo;

  const legenda = document.createElement('p');
  legenda.className = 'peca-legenda';
  legenda.textContent = peca.roteiro.legenda;

  corpo.append(selo, titulo, legenda);

  if (peca.avisos.length > 0) {
    const avisos = document.createElement('ul');
    avisos.className = 'peca-avisos';
    for (const aviso of peca.avisos) {
      const item = document.createElement('li');
      item.textContent = aviso;
      avisos.append(item);
    }
    corpo.append(avisos);
  }

  if (peca.status === 'aguardando-aprovacao') {
    const acoes = document.createElement('div');
    acoes.className = 'peca-acoes';
    acoes.append(
      criarAcao('Aprovar', 'botao-aprovar', peca.id, 'aprovada'),
      criarAcao('Rejeitar', 'botao-rejeitar', peca.id, 'rejeitada'),
    );
    corpo.append(acoes);
  }

  cartao.append(imagem, corpo);
  return cartao;
}

function criarAcao(rotulo, classe, id, status) {
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = `botao ${classe}`;
  botao.textContent = rotulo;
  botao.addEventListener('click', async () => {
    botao.disabled = true;
    try {
      await enviar(`/api/pecas/${encodeURIComponent(id)}/status`, { status });
      dizer(`Peça ${status === 'aprovada' ? 'aprovada' : 'rejeitada'}.`);
      await carregar();
    } catch (erro) {
      dizer(erro.message, true);
      botao.disabled = false;
    }
  });
  return botao;
}

function desenhar() {
  const visiveis = filtro === 'todas' ? pecas : pecas.filter((p) => p.status === filtro);
  grade.replaceChildren(...visiveis.map(criarCartao));
  vazio.hidden = visiveis.length > 0;
}

async function carregar() {
  pecas = await api('/api/pecas');
  desenhar();
}

document.querySelectorAll('.botao-filtro').forEach((botao) => {
  botao.addEventListener('click', () => {
    filtro = botao.dataset.filtro;
    document.querySelectorAll('.botao-filtro').forEach((b) => b.setAttribute('aria-pressed', String(b === botao)));
    desenhar();
  });
});

formGerar.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  botaoGerar.disabled = true;
  dizer('Gerando...');
  try {
    await enviar('/api/pecas', { tema: campoTema.value });
    campoTema.value = '';
    dizer('Peça criada e aguardando sua aprovação.');
    filtro = 'aguardando-aprovacao';
    document.querySelectorAll('.botao-filtro').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filtro === filtro)));
    await carregar();
  } catch (erro) {
    dizer(erro.message, true);
  } finally {
    botaoGerar.disabled = false;
  }
});

carregar().catch((erro) => dizer(erro.message, true));
