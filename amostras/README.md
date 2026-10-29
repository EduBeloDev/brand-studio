# Motor de renderização

Scripts em Python que o app chama para desenhar prévias, carrosséis e vídeos. Só estes arquivos são versionados; os
recortes do personagem (`personagem/`), os scripts das peças de exemplo da marca, ambientes Python, modelos de voz,
áudios de referência e renders ficam no computador de quem usa (ver o `.gitignore`).

## Mapa

- `estudio_render.py`: ponto de entrada (`cena`, `slides`, `video`, `tecnica`); lê o pedido em JSON pela entrada padrão.
- `arte.py`: cores, fontes, fundo, janela do personagem, texto e assinatura (o nome vem de `conteudo/branding/marca.json`).
- `efeitos.py`: pixel art, texto que surge em pixels, destruição, transições, janelas no estilo antigo e sons sintetizados.
- `demos.py` e `demos_dados.py`: demonstrações (código, terminal, lista, comparação).
- `trilha.py`: trilha chiptune sintetizada na duração exata do vídeo.
- `voz.py`: leitura da narração e envelope de volume.
- `gerar_falas.py`: narração com o Chatterbox usando um áudio de referência de timbre (`ref-piper.wav`, local).
- `alinhar.py`, `asr.py`, `transcrever.py`: tempo de cada palavra e transcrição com faster-whisper.

## Execução e limites

Renderização visual usa Python, Pillow e FFmpeg. Narração e alinhamento usam ambientes próprios (`.venv-cb` com
Chatterbox e PyTorch; `.venv-asr` com faster-whisper); os ambientes não são intercambiáveis e ainda não há instalação
reproduzível única. Confira os caminhos de fontes em `arte.py` antes de rodar em outra máquina.

Os testes `npm test` cobrem a ponte entre o app e o motor (`core/render/`), não a renderização em si; ela é conferida
produzindo peças e olhando os quadros.
