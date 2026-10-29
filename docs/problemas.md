# Registro de problemas e soluções

Pedido do usuário (29/10/2026): guardar e documentar todo e qualquer problema encontrado no trajeto, para reaproveitar
neste e em outros projetos. Cada entrada: sintoma, causa, solução e como evitar. As mais novas ficam no fim de cada seção.

## Ambiente e ferramentas

**Clone do GitHub pede usuário e senha e falha.** Causa: o GitHub não aceita senha de conta no git por HTTPS desde 2021.
Solução: `gh auth login` (HTTPS, login pelo navegador) e `gh auth setup-git`. Evitar: autenticar o `gh` antes de clonar
repositórios privados.

**`node arquivo.ts` falha com `ERR_UNKNOWN_FILE_EXTENSION` ou `ERR_NO_TYPESCRIPT`.** Causa: o Node do Ubuntu foi compilado
sem suporte a TypeScript (`process.features.typescript` é false), mesmo sendo 22.22. Solução: instalar o Node oficial como
dependência do projeto (`npm i -D node@22`); os scripts do `npm run` passam a usá-lo. Evitar: chamar sempre via `npm run`.

**Processo iniciado com `( comando & )` some ao fim do comando da ferramenta.** Solução: `nohup comando > log 2>&1 &`.

**`python3 -I script.py` não acha os módulos da própria pasta.** Causa: o modo isolado tira a pasta do script do
`sys.path`. Solução: usar `-I` só para ler arquivos não confiáveis, não para rodar o próprio código.

**Sem `python3-venv` nem `pip` no sistema (instalar exige sudo).** Solução: baixar o `uv` (binário oficial), conferir o
checksum publicado e criar ambientes dentro do projeto (`uv venv --python 3.12`). A execução de binário baixado precisou
de autorização explícita do usuário. Evitar: perguntar antes e documentar a origem.

**Python do sistema (3.14) mais novo que o suportado por pacotes de IA.** Solução: o `uv` baixa um Python 3.12 ou 3.11
só para o ambiente do projeto.

**PyTorch do PyPI baixa gigabytes de CUDA numa máquina sem placa de vídeo.** Solução: instalar antes da index de CPU
(`--index-url https://download.pytorch.org/whl/cpu`) e só depois o pacote que depende dele.

**`pkill -f padrão` encerra o próprio shell (código 144).** Causa: o padrão aparece na linha de comando do próprio shell.
Solução: usar o truque `pkill -f "[m]eu_script"` e não repetir o nome do script em outra parte do mesmo comando.

**Chamadas de ferramenta em paralelo rodaram em pasta inesperada.** Solução: usar caminho absoluto (`cd /caminho && ...`)
em cada comando, principalmente com `git`.

**Captura de tela bloqueada (porta local com EPERM, Firefox via Snap).** Registrado em sessão anterior: liberar a porta
e o navegador nas permissões da sessão antes de capturar.

## Voz, pronúncia e áudio

**Vozes do Kokoro em pt-BR soam robóticas; as masculinas são as mais fracas.** Alternativas testadas: Piper (`faber`,
dataset CC0) e Chatterbox multilíngue (MIT). Caminho que funcionou: Chatterbox narrando com um trecho da Piper como
referência de timbre (timbre de uma, pronúncia da outra).

**Sintetizadores leem letra acentuada solta pelo nome ("í" vira "i agudo") e o hífen entre letras piora a sigla.** Como
descobrir: transcrever o áudio com Whisper e procurar palavras estranhas. Regras que funcionaram na Piper: letras separadas
por espaço sem acento solto ("ême i tê"), formas coladas para GPL/BSD/AGPL ("gêpê éle"), "Next cloud" em duas palavras.
A Chatterbox, ao contrário, lê bem os acentos ("ême í tê"). Testar cada motor separadamente.

**Whisper não mede naturalidade.** Ele confirma que a palavra é inteligível, não que soa bem. A decisão final é de ouvido.

**Chatterbox: `TypeError: 'NoneType' object is not callable` ao criar o modelo.** Causa: a marca d'água (`perth`) importa
`pkg_resources`, removido do `setuptools` 81. Solução: `setuptools<81` no ambiente.

