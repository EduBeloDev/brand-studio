"""Instante de cada palavra falada (faster-whisper, MIT), para sincronizar a tela com a narração.
Uso: .venv-asr/bin/python alinhar.py saida/narracao     grava palavras.json na mesma pasta."""
import glob
import re
import json
import os
import sys

from asr import WhisperModel, carregar

pasta = sys.argv[1]
modelo = WhisperModel("small", device="cpu", compute_type="int8")
resultado = {}
arquivos = [f for f in glob.glob(os.path.join(pasta, "cena-*.wav")) if re.fullmatch(r"cena-\d+\.wav", os.path.basename(f))]
for arq in sorted(arquivos, key=lambda f: int(re.findall(r"\d+", os.path.basename(f))[0])):
    segs, _ = modelo.transcribe(carregar(arq), language="pt", word_timestamps=True, beam_size=5)
    palavras = [dict(w=w.word.strip(), i=round(w.start, 3), f=round(w.end, 3)) for s in segs for w in s.words]
    resultado[os.path.basename(arq)[:-4]] = palavras
    print(os.path.basename(arq), " ".join(p["w"] for p in palavras), flush=True)
json.dump(resultado, open(os.path.join(pasta, "palavras.json"), "w"), ensure_ascii=False, indent=1)
