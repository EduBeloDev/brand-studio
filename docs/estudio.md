# Estúdio de conteúdo: plano, decisões e andamento

Fonte da verdade da construção do estúdio dentro do app (conteúdos, grafo, quadros, carrossel, IA, memória de
branding e modo de aprendizado). Decisões do usuário estão no CLAUDE.md; as decisões tomadas de forma autônoma,
a pedido do usuário (29/10/2026: "decida pensando em fluidez, eficiência e processos que podem ser melhorados"),
ficam registradas aqui.

## Decisões autônomas (29/10/2026)

Critério pedido: fluidez, eficiência, interface bonita e fácil, máximo de automação.

- **Estado de máquina separado das notas.** Tudo que é só para o app (eventos da memória, índice do radar,
  configurações, custos, prévias em cache) fica em `conteudo/.estudio/`, fora do git. As notas legíveis ficam
  nas pastas normais e são versionadas. Assim o grafo e a barra lateral mostram só o que a pessoa lê.
- **Lixeira com restauração.** Excluir move para `conteudo/.lixeira/<id>/` com a origem anotada; dá para restaurar.
- **Renomear atualiza as ligações** `[[nome]]` nas outras notas, como no Obsidian (evita links quebrados).
- **Mover com nome repetido não trava:** o item ganha o sufixo " (2)", " (3)"... e a tela mostra o novo nome.
- **Quadros salvam sozinhos** (com atraso curto depois de cada mudança) e a prévia se atualiza sozinha.
- **Transição entre duas falas** (fala A → transição → fala B) é aceita e vira a transição de saída da fala A;
  o usuário não precisa saber a regra de "cartão preso à fala".
- **Modo de aprendizado (radar)** usa o Claude Code com só duas ferramentas liberadas: busca na web e leitura de
  páginas. Começa sozinho quando o app abre (pode desligar), roda em ciclos com intervalo, respeita um teto de
  custo por dia e de ciclos por sessão, e pode ser pausado na tela inicial. Usa o modelo Sonnet (mais barato e
  rápido; teste de 29/10: 8 s e US$ 0,012 numa pesquisa curta). O custo de cada ciclo é anotado.
- **O radar escreve notas ligadas entre si** em `conteudo/conhecimento/` (tendências, jargões com pronúncia para
  a narração, sugestões de vídeo), com fontes e datas e marcando o nível de evidência; o grafo cresce sozinho.
- **Sugestão vira quadro com um clique:** a IA monta o quadro de vídeo (falas, textos de tela, transições) ou de
  carrossel (slides com modelo e campos), já usando a memória de branding.
- **Memória de branding consolida sozinha** a cada 10 eventos novos (e por botão); a consolidação só reescreve
  as notas automáticas (`branding/aprendizados/`).
- **Geração de IA sempre volta como JSON validado**; se a IA errar o formato, o app tenta extrair o JSON e, se não
  der, mostra o erro sem quebrar o quadro.
- **Demonstrações genéricas** para qualquer tema (o vídeo dos mitos tinha demonstrações feitas sob medida): janela de
  código com saída, terminal, lista de passos e comparação lado a lado, todas na janela do sistema antigo aprovada.
- **Dicionário de pronúncia** em `conteudo/branding/identidade/pronuncia.md` (tabela termo → como falar), aplicado
  sozinho antes da narração; o radar acrescenta pronúncias de jargões novos. A legenda e a tela mostram a grafia normal.
- **Legenda da fala desligada por padrão** (o vídeo B aprovado não tinha); opção por quadro.
- **Quadros sem ligações seguem a posição** (da esquerda para a direita), com aviso, para não exigir ligar tudo à mão.
- **Testes da interface** com jsdom + Testing Library (MIT) para os componentes principais; a lógica da tela fica em
  módulos puros testados sem navegador.
- **Ajuda** com busca, perguntas frequentes e um passo a passo para cada fluxo; um teste garante que toda função do
  app tem um tópico de ajuda.
- **Roubar ideias (pedido de 29/10/2026)**: a pessoa joga um vídeo, áudio ou imagem; o app extrai localmente o que dá
  (duração, cortes e ritmo, quadros-chave, transcrição com Whisper, paleta de cores) e a IA analisa vendo os quadros
  (ferramenta de leitura liberada só para a pasta daquela referência). Regras: pegar a ideia como referência, nunca
  copiar; descrever técnicas e estruturas; reescrever com a voz e o personagem da marca. Uma trava compara as ideias
  geradas com a transcrição e descarta trecho copiado (8 ou mais palavras iguais seguidas). Técnicas aprendidas viram
  notas em `conhecimento/tecnicas/` e sugestões de vídeo; transição nova vista numa referência entra como sugestão,
  não como aprovada (regra do catálogo). Mídias de terceiros ficam em `conteudo/referencias/` e não vão para o git.
- **Prévia da técnica roubada num vídeo meu (pedido de 29/10/2026)**: para cada técnica, a IA indica o efeito mais
  próximo que o motor já sabe fazer (`efeito_proximo`; desconhecido vira dissolução). A pessoa escolhe um vídeo já
  produzido e o app renderiza em segundos um trecho de ~3 s com o efeito aplicado. A tela avisa que é aproximação.

## Etapas

Regra do projeto: testes antes de cada caso de uso (TDD), rodados até passar.

| Etapa | Conteúdo | Situação |
| --- | --- | --- |
| E1 | Núcleo de conteúdo: caminhos seguros, árvore, criar/editar/renomear/mover/excluir/restaurar, anexos, ligações e grafo | feito (testes verdes) |
| E2 | Quadros: modelo, validação e ordem (vídeo e carrossel); modelos de slide | feito (testes verdes) |
| E3 | IA: Claude Code restrito + IA falsa; geração de fala e de slide; quadro a partir de sugestão | feito (testes verdes) |
| E4 | Memória de branding: eventos, preferências, notas automáticas, consolidação, contexto | feito (testes verdes) |
| E5 | Modo de aprendizado (radar): ciclos, notas de conhecimento, sugestões, limites, pausa | feito (testes verdes) |
| E6 | Renderização: prévia de cena, slides + zip, vídeo completo; fila de tarefas | feito (testes verdes; slides e cena conferidos no olho) |
| E7 | API HTTP | feito (testes verdes) |
| E8 | Interface React: início (radar), conteúdos + grafo, quadro, branding, peças, ajuda | feito (testes verdes; telas conferidas no Firefox) |
| E9 | Documentação e conferência final | feito em 29/10 (README e CLAUDE.md atualizados; rotas da aba Peças movidas para `web/pecas.ts` com testes, recuperando o limite de 10 KB; 174 testes verdes, tipos sem erro) |
| E10 | Produção pela própria ferramenta: 3 pesquisas, 3 carrosséis, 3 vídeos | produzido em 29/10 e aguardando revisão (detalhes da produção só no computador, em `CLAUDE.local.md`). Defeito aberto: saída longa no console da demonstração de código é cortada na borda, sem quebrar linha |

Ordem pedida pelo usuário (29/10/2026): primeiro os testes de todas as áreas (E1 a E8), depois desenvolver rodando os
testes. **Feito em 29/10/2026:** 16 arquivos de teste novos (núcleo, IA, marca, radar, roubar ideias, renderização,
API e interface) escritos e rodados: todos falhando por falta do código, como esperado. Problemas encontrados vão para [problemas.md](problemas.md).
