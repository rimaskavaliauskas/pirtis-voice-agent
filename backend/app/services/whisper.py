"""
Whisper Speech-to-Text Service

Handles audio transcription using OpenAI's Whisper model.
"""

import os
import tempfile
import traceback
from pathlib import Path
from typing import Optional, Tuple

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
    language: str = None,
    filename: Optional[str] = None,
) -> Tuple[str, float]:
    """
    Transcribe audio data to text using Whisper.

    Args:
        audio_data: Raw audio bytes (WebM, WAV, etc.)
        language: Language code or None for auto-detection
        filename: Optional original filename for extension detection

    Returns:
        Tuple of (transcript_text, confidence_score)
    """
    print(f"transcribe_audio called: {len(audio_data)} bytes, filename={filename}, language={language or 'auto-detect'}")
    
    # Determine file extension
    extension = ".webm"
    if filename:
        ext = Path(filename).suffix.lower()
        if ext in [".wav", ".mp3", ".m4a", ".webm", ".ogg"]:
            extension = ext
    
    print(f"Using extension: {extension}")

    # Write audio to temporary file
    with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as tmp_file:
        tmp_file.write(audio_data)
        tmp_path = tmp_file.name
    
    print(f"Temp file created: {tmp_path}, size: {os.path.getsize(tmp_path)}")

    try:
        # Get Whisper model
        model = _get_whisper_model()
        print("Got Whisper model, starting transcription...")

        # Transcribe with auto-detection if no language specified
        transcribe_opts = {
            "task": "transcribe",
        }
        if language:
            transcribe_opts["language"] = language
        # If language is None, Whisper will auto-detect
        
        result = model.transcribe(tmp_path, **transcribe_opts)
        
        detected_lang = result.get("language", "unknown")
        print(f"Transcription complete (detected: {detected_lang}): {result.get('text', '')[:100]}...")

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

    except Exception as e:
        print(f"Transcription error: {e}")
        print(traceback.format_exc())
        raise

    finally:
        # Cleanup temp file
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


async def get_audio_duration(audio_data: bytes, filename: Optional[str] = None) -> float:
    """
    Get duration of audio file in seconds.
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
