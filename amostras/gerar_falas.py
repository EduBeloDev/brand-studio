"""Narração a partir de uma lista de falas (JSON), com o Chatterbox e a voz da Piper como timbre.
Uso: .venv-cb/bin/python gerar_falas.py falas.json saida/narracao ref-piper.wav [exaggeration] [cfg]"""
import json
import os
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("HF_HOME", os.path.join(AQUI, ".cache-hf"))
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
import torchaudio as ta  # noqa: E402
from chatterbox.mtl_tts import ChatterboxMultilingualTTS  # noqa: E402

falas = json.load(open(sys.argv[1], encoding="utf-8"))
pasta, ref = sys.argv[2], sys.argv[3]
exag = float(sys.argv[4]) if len(sys.argv) > 4 else 0.4
cfg = float(sys.argv[5]) if len(sys.argv) > 5 else 0.4
os.makedirs(pasta, exist_ok=True)
modelo = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
duracoes = []
for n, texto in enumerate(falas, 1):
    t0 = time.time()
    wav = modelo.generate(texto, language_id="pt", exaggeration=exag, cfg_weight=cfg, audio_prompt_path=ref)
    ta.save(os.path.join(pasta, f"cena-{n}.wav"), wav, modelo.sr)
    duracoes.append(round(wav.shape[-1] / modelo.sr, 3))
    print(f"[{os.path.basename(pasta)}] cena {n}: {duracoes[-1]}s em {time.time() - t0:.0f}s", flush=True)
json.dump(dict(duracoes=duracoes), open(os.path.join(pasta, "duracoes.json"), "w"))
print("pronto", pasta, round(sum(duracoes), 1))