**Chatterbox com `exaggeration` alto e `cfg_weight` baixo inventa sílabas no fim da fala.** Solução: 0,4/0,4 e conferir
cada cena com o Whisper; refazer só as cenas ruins (várias tomadas e escolher a que o Whisper entende certo).

**Chatterbox baixa um arquivo para `~/.pkuseg`, fora do projeto.** Registrar e avisar o usuário.

**faster-whisper com PyAV novo: `open() got an unexpected keyword argument 'metadata_errors'`.** Solução: decodificar o
áudio com o ffmpeg (16 kHz mono, float32) e passar o array ao Whisper.

**`torchaudio.save` grava WAV em ponto flutuante e o módulo `wave` do Python não lê.** Solução: converter para PCM 16 bits
com o ffmpeg antes de manipular.

**Explosão disputando com a voz.** Solução: abrir silêncio no áudio em volta da palavra de gatilho, usando os tempos de
palavra do Whisper.

**Música "muta e volta" nas trocas de cena.** Causa: `sidechaincompress` agressivo (ratio 10, release 450 ms) somado ao
silêncio entre cenas; a queda medida chegava a 19 dB. Solução: ratio 2,5, release 160 ms, pausa de 0,7 s; medir a queda com
RMS em janelas de 0,2 s em volta de cada corte (meta: até ~6 dB).

**O limitador do ffmpeg não respeita o teto.** Causa: `alimiter` tem `level` ligado por padrão e devolve o volume a 0 dB.
Solução: `alimiter=limit=0.85:level=0`. Também: o AAC passa um pouco do teto, então deixar margem.

**Trilha reinicia no meio do vídeo.** Causa: `-stream_loop -1` numa música mais curta que o vídeo, voltando à introdução.
Solução: compor a trilha na duração exata (introdução uma vez, seções alternadas, andamento ajustado para a batida final
cair no fim).

## Imagem e vídeo

**`ValueError: x1 must be greater than or equal to x0` no Pillow.** Causa: retângulo parcialmente fora da área (listras
animadas). Solução: limitar as coordenadas e pular quando a largura fica negativa.

**Emenda retangular visível no fundo.** Causa: `Image.radial_gradient` chega a 255 nos cantos, não na borda (~181 no meio
da borda). Solução: fazer a máscara chegar a zero a 128 px do centro.

**Fragmentos de explosão cobrindo o rosto do personagem.** Causa: ordem das camadas. Solução: desenhar destroços antes do
personagem e efeitos de destaque (bombinha, explosão) por último.

**"Travada" no início do vídeo.** Causa: transição que trocava a imagem de uma vez no primeiro quadro (janela). Como medir:
diferença média entre quadros seguidos (saltou para 20 contra ~1 nas transições contínuas). Solução: transições contínuas.

**`freezedetect` acusa imagem parada durante digitação.** As mudanças são pequenas. Conferir extraindo quadros.

**Recortes de folha de sprites gerada por IA.** A grade não é uniforme e vizinhos invadem as bordas. Solução: régua com
coordenadas sobre a folha, recorte por expressão, descartar as que encostam no vizinho ou limpar só o fundo; nunca mexer no
personagem.

**Teste de glifo com `font.getmask(ch).getbbox()` dá falso positivo.** Uma fonte sem o glifo desenha um quadrado (tofu).
Solução: desenhar à mão setas, ✓ e cursores, ou usar fonte com cobertura conhecida (DejaVu para matemática).

**Logotipo de terceiros dentro de um asset (Apple no notebook do personagem).** Risco de marca. Solução: cobrir só os
pixels do logotipo, com autorização, guardando o original.

**Logo da marca duplicado no fechamento do vídeo.** Causa: o fundo usado na transição final já tinha o logo. Solução: fundo
limpo para a transição.

**Saída longa cortada no console da demonstração de código (29/10/2026, aberto).** Numa produção de teste, a
linha `TypeError: Cannot read properties of undefined (reading 'nome')` passou da borda e ficou "(readi". Como achar: extrair
quadros das demonstrações e olhar a borda direita. Solução prevista: quebrar a saída por largura medida da fonte, como já
é feito nos textos de tela.

