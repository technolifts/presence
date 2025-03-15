#!/usr/bin/env python3
"""
Voice Processor Module

This module provides functionality for:
1. Converting speech to text from MP3 files
2. Cloning voices using ElevenLabs
3. Generating speech using cloned voices
"""

import os
import tempfile
from typing import Optional, Union, BinaryIO
import anthropic
from elevenlabs.client import ElevenLabs
from elevenlabs import play
from dotenv import load_dotenv
import openai

# Load environment variables from .env file
load_dotenv()

# Get API keys from environment variables
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


class VoiceProcessor:
    """
    A class for processing voice recordings, cloning voices, and generating speech.
    """
    
    def __init__(self, elevenlabs_api_key: Optional[str] = None, openai_api_key: Optional[str] = None):
        """
        Initialize the VoiceProcessor.
        
        Args:
            elevenlabs_api_key: API key for ElevenLabs (optional, defaults to env variable)
            openai_api_key: API key for OpenAI (optional, defaults to env variable)
        """
        # Initialize ElevenLabs client
        self.elevenlabs_api_key = elevenlabs_api_key or ELEVENLABS_API_KEY
        if not self.elevenlabs_api_key:
            raise ValueError("ElevenLabs API key not found. Please provide it or set ELEVENLABS_API_KEY environment variable.")
        
        self.elevenlabs_client = ElevenLabs(api_key=self.elevenlabs_api_key)
        
        # Initialize OpenAI client for speech-to-text
        self.openai_api_key = openai_api_key or OPENAI_API_KEY
        if not self.openai_api_key:
            raise ValueError("OpenAI API key not found. Please provide it or set OPENAI_API_KEY environment variable.")
        
        self.openai_client = openai.OpenAI(api_key=self.openai_api_key)
        
        # Store cloned voice IDs
        self.cloned_voices = {}
    
    def speech_to_text(self, audio_file: Union[str, BinaryIO]) -> str:
        """
        Convert speech in an audio file to text using OpenAI's Whisper model.
        
        Args:
            audio_file: Path to an audio file or a file-like object
            
        Returns:
            Transcribed text from the audio
        """
        # Handle file path vs file object
        if isinstance(audio_file, str):
            with open(audio_file, "rb") as f:
                transcript = self.openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=f
                )
        else:
            transcript = self.openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
        
        return transcript.text
    
    def clone_voice(self, audio_file: Union[str, BinaryIO], voice_name: str) -> str:
        """
        Clone a voice using ElevenLabs API.
        
        Args:
            audio_file: Path to an audio file or a file-like object
            voice_name: Name to assign to the cloned voice
            
        Returns:
            Voice ID of the cloned voice
        """
        # Handle file path vs file object
        if isinstance(audio_file, str):
            with open(audio_file, "rb") as f:
                voice_data = f.read()
        else:
            # Save position and rewind
            pos = audio_file.tell()
            audio_file.seek(0)
            voice_data = audio_file.read()
            # Restore position
            audio_file.seek(pos)
        
        # Create a temporary file for the voice data
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
            temp_file.write(voice_data)
            temp_file_path = temp_file.name
        
        try:
            # Clone the voice using ElevenLabs
            voice_response = self.elevenlabs_client.voices.add(
                name=voice_name,
                description=f"Cloned voice: {voice_name}",
                files=[temp_file_path]
            )
            
            voice_id = voice_response.voice_id
            self.cloned_voices[voice_name] = voice_id
            return voice_id
        finally:
            # Clean up the temporary file
            os.unlink(temp_file_path)
    
    def text_to_speech(self, text: str, voice_name: str = None, voice_id: str = None, 
                       save_path: Optional[str] = None) -> Optional[bytes]:
        """
        Convert text to speech using ElevenLabs API.
        
        Args:
            text: The text to convert to speech
            voice_name: The name of the voice to use (either voice_name or voice_id must be provided)
            voice_id: The ID of the voice to use (either voice_name or voice_id must be provided)
            save_path: Optional path to save the audio file
            
        Returns:
            Audio data as bytes if save_path is None, otherwise None
        """
        if not voice_id:
            if voice_name:
                # Check if it's a cloned voice we have stored
                if voice_name in self.cloned_voices:
                    voice_id = self.cloned_voices[voice_name]
                else:
                    # Try to find the voice by name in available voices
                    voices = self.elevenlabs_client.voices.get_all()
                    for voice in voices.voices:
                        if voice.name.lower() == voice_name.lower():
                            voice_id = voice.voice_id
                            break
                    
                    if not voice_id:
                        # If voice not found, use the first available voice or a default voice
                        default_voice_id = "21m00Tcm4TlvDq8ikWAM"  # Default voice (Rachel)
                        voice_id = voices.voices[0].voice_id if voices.voices else default_voice_id
                        print(f"Voice '{voice_name}' not found. Using a default voice instead.")
            else:
                raise ValueError("Either voice_name or voice_id must be provided")
        
        # Generate audio
        audio = self.elevenlabs_client.text_to_speech.convert(
            text=text,
            voice_id=voice_id,
            model_id="eleven_monolingual_v1",
            output_format="mp3_44100_128"
        )
        
        if save_path:
            with open(save_path, "wb") as f:
                f.write(audio)
            print(f"Audio saved to {save_path}")
            return None
        else:
            return audio
    
    def play_audio(self, audio_data: bytes) -> None:
        """
        Play audio data.
        
        Args:
            audio_data: Audio data as bytes
        """
        play(audio_data)
    
    def process_voice_file(self, audio_file: str, clone_voice: bool = False, 
                          voice_name: Optional[str] = None) -> str:
        """
        Process a voice file to extract text and optionally clone the voice.
        
        Args:
            audio_file: Path to the audio file
            clone_voice: Whether to clone the voice
            voice_name: Name to assign to the cloned voice (required if clone_voice is True)
            
        Returns:
            Transcribed text from the audio
        """
        # Convert speech to text
        text = self.speech_to_text(audio_file)
        
        # Clone the voice if requested
        if clone_voice:
            if not voice_name:
                raise ValueError("voice_name must be provided when clone_voice is True")
            
            self.clone_voice(audio_file, voice_name)
            print(f"Voice cloned successfully as '{voice_name}'")
        
        return text
