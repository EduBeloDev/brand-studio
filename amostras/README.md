# Laboratório de vídeos e carrosséis

Scripts experimentais, separados do núcleo TypeScript e do painel. Esta pasta agora versiona Python, roteiros JSON, documentação e recortes do personagem. Ambientes virtuais, pesos de modelos, ferramentas baixadas, áudios de referência e renders continuam locais e não fazem parte do backup Git.

## Mapa

- `arte.py`: composição, fontes e personagem.
- `carrossel.py` e `video.py`: amostra sobre licenças.
- `mitos.py`, `carrossel_mitos.py`, `demos.py` e `efeitos.py`: produção de mitos e suas demonstrações/efeitos.
- `roteiro.py`, `conteudo.json`, `falas_a.json`, `falas_b.json`: conteúdo e falas.
- `trilha.py`: trilha sintetizada.
- `narracao.py`, `gerar_piper.py`, `gerar_chatterbox.py`, `gerar_falas.py`: experimentos de voz.
- `asr.py`, `alinhar.py`, `refazer_falas.py`, `siglas.py`, `chatterbox_siglas.py`, `chatterbox_teste.py`, `teste_mix.py`: apoio a transcrição, pronúncia e mixagem.
- `personagem/`: recortes e coordenadas; folha original na raiz.

## Execução e limites

Leia o cabeçalho de cada script para seus argumentos. Renderização visual usa Python, Pillow e FFmpeg. Narração e alinhamento têm dependências adicionais como PyTorch, Chatterbox, Piper e faster-whisper; os ambientes locais não são intercambiáveis. Os scripts ainda possuem caminhos de fontes e dependências da máquina de desenvolvimento. Não há instalação reproduzível única validada para um clone novo.

Antes de executar em outra máquina, confira os caminhos em `arte.py`, instale as fontes indicadas e prepare os modelos e referências exigidos pelo script escolhido. Consulte [origem dos recursos](ORIGEM-DOS-RECURSOS.md). Não executar scripts de geração apenas como teste: podem baixar modelos, sobrescrever saídas e consumir tempo considerável.

Exemplo da amostra estática, depois de configurar fontes e Pillow:

```bash
cd amostras
python3 carrossel.py
```

Os testes `npm test` validam o núcleo TypeScript, não estes experimentos. A regra de testes antes de alterar casos de uso continua aplicável. A conferência sintática dos arquivos Python não equivale a validar renderização ou áudio.

## Preservação

O GitHub guarda os fontes e ativos versionados. Para preservar também resultados, referências de áudio e modelos baixados, faça backup separado de `amostras/saida/`, `amostras/ref-*.wav` e dos demais arquivos locais necessários. Não publique gravações de referência de terceiros sem conferir direitos.