**Cursor "sobrando" no meio do texto num quadro solto.** Não é defeito: é o texto entrando letra a letra em pixels.
Conferir com uma sequência de quadros (fps=5) antes de abrir correção.

**Vídeo mais longo que o planejado.** A voz calma e as pausas aumentam a duração. Medir cada fala antes de fixar tempos.

## Pesquisa e direitos

**Página de termos da OpenAI devolve HTTP 403 para leitura automática.** Registrar como "a conferir" e pedir ao usuário.

**GitHub mostra licença `NOASSERTION`.** O detector não classificou; ler o arquivo de licença
(`gh api repos/<dono>/<repo>/contents/LICENSE`).

**Pesquisa na web pela IA sem permissões interativas.** `claude -p --tools WebSearch WebFetch --allowedTools WebSearch
WebFetch --permission-prompts none --safe-mode --no-session-persistence` funcionou (8 s, US$ 0,012 com Sonnet).

**Arquivos da marca já enviados ao GitHub (29/10/2026).** Personagem, roteiros e decisões da marca tinham subido.
Solução: tudo da marca virou local (`.gitignore`), o nome passou a vir de arquivo local, o histórico foi reescrito com
`git filter-branch --tree-filter` (com backup em `git bundle` antes) e enviado com `--force-with-lease`. Limite: o GitHub
continua abrindo os commits antigos pelo código (SHA) até a limpeza interna dele; para apagar de vez, pedir ao suporte do
GitHub. Evitar: decidir o que é público antes do primeiro push, e manter a trava de teste que procura o nome da marca.

**Custo do dia zerado no radar desligado (29/10/2026).** Com `RADAR=desligado`, a tela mostrava US$ 0,00 embora
`.estudio/radar.json` tivesse custo no dia. Causa: o radar só lia o estado salvo ao ligar. Solução: `radar.pronto()` carrega
o estado antes de a API responder; teste em `web/api.test.ts`. Evitar: estado lido de arquivo precisa ser carregado antes
da primeira leitura, não só antes da primeira escrita.

## Testes

**Teste de ciclo agendado conferia o estado cedo demais.** O callback agendado disparava um ciclo assíncrono (grava
arquivos) e o teste esperava só um tique do relógio. Solução: o callback devolve a promessa do ciclo e o agendador falso
do teste aguarda essa promessa. Evitar: em código com agendamento, sempre deixar o trabalho agendado "aguardável".

**Limite de tamanho do pedido perdido ao reescrever o servidor (29/10/2026).** As rotas da aba Peças passaram de
`server.ts` antigo para o novo sem o teto de 10 KB do corpo e com erros virando HTTP 500. Ninguém percebeu porque o
`server.ts` liga o servidor ao ser importado, então não tinha teste. Solução: rotas movidas para `web/pecas.ts`, com testes
(`web/pecas.test.ts`) de tamanho, JSON quebrado, status inválido e caminho com `../`. Evitar: arquivo que só monta as
peças e liga o servidor não deve ter regra; regra vai para módulo importável e testado.

## IA dentro do app

**IA escreveu a forma de pronunciar no texto visível (29/10/2026).** No primeiro ciclo do radar, o gancho de uma sugestão
veio com "bâg" em vez de "bug": a IA viu a tabela de pronúncia no contexto da marca e copiou a grafia falada. Solução:
regra explícita nos prompts (geração e radar) de escrever sempre com a grafia normal; a pronúncia é aplicada pelo app só
na voz. Testes cobrem a regra. A nota afetada foi corrigida à mão.

**Jargão com sigla entre parênteses na tabela de pronúncia (29/10/2026).** "pull request (PR)" entrou como um termo só e
nunca casaria com o texto da fala. Solução: `paresDePronuncia` separa termo e sigla em duas entradas ("pull request" e
"PR"), e o prompt pede um termo por jargão. Evitar: tudo que vira chave de troca automática precisa ser normalizado antes.
