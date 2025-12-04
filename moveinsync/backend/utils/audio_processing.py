"""
Audio Processing Utilities for Voice Features
Handles STT (Speech-to-Text) and TTS (Text-to-Speech) using OpenAI APIs
"""
import os
import base64
import io
from typing import Optional
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def transcribe_audio(audio_data: bytes, format: str = "webm") -> str:
    """
    Convert audio bytes to text using OpenAI Whisper.
    
    Args:
        audio_data: Raw audio bytes
        format: Audio format (webm, mp3, wav, etc.)
    
    Returns:
        Transcribed text
    """
    try:
        # Create a file-like object from bytes
        audio_file = io.BytesIO(audio_data)
        audio_file.name = f"audio.{format}"
        
        # Call Whisper API
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="en"  # Can be made dynamic
        )
        
        return transcript.text
    except Exception as e:
        raise Exception(f"Speech-to-text failed: {str(e)}")


def text_to_speech(text: str, voice: str = "alloy") -> bytes:
    """
    Convert text to speech using OpenAI TTS.
    
    Args:
        text: Text to convert to speech
        voice: Voice to use (alloy, echo, fable, onyx, nova, shimmer)
    
    Returns:
        Audio bytes (MP3 format)
    """
    try:
        response = client.audio.speech.create(
            model="tts-1",  # Use tts-1-hd for higher quality
            voice=voice,
            input=text,
            response_format="mp3"
        )
        
        # Return audio bytes
        return response.content
    except Exception as e:
        raise Exception(f"Text-to-speech failed: {str(e)}")


def audio_base64_to_bytes(base64_audio: str) -> bytes:
    """
    Convert base64 encoded audio to bytes.
    
    Args:
        base64_audio: Base64 encoded audio string
    
    Returns:
        Raw audio bytes
    """
    try:
        # Remove data URL prefix if present
        if "," in base64_audio:
            base64_audio = base64_audio.split(",")[1]
        
        return base64.b64decode(base64_audio)
    except Exception as e:
        raise Exception(f"Failed to decode audio: {str(e)}")


def audio_bytes_to_base64(audio_bytes: bytes) -> str:
    """
    Convert audio bytes to base64 string.
    
    Args:
        audio_bytes: Raw audio bytes
    
    Returns:
        Base64 encoded audio string
    """
    return base64.b64encode(audio_bytes).decode('utf-8')
