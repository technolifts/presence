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
    
    def clone_voice(self, audio_file: Union[str, BinaryIO], voice_name: str, 
                   description: Optional[str] = None, 
                   remove_background_noise: bool = False) -> str:
        """
        Clone a voice using ElevenLabs API.
        
        Args:
            audio_file: Path to an audio file or a file-like object
            voice_name: Name to assign to the cloned voice
            description: Optional description for the voice
            remove_background_noise: Whether to remove background noise from samples
            
        Returns:
            Voice ID of the cloned voice
        """
        print(f"Attempting to clone voice from file: {audio_file if isinstance(audio_file, str) else 'file object'}")
        
        try:
            # Directly use the file path with the ElevenLabs API
            if isinstance(audio_file, str):
                print(f"Using file path: {audio_file}")
                # Verify the file exists and is readable
                if not os.path.exists(audio_file):
                    raise ValueError(f"Audio file not found: {audio_file}")
                
                # Set description if not provided
                if not description:
                    description = f"Cloned voice: {voice_name}"
                
                # Make the API request directly with the file path
                try:
                    voice_response = self.elevenlabs_client.voices.add(
                        name=voice_name,
                        description=description,
                        files=[audio_file],
                        remove_background_noise=remove_background_noise
                    )
                    
                    voice_id = voice_response.voice_id
                    self.cloned_voices[voice_name] = voice_id
                    return voice_id
                except Exception as e:
                    print(f"ElevenLabs API error: {str(e)}")
                    # Try with a more explicit approach if the direct method fails
                    raise
            else:
                # Handle file-like object
                pos = audio_file.tell()
                audio_file.seek(0)
                voice_data = audio_file.read()
                audio_file.seek(pos)  # Restore position
                
                # Create a temporary file
                temp_file = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
                temp_file.write(voice_data)
                temp_file.close()
                
                print(f"Created temporary file: {temp_file.name}")
                
                # Set description if not provided
                if not description:
                    description = f"Cloned voice: {voice_name}"
                
                try:
                    voice_response = self.elevenlabs_client.voices.add(
                        name=voice_name,
                        description=description,
                        files=[temp_file.name],
                        remove_background_noise=remove_background_noise
                    )
                    
                    voice_id = voice_response.voice_id
                    self.cloned_voices[voice_name] = voice_id
                    
                    # Clean up the temporary file
                    try:
                        os.unlink(temp_file.name)
                    except (OSError, FileNotFoundError):
                        pass
                    
                    return voice_id
                except Exception as e:
                    print(f"ElevenLabs API error: {str(e)}")
                    # Clean up the temporary file
                    try:
                        os.unlink(temp_file.name)
                    except (OSError, FileNotFoundError):
                        pass
                    raise
        except Exception as e:
            print(f"Error cloning voice: {str(e)}")
            raise
    
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
                          voice_name: Optional[str] = None,
                          description: Optional[str] = None,
                          remove_background_noise: bool = False) -> str:
        """
        Process a voice file to extract text and optionally clone the voice.
        
        Args:
            audio_file: Path to the audio file
            clone_voice: Whether to clone the voice
            voice_name: Name to assign to the cloned voice (required if clone_voice is True)
            description: Optional description for the cloned voice
            remove_background_noise: Whether to remove background noise from samples
            
        Returns:
            Transcribed text from the audio
        """
        # Convert speech to text
        text = self.speech_to_text(audio_file)
        
        # Clone the voice if requested
        if clone_voice:
            if not voice_name:
                raise ValueError("voice_name must be provided when clone_voice is True")
            
            self.clone_voice(
                audio_file, 
                voice_name, 
                description=description,
                remove_background_noise=remove_background_noise
            )
            print(f"Voice cloned successfully as '{voice_name}'")
        
        return text
