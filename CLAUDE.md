# brand-studio: esteira automática de peças de marca

Uma linha de montagem que recebe um pedido ("post sobre X") e entrega a peça pronta para aprovar: texto, imagem e, mais adiante, vídeo, sempre dentro da identidade da marca.

## Como trabalhar neste projeto

- **SEMPRE escrever os testes antes de implementar ou alterar um caso de uso (TDD).** Definir o comportamento esperado e os critérios de aceitação, criar testes que cubram o fluxo principal e os erros relevantes e executá-los para confirmar que falham pelo comportamento ainda ausente ou incorreto. Só então implementar o caso de uso, executar os testes até passarem e refatorar mantendo-os verdes. Não deixar os testes para depois nem considerar o caso de uso concluído sem executar e conferir os resultados. Se algum teste não puder ser executado por limitação do ambiente, registrar o bloqueio explicitamente; não declarar validação concluída.
- Usuário iniciante: explicar em português simples; termo técnico inevitável ganha uma frase dizendo o que é.
- Antes de construir algo novo, abrir uma rodada de decisão: até 3 perguntas, cada uma com alternativas (a)/(b)/(c), uma marcada como recomendada e o porquê em uma linha. Registrar o que foi fechado em "Decisões".
- Em toda decisão, dizer antes da escolha quais riscos (lista abaixo) ela toca e como evitar. Risco novo vai para a lista.
- Conferir antes de afirmar; o que não foi conferido é dito como "a conferir".
- Sem emojis no código e nas mensagens.
- Commit e push só com autorização.
- Manter "Onde paramos" atualizado.
- Projeto independente: não citar outros repositórios nem apps de clientes neste arquivo nem no código.
- **A marca fica só neste computador.** Nome, personagem, identidade, roteiros, quadros, pesquisas, mídias e decisões criativas da marca nunca vão para o git: ficam em `conteudo/` (só `conteudo/kit/icones/` e `conteudo/templates/` são versionados), `amostras/personagem/`, nos scripts das amostras listados no `.gitignore` e em `CLAUDE.local.md`. O código não cita o nome da marca: ele vem de `conteudo/branding/marca.json` (padrão neutro "minha marca"). O teste `core/branding/marca.test.ts` falha se o nome aparecer em arquivo versionado.
- Ler `CLAUDE.local.md` (só neste computador): regras criativas, decisões de voz, personagem e direção visual da marca, e o histórico detalhado de "Onde paramos".
- Ao trabalhar em geração de imagens, vídeos e carrosséis, ler e aplicar as diretrizes de qualidade visual abaixo. Registrar novas decisões aqui para que orientem as próximas sessões.

## A linha

```
pedido → marca → roteiro → visual → revisão → saída
```

Hoje todas as estações são PROVISÓRIAS (devolvem resultado fixo) para a linha rodar de ponta a ponta. Cada uma vai ser trocada pela versão real, uma por vez, sem mexer nas outras.

## Estrutura

```
brand-studio/
├── core/                 o núcleo: tudo o que a esteira sabe fazer. Não lê teclado nem desenha tela.
│   ├── tipos.ts          contratos entre as estações. Mudar aqui é decisão (afeta várias estações).
│   ├── linha.ts          a ordem das estações. Único arquivo que conhece a linha inteira.
│   ├── saida.ts          grava e lê as peças em saida/.
│   ├── linha.test.ts     testes da linha e da revisão.
│   └── estacoes/         uma estação por arquivo; cada uma só conhece tipos.ts.
│       ├── marca.ts      carrega o kit da marca
│       ├── roteiro.ts    escreve título e legenda
│       ├── visual.ts     cria o arquivo visual
│       └── revisao.ts    conferência automática, antes da aprovação humana
│   (estúdio) conteudo/, quadro/, carrossel/, ia/, branding/, radar/, referencias/, render/: ver docs/estudio.md
├── cli/
│   └── index.ts          os comandos. Fino: só lê o que foi digitado e chama core/.
├── web/                  o app. Fino como o cli/: traduz pedidos HTTP em chamadas ao core/.
│   ├── server.ts         só monta as peças reais e liga o servidor (127.0.0.1). Sem regra: não tem teste.
│   ├── api.ts            API do estúdio; pecas.ts: rotas da aba Peças. Ambos com testes.
│   ├── app/              interface React + Vite; constrói em web/dist/ (fora do git).
│   └── public/           painel antigo em HTML puro; não é mais servido (a decidir se sai).
├── conteudo/             notas, quadros, branding e conhecimento; .estudio/ e .lixeira/ fora do git.
├── amostras/             motor em Python (estudio_render.py) chamado pelo app para prévias, vídeos e carrosséis.
└── saida/                as peças geradas, uma pasta por peça (peca.json, legenda.txt, visual). Fora do git.
```

