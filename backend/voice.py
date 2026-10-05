"""
Speech-to-text via Groq Whisper.

Text-to-speech is handled in the browser (Web Speech API) — Groq no longer offers
a TTS model, and browser speech needs no API, never gets decommissioned, and works
offline. So this module only does STT.

Whisper accepts webm directly, so there's no ffmpeg/pydub dependency.
"""

import os
from groq import Groq

STT_MODEL = os.getenv("GROQ_STT_MODEL", "whisper-large-v3")


def transcribe(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """Transcribe uploaded audio (webm/wav/m4a/…) to text via Groq Whisper."""
    client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
    result = client.audio.transcriptions.create(
        model=STT_MODEL,
        file=(filename, audio_bytes),
    )
    return (getattr(result, "text", "") or str(result)).strip()
