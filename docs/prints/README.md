# Capturas do estúdio

As capturas do README são feitas numa **cópia de demonstração**, nunca no conteúdo real: a marca de quem usa fica só no
computador dela, e as imagens vão para o GitHub. A demonstração usa uma marca fictícia ("Marca Exemplo"), textos de
exemplo sobre API e JSON e o robozinho de `amostras/personagem-exemplo/`.

| Arquivo | Tela |
| --- | --- |
| `estudio-inicio.png` | Início: modo de aprendizado e sugestões |
| `estudio-nota.png` | Conteúdos: nota com ligações |
| `estudio-quadro-video.png` | Quadro de vídeo com um cartão aberto e a prévia da cena |
| `estudio-quadro-carrossel.png` | Quadro de carrossel com a prévia de um slide |
| `estudio-grafo.png` | Grafo das notas |
| `estudio-marca.png` | Memória da marca |
| `estudio-producoes.png` | Produções, com o carrossel da demonstração renderizado |
| `estudio-tema-claro.png` | Início no tema claro |
| `estudio-estreito.png` | Início numa janela de 500 px (não equivale a um teste em celular) |

## Como refazer

Precisa de Python 3 com Pillow, ffmpeg, Firefox e geckodriver.

```bash
# 1. monta a demonstração numa pasta fora do projeto
python3 docs/prints/montar_demo.py /tmp/demo-estudio

# 2. constrói a interface e sobe o app apontado para a demonstração (porta 3001, radar desligado)
npm run build
BRAND_STUDIO_CONTEUDO=/tmp/demo-estudio/conteudo BRAND_STUDIO_SAIDA=/tmp/demo-estudio/saida \
BRAND_STUDIO_PERSONAGEM=$PWD/amostras/personagem-exemplo RADAR=desligado PORT=3001 npm run painel

# 3. noutro terminal: produz o carrossel da demonstração (para a aba Produções) e captura as telas
curl -X POST localhost:3001/api/quadro/produzir -H 'Content-Type: application/json' \
  -d '{"caminho":"quadros/carrossel-json-sem-medo.quadro.json"}'
node docs/prints/capturar.mjs http://localhost:3001 docs/prints
```

O `capturar.mjs` abre o Firefox sem janela pelo geckodriver (WebDriver), clica nas abas e salva cada tela em 1440x1100.
Se o geckodriver não estiver no `PATH`, informe o caminho em `GECKODRIVER` (no Ubuntu com Snap: `/snap/bin/geckodriver`).
Antes de publicar, abra cada imagem e confira se nada de uma marca real ou dado pessoal aparece.

## Se der erro

- **`listen EPERM`** ao subir o servidor: o ambiente não deixa abrir porta, mesmo em `127.0.0.1`. Rode num terminal local
  ou ajuste as permissões da sessão. Não confunda com `EADDRINUSE`, que é porta ocupada (troque com `PORT=3002`).
- **Firefox não inicia ou menciona `snap-confine`**: a instalação Snap recusou rodar no ambiente restrito. Tente num
  terminal local; não desative AppArmor nem a proteção do navegador como tentativa genérica.
- **"Não achei ..."** no `capturar.mjs`: o texto de um botão ou item mudou na interface. Ajuste o texto procurado no script.