Regra: o que só serve para o terminal fica em cli/; o que o painel web também vai precisar fica em core/.

## Como rodar

Precisa de Node 22.18 ou mais novo, com suporte a TypeScript: ele roda os .ts direto, sem build. O tsc só confere os tipos. O Node do sistema desta máquina foi compilado sem esse suporte, por isso o Node oficial está instalado no projeto (devDependency `node`) e os comandos `npm run` usam ele sozinhos. Rodar `node arquivo.ts` direto no terminal usaria o do sistema e falharia.

```
npm install
npm run gerar -- "Promoção de verão"   cria a peça em saida/
npm run revisar                        lista as que aguardam aprovação
npm run revisar -- <id> aprovar        (ou rejeitar)
npm run app                            constrói a interface e abre o app em http://localhost:3000
npm run painel                         só liga o servidor (interface já construída); RADAR=desligado evita o radar
npm test                               testes (vitest)
npm run tipos                          confere os tipos (o Node não confere ao rodar)
```

## Decisões

Fechadas (23/10/2026):

- Stack: TypeScript + npm. O Node roda os .ts direto; por isso imports com `.ts` e nada de `enum`.
- Forma: núcleo (core/) + comandos (cli/). Painel web depois, chamando o mesmo núcleo.
- Primeiro esqueleto: ponta a ponta com estações provisórias.
- Nome: brand-studio.

Fechadas (28/10/2026):

- Painel web: servidor Node simples + HTML/CSS/JS puro, sem build e sem dependência nova. Primeira versão: gerar, listar com prévia e aprovar/rejeitar.
- Visual: roxo vibrante sobre fundo escuro como padrão, com opção de tema claro (botão no topo, lembrado no navegador). Botões em relevo, arredondados, com luz que segue o mouse e filtro selecionado preenchido.
- Node oficial dentro do projeto (devDependency), por causa do Node do sistema sem TypeScript.
- Direção de qualidade das peças: buscar imagens mais elaboradas, tipografia com personalidade, acabamento nítido e vídeos com linguagem de TikTok/Instagram, evitando aparência genérica de IA ("AI slop"). As diretrizes abaixo orientam a implementação; ferramentas e estilos específicos ainda precisam ser escolhidos.

## Diretrizes de qualidade visual

Estas diretrizes são para as peças produzidas, independentemente do tema visual do painel. São objetivos de produto, não recursos já implementados. Na inspeção de 28/10/2026, o gerador visual ainda produz apenas um SVG provisório com fundo, borda e título; não foi encontrada geração de vídeo implementada. Os vídeos mencionados pelo usuário não foram avaliados nesta sessão.

### Direção de arte e variedade

- Definir uma linguagem visual antes de gerar: referências, paleta, composição, luz, materiais, fontes e regras de movimento. Trocar o modelo de IA sozinho não resolve a falta de direção de arte.
- Oferecer opções de estilos coerentes, sem sortear uma estética a cada cena. Possibilidades a explorar: editorial com fotografia e recortes; 3D com materiais de massinha; produto com iluminação de estúdio; colagem com textura e animação.
- Misturar materiais quando ajudarem a comunicar: fotografia real, gravações de tela, produto, ilustrações e cenas geradas. Cada elemento precisa ter função no conteúdo.
- Evitar texto genérico que serviria para qualquer perfil, imagens decorativas sem relação com a mensagem e excesso de brilhos, partículas ou efeitos sem propósito.

### Vídeos, personagens e efeitos

