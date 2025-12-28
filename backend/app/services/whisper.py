"""
Whisper Speech-to-Text Service

Handles audio transcription using OpenAI's Whisper model.
"""

import os
import tempfile
from pathlib import Path
from typing import Optional, Tuple
import asyncio

# Lazy load whisper to avoid startup delay
_whisper_model = None


def _get_whisper_model():
    """Lazy load the Whisper model."""
    global _whisper_model
    if _whisper_model is None:
        import whisper
        from app.config import get_settings
        settings = get_settings()
        model_name = settings.whisper_model
        print(f"Loading Whisper model: {model_name}...")
        _whisper_model = whisper.load_model(model_name)
        print(f"Whisper model loaded successfully")
    return _whisper_model


async def transcribe_audio(
    audio_data: bytes,
    language: str = "lt",
    filename: Optional[str] = None,
) -> Tuple[str, float]:
    """
    Transcribe audio data to text using Whisper.

    Args:
        audio_data: Raw audio bytes (WebM, WAV, etc.)
        language: Language code (default: Lithuanian)
        filename: Optional original filename for extension detection

    Returns:
        Tuple of (transcript_text, confidence_score)
    """
    from app.config import get_settings
    settings = get_settings()

    if len(audio_data) > settings.max_audio_bytes:
        raise ValueError("Audio file too large")

    return await asyncio.to_thread(_transcribe_sync, audio_data, language, filename)


def _transcribe_sync(
    audio_data: bytes,
    language: str,
    filename: Optional[str],
) -> Tuple[str, float]:
    """Synchronous transcription helper to run in a thread."""
    # Determine file extension
    extension = ".webm"
    if filename:
        ext = Path(filename).suffix.lower()
        if ext in [".wav", ".mp3", ".m4a", ".webm", ".ogg"]:
            extension = ext

    # Write audio to temporary file
    with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as tmp_file:
        tmp_file.write(audio_data)
        tmp_path = tmp_file.name

    try:
        # Get Whisper model
        model = _get_whisper_model()

        # Transcribe
        result = model.transcribe(
            tmp_path,
            language=language,
            task="transcribe",
        )

        transcript = result.get("text", "").strip()

        # Calculate average confidence from segments
        segments = result.get("segments", [])
        if segments:
            avg_confidence = sum(
                1 - seg.get("no_speech_prob", 0)
                for seg in segments
            ) / len(segments)
        else:
            avg_confidence = 0.5

        return transcript, avg_confidence

    finally:
        # Cleanup temp file
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


async def get_audio_duration(audio_data: bytes, filename: Optional[str] = None) -> float:
    """
    Get duration of audio file in seconds.

    Args:
        audio_data: Raw audio bytes
        filename: Optional filename for extension

    Returns:
        Duration in seconds
    """
    extension = ".webm"
    if filename:
        ext = Path(filename).suffix.lower()
        if ext in [".wav", ".mp3", ".m4a", ".webm", ".ogg"]:
            extension = ext

    with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as tmp_file:
        tmp_file.write(audio_data)
        tmp_path = tmp_file.name

    try:
        import whisper
        audio = whisper.load_audio(tmp_path)
        return len(audio) / whisper.audio.SAMPLE_RATE
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
