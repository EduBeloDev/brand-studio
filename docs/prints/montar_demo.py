"""Monta uma cópia de demonstração do estúdio, com uma marca fictícia, para as capturas da documentação.

Nada aqui vem da marca de quem usa: os textos são de exemplo e o personagem é o robozinho de amostras/personagem_exemplo.py.
Uso: python3 docs/prints/montar_demo.py <pasta>     (cria <pasta>/conteudo e <pasta>/saida)
"""
import json
import os
import sys
import uuid
from datetime import date, datetime, timezone

HOJE = date.today().isoformat()


def escrever(raiz, rel, texto):
    p = os.path.join(raiz, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(texto)


def cartao(tipo, x, y, **campos):
    return {"id": str(uuid.uuid4()), "tipo": tipo, "x": x, "y": y, "instrucoes": "", "campos": campos, "anexos": [],
            "geradoPorIA": list(campos)}


def ligar(a, b):
    return {"id": str(uuid.uuid4()), "de": a["id"], "para": b["id"]}


def quadro_video():
    falas = [
        cartao("fala", 0, 0, fala="Você abre um app de clima e a previsão aparece. Quem buscou esse dado?",
               tela="Quem buscou a *previsão*?", expressao="surpreso"),
        cartao("fala", 360, 0, fala="Uma API. Pense num garçom: você pede, ele leva o pedido à cozinha e volta com o prato.",
               tela="API é o *garçom* do app", expressao="ideia"),
        cartao("fala", 720, 0, fala="No código, o pedido é uma requisição e o prato é a resposta, quase sempre em JSON.",
               tela="Pedido vai, *resposta* volta", expressao="focado"),
        cartao("fala", 1080, 0, fala="Da próxima vez que um app carregar algo, lembre do garçom trabalhando.",
               tela="Agora você vê o *garçom*", expressao="joinha"),
    ]
    trans = [cartao("transicao", 180, 170, efeito="dissolucao"), cartao("transicao", 540, 170, efeito="zoom"),
             cartao("transicao", 900, 170, efeito="dissolucao")]
    anim = [
        cartao("animacao", 0, 340, efeito="som", detalhe="pop"),
        cartao("animacao", 360, 340, efeito="demonstracao", demo="comparacao",
               esquerda="Restaurante: você pede ao garçom", direita="App: o código pede à API"),
        cartao("animacao", 720, 340, efeito="demonstracao", demo="codigo",
               codigo='const r = await fetch("/clima?cidade=Recife")\nconst dados = await r.json()',
               saida='{ "cidade": "Recife", "temp": 29 }'),
        cartao("animacao", 1080, 340, efeito="som", detalhe="sucesso"),
    ]
    con = []
    for i, t in enumerate(trans):
        con += [ligar(falas[i], t), ligar(t, falas[i + 1])]
    con += [ligar(f, a) for f, a in zip(falas, anim)]
    return {"versao": 1, "tipo": "video", "nome": "O que é uma API (sem complicar)",
            "instrucoes": "Explicar API com a analogia do garçom, tom leve, para quem está começando.", "legenda": False,
            "cartoes": falas + trans + anim, "conexoes": con,
            "fontes": [{"caminho": "conhecimento/sugestoes/api-explicada-com-um-restaurante.md", "ativo": True}]}


def quadro_carrossel():
    slides = [
        dict(modelo="capa", selo="PARA QUEM COMEÇA", titulo="JSON sem *medo*: leia em 1 minuto", personagem="lendo"),
        dict(modelo="explicacao", rotulo="O QUE É", titulo="Um jeito de *organizar* dados",
             texto="JSON guarda informações em pares de nome e valor, num formato que pessoas e programas conseguem ler.",
             demo="", personagem="ideia"),
        dict(modelo="codigo", titulo="Um exemplo de verdade",
             codigo='{\n  "nome": "Ana",\n  "idade": 21,\n  "cursos": ["HTML", "CSS"]\n}',
             explicacao="Texto entre aspas, números sem aspas e listas entre colchetes."),
        dict(modelo="mito-verdade", rotulo="MITO", mito="JSON é uma linguagem de programação.",
             verdade="JSON é só um *formato* de dados. Quem lê e usa esses dados é o seu código.", demo=""),
        dict(modelo="fechamento", titulo="Agora você *lê* JSON. Bora praticar?", selo="MARCA EXEMPLO", personagem="joinha"),
    ]
    cartoes = [cartao("slide", 320 * i, 0, **s) for i, s in enumerate(slides)]
    return {"versao": 1, "tipo": "carrossel", "nome": "JSON sem medo", "instrucoes": "Carrossel curto e direto.",
            "legenda": False, "cartoes": cartoes, "conexoes": [ligar(a, b) for a, b in zip(cartoes, cartoes[1:])],
            "fontes": [{"caminho": "conhecimento/sugestoes/json-sem-medo.md", "ativo": True}]}


def sugestao(titulo, formato, gancho, pontos, status="nova"):
    return (f"---\ntipo: sugestao\nformato: {formato}\nstatus: {status}\ncriada: {HOJE}\norigem: radar\n---\n# {titulo}\n\n"
            f"**Gancho:** {gancho}\n\n## Pontos\n\n" + "".join(f"- {p}\n" for p in pontos) +
            "\n**Evidência:** proposta (conteúdo didático duradouro)\n")


def jargao(termo, significado, exemplo, ligacoes):
    return (f"---\ntipo: jargao\ntermo: {termo}\ndata: {HOJE}\n---\n# {termo}\n\n{significado}\n\n**Exemplo:** {exemplo}\n\n"
            f"**Veja também:** {' · '.join(f'[[{l}]]' for l in ligacoes)}\n")


def montar(pasta):
    c = os.path.join(pasta, "conteudo")
    escrever(c, "branding/marca.json", json.dumps({"nome": "Marca Exemplo"}) + "\n")
    escrever(c, "branding/objetivo.md", "# Objetivo da marca\n\n- Explicar tecnologia para quem está começando, em vídeos curtos e carrosséis.\n- Ser lembrada pelas analogias do dia a dia e pelo robozinho.\n")
    escrever(c, "branding/identidade/visual.md", "# Identidade visual\n\n- Fundo roxo escuro, destaques em amarelo.\n- Janelas no estilo dos sistemas antigos para código.\n- Transições: dissolução e zoom; no máximo três tipos por vídeo.\n")
    escrever(c, "branding/identidade/voz-e-tom.md", "# Voz e tom\n\n- Calma, leve e precisa. Humor sobre a situação, nunca sobre a pessoa.\n- Frases curtas; termos técnicos explicados na hora.\n")
    escrever(c, "branding/identidade/personagem.md", "# Personagem\n\n- Robozinho em pixel art com tela no rosto. Aparece reagindo à fala.\n")
    escrever(c, "pautas/o-que-e-uma-api.md", "# O que é uma API\n\nPauta didática para quem está começando.\n\n"
             "- Analogia: o garçom entre a mesa e a cozinha.\n- Termos: [[API]], [[Endpoint]], [[JSON]], [[HTTP]].\n"
             "- Demonstração: um `fetch` pedindo a previsão do tempo.\n\nVirou o quadro [[o-que-e-uma-api-sem-complicar]].\n")
    escrever(c, "conhecimento/jargoes/api.md", jargao("API", "Ponte que deixa um programa pedir dados ou ações a outro, seguindo regras combinadas.", "o app de clima pede a previsão à API de um serviço meteorológico.", ["Endpoint", "JSON", "HTTP"]))
    escrever(c, "conhecimento/jargoes/endpoint.md", jargao("Endpoint", "Endereço específico de uma API, onde se faz um tipo de pedido.", "/clima?cidade=Recife.", ["API", "HTTP"]))
    escrever(c, "conhecimento/jargoes/json.md", jargao("JSON", "Formato de texto para organizar dados em pares de nome e valor.", '{ "temp": 29 }.', ["API"]))
    escrever(c, "conhecimento/jargoes/http.md", jargao("HTTP", "As regras da conversa entre navegador, apps e servidores na web.", "o código 404 quer dizer que o endereço não existe.", ["API", "Endpoint"]))
    escrever(c, "conhecimento/sugestoes/api-explicada-com-um-restaurante.md", sugestao(
        "API explicada com um restaurante", "video", "Quem levou seu pedido até a cozinha?",
        ["Garçom = API", "Pedido = requisição", "Prato = resposta em JSON"], status="usada"))
    escrever(c, "conhecimento/sugestoes/json-sem-medo.md", sugestao(
        "JSON sem medo", "carrossel", "Aquele monte de chaves e aspas tem lógica.",
        ["Pares de nome e valor", "Listas entre colchetes", "Não é linguagem de programação"], status="usada"))
    escrever(c, "conhecimento/sugestoes/codigos-http-404-e-amigos.md", sugestao(
        "Códigos HTTP: o 404 e seus amigos", "ambos", "O 404 é famoso, mas não está sozinho.",
        ["200: deu certo", "404: não achei", "500: quebrou do lado de lá"]))
    escrever(c, "conhecimento/sugestoes/o-que-e-git-em-60-segundos.md", sugestao(
        "O que é Git em 60 segundos", "video", "Já salvou arquivo-final-agora-vai.docx?",
        ["Git guarda versões", "Commit é uma foto do projeto", "Dá para voltar no tempo"]))
    escrever(c, "conhecimento/sugestoes/variaveis-com-caixas.md", sugestao(
        "Variáveis explicadas com caixas", "carrossel", "Uma variável é uma caixa com etiqueta.",
        ["Etiqueta = nome", "Conteúdo = valor", "Dá para trocar o conteúdo"]))
    escrever(c, "quadros/o-que-e-uma-api-sem-complicar.quadro.json", json.dumps(quadro_video(), ensure_ascii=False, indent=2) + "\n")
    escrever(c, "quadros/carrossel-json-sem-medo.quadro.json", json.dumps(quadro_carrossel(), ensure_ascii=False, indent=2) + "\n")
    agora = datetime.now(timezone.utc).isoformat()
    escrever(c, ".estudio/radar.json", json.dumps({
        "config": {"ativoAoAbrir": False, "intervaloMin": 20, "maxCiclosPorSessao": 6, "tetoDiarioUsd": 1, "modelo": "sonnet"},
        "conhecidos": ["api", "json", "http", "endpoint"], "custos": {HOJE: 0.14},
        "ciclos": [{"quando": agora, "custo": 0.14, "criadas": 9}]}, ensure_ascii=False) + "\n")
    eventos = [("quadro-produzido", {"nome": "JSON sem medo", "tipo": "carrossel", "transicoes": [], "animacoes": [], "expressoes": [],
                                     "modelos": ["capa", "explicacao", "codigo", "mito-verdade", "fechamento"]}),
               ("quadro-salvo", {"nome": "O que é uma API (sem complicar)", "transicoes": ["dissolucao", "zoom", "dissolucao"],
                                 "animacoes": ["som", "demonstracao", "demonstracao", "som"], "expressoes": ["surpreso", "ideia", "focado", "joinha"], "modelos": []}),
               ("edicao-apos-ia", {"campo": "tela", "antes": "API é tipo um garçom", "depois": "API é o *garçom* do app", "quadro": "O que é uma API (sem complicar)"}),
               ("sugestao-usada", {"titulo": "JSON sem medo", "tipo": "carrossel"}),
               ("sugestao-usada", {"titulo": "API explicada com um restaurante", "tipo": "video"})]
    escrever(c, ".estudio/eventos.jsonl", "".join(json.dumps({"tipo": t, "dados": d, "quando": agora}, ensure_ascii=False) + "\n" for t, d in eventos))
    os.makedirs(os.path.join(pasta, "saida"), exist_ok=True)
    return pasta


if __name__ == "__main__":
    print(montar(sys.argv[1]))