- Planejar as cenas antes da geração: mensagem, enquadramento, ação, duração e transição. As cenas devem desenvolver a ideia do roteiro.
- Trabalhar ritmo com cortes motivados pela fala, pausas, aproximações pontuais, legendas bem compostas e efeitos sonoros ligados às ações. Evitar movimento constante e repetitivo em todos os elementos.
- Usar efeitos para explicar ou reforçar uma ideia, como desmontar um objeto para mostrar seu funcionamento. Referências de vídeos virais orientam a linguagem, sem promessa de viralização.
- Explorar personagens com aparência 3D e personagens realmente modelados em 3D como caminhos distintos. O primeiro permite experimentar estilos, mas exige conferir consistência entre cenas; o segundo permite reutilizar poses e câmeras com mais controle, mas demanda criação e animação iniciais.
- Para personagens recorrentes, preparar ficha visual e referências aprovadas: rosto, proporções, roupas, cores e materiais. Conferir continuidade em todas as cenas.
- Blender é uma possibilidade para 3D real; Remotion é uma possibilidade para montagem de cenas, textos e animações por código. São candidatos a avaliar, sem escolha de ferramenta ou contratação aprovada. Referências: https://www.blender.org/features/ e https://www.remotion.dev/.

### Carrosséis, imagens e tipografia

- Gerar a imagem sem o texto final e compor títulos e corpo separadamente, com controle de acentos, quebra de linha, contraste e nitidez.
- Variar a função e a composição dos slides: capa, explicação visual, comparação, exemplo e fechamento. Evitar repetir o mesmo cartão apenas trocando o parágrafo.
- Definir uma combinação consistente de fontes para títulos e corpo, com personalidade, leitura no celular e suporte completo ao português. Conferir licença comercial.
- Cuidar de recorte, iluminação, textura, espaço livre e harmonia com a marca. Mais resolução não substitui composição e acabamento.
- Usar imagens de origem com tamanho suficiente e exportar no formato de destino, com texto nítido e margens adequadas à interface da plataforma. Dimensões finais ainda estão em aberto; aumentar artificialmente uma imagem ruim não recupera detalhes.

### Aprovação e sequência sugerida

- Revisar se cada imagem comunica algo específico, se o personagem permanece consistente, se luz e anatomia fazem sentido, se há artefatos e se os textos têm identidade e legibilidade.
- Caminho sugerido, ainda sem execução aprovada: produzir um vídeo curto e um carrossel do mesmo tema, aprovar sua direção visual e usar essas peças como referência antes de automatizar em escala.
- Escolher modelos/APIs, ferramentas, estilos iniciais, orçamento e resoluções na rodada de implementação. Estas diretrizes não autorizam gastos ou contratação de serviços.

Fechadas (29/10/2026), estúdio de conteúdo no app (respostas do usuário: 1a, 2a, 3c, 4a, 5a, 6b, 7, 8a):

- Interface migra para React + Vite, com bibliotecas MIT/ISC (@xyflow/react para o quadro, d3-force para o grafo). Revoga a decisão de 28/10 de "HTML/JS puro, sem build" só para a interface; servidor e núcleo seguem sem build (Node roda .ts).
- Conteúdos são pastas e arquivos .md reais em `conteudo/`, com ligações `[[nome]]` como no Obsidian; anexos ficam dentro da pasta do conteúdo. Excluir manda para `conteudo/.lixeira/`, nunca apaga de vez.
- Selecionar na barra lateral serve para ações em lote (mover, excluir) e para escolher o que alimenta o quadro aberto (fontes com ativo/inativo).
- Quadro de vídeo: as falas formam a linha principal; transição e animação ficam presas à fala em que acontecem. Cartões têm instruções. Quadros são arquivos `.quadro.json` dentro de `conteudo/`.
- Prévia à direita: imagem da cena ou do slide renderizada pelo motor (amostras/), em segundos; "gerar vídeo" e "exportar carrossel" rodam em segundo plano.
- Carrossel tem quadro próprio, com cartões "slide" em ordem. Cada slide tem instruções e a IA pode gerar o conteúdo sozinha; também há modelos para escolher. 1080x1350, um PNG por slide + .zip, até 10 slides.
- IA dentro do app: Claude Code em modo restrito (sem ferramentas, `--safe-mode`, sem sessão salva); testes usam uma IA falsa.
- Memória de branding: o app registra escolhas (aprovações, rejeições, quadros salvos, edições feitas depois da IA), calcula preferências e consolida um perfil da marca com a IA. Tudo anotado em `conteudo/branding/` (identidade, objetivo, escolhas, aprendizados). A IA usa essa memória como contexto ao gerar. O app só reescreve as notas automáticas; as notas de identidade escritas pela pessoa não são sobrescritas.
- Em aberto, para decidir depois: tipos de cartão além de fala, transição, animação e slide; legenda e hashtags do carrossel; editor livre de slide (estilo Canva). No item 7, o usuário citou "templates para selecionar, como na opção B"; a opção B era o editor livre, então foi implementada a seleção de modelos e o editor livre ficou em aberto, a confirmar.

