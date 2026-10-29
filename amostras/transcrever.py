"""Transcreve um áudio com faster-whisper (MIT) e imprime JSON {"texto": ...} na última linha.
Uso: .venv-asr/bin/python transcrever.py arquivo.wav   (usado pelo "roubar ideias")."""
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("HF_HOME", os.path.join(AQUI, ".cache-hf"))
from asr import WhisperModel, carregar  # noqa: E402

modelo = WhisperModel("small", device="cpu", compute_type="int8")
segs, _ = modelo.transcribe(carregar(sys.argv[1]), beam_size=5)
print(json.dumps({"texto": " ".join(s.text.strip() for s in segs)}, ensure_ascii=False))