## Decisões em aberto

- Formato do dia 1: post estático/carrossel, vídeo curto ou os dois. Define os campos de `Pedido`.
- Quanto a esteira anda sozinha: sob pedido com aprovação / em agenda com aprovação / publica sozinha.
- Branding: qual marca e de onde vem o kit (site/Instagram, manual, ou criar do zero). Define os campos reais de `KitMarca`.
- Arquitetura: onde as peças moram (hoje pastas em saida/, escolha provisória), quais APIs geram imagem e vídeo, orçamento. A máquina de desenvolvimento não tem placa de vídeo dedicada, então gerar imagem e vídeo com modelos locais não é viável; montar templates é.
- Tamanho das peças (hoje 1080×1080, provisório).

## Riscos

- Peça fora da marca publicada sem ninguém ver. Evitar: toda peça passa pela aprovação (`revisar`) antes de qualquer publicação.
- Custo de API sem controle quando as estações reais chamarem IA. Evitar: limite por execução e custo anotado em cada peça (a decidir).
- Painel acessível de fora do computador. Evitar: escuta só em 127.0.0.1; se um dia for para a internet, exige login antes.
- Chave de API vazando. Evitar: chaves só em `.env`, que já está fora do git.
- Direitos de uso: fontes, fotos e músicas precisam de licença que permita uso comercial.
- Voz sintética: plataformas podem exigir rotular conteúdo com voz de IA (a conferir antes de publicar). Evitar: não clonar a voz de terceiros; checar as regras de cada plataforma.
- Personagem gerado por IA: a proteção de direito autoral pode ser limitada e os termos da ferramenta valem. Evitar: guardar a folha original, os prompts e a data de criação; conferir os termos vigentes.
- Aparência genérica de IA, artefatos e personagens inconsistentes. Evitar: direção de arte definida, referências aprovadas e revisão visual antes de escalar a produção.
- Texto ilegível ou imagem sem detalhe na exportação. Evitar: compor textos separadamente, conferir no celular e validar tamanho das imagens de origem.
- Marca no repositório: nome, personagem ou conteúdo da marca subindo para o GitHub. Evitar: `.gitignore` cobre as pastas da marca, o nome vem de arquivo local e a trava de teste confere os arquivos versionados.

## Onde paramos

29/10/2026: rótulos do modo de aprendizado reescritos para leigos ("Uso de IA hoje (estimado)", "Pesquisas desde que o app abriu", limite de uso por dia) com nota explicando que o valor é estimativa pelo preço da API e, com login pela assinatura, gasta o limite da assinatura em vez de ser cobrado. Conferido: login do `claude` é claude.ai, sem ANTHROPIC_API_KEY. Prints atualizados. Ainda sem commit.

29/10/2026: README do GitHub atualizado com 9 telas do estúdio, capturadas numa cópia de demonstração (marca fictícia "Marca Exemplo" e robozinho de exemplo), nunca no conteúdo real. Para refazer: docs/prints/README.md (montar_demo.py + capturar.mjs, Firefox headless via geckodriver). O motor e o servidor aceitam BRAND_STUDIO_CONTEUDO, BRAND_STUDIO_SAIDA e BRAND_STUDIO_PERSONAGEM; sem personagem próprio, o motor usa amostras/personagem-exemplo/. Corrigido com teste: custo do dia zerado no radar desligado. Novas pendências no README: título do quadro cortado no cabeçalho e abas sem indicação de rolagem em janela estreita.

29/10/2026: marca separada do repositório a pedido do usuário. O nome da marca vem de `conteudo/branding/marca.json` (local); notas iniciais de branding viraram modelos neutros; prompts dizem "a marca" e recebem o nome pela memória. Funções gerais do motor saíram dos scripts das amostras (`amostras/voz.py`, `SOM_TRANSICAO` em `efeitos.py`). Histórico do GitHub reescrito para tirar personagem, roteiros, referências e decisões da marca (backup completo em `backup/`, fora do git). Detalhes da produção e pendências da marca em `CLAUDE.local.md`; correções pendentes do app no README.

29/10/2026: estúdio de conteúdo construído (E1 a E8, ver docs/estudio.md) e documentado (E9). E10 (produção de teste pelo próprio app) feita e aguardando revisão. Defeito aberto: saída longa no console da demonstração de código é cortada na borda. A decidir: remover web/public (painel antigo, não é mais servido).
