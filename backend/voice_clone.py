#!/usr/bin/env python3
"""
Voice Cloning and Processing Tool

This script provides functionality for:
1. Converting speech to text from audio files
2. Cloning voices using ElevenLabs
3. Generating speech using cloned voices
4. Creating optimized audio samples for voice cloning

Usage:
  python voice_clone.py transcribe --file <audio_file> [--save <output_file>]
  python voice_clone.py clone --file <audio_file> --name <voice_name> [--description <desc>]
  python voice_clone.py speak --text <text> --voice <voice_name> [--save <output_file>]
  python voice_clone.py optimize --file <audio_file> [--duration <seconds>] [--output <output_file>]
"""

import os
import sys
import argparse
import tempfile
import subprocess
import requests
from typing import Optional, Union, BinaryIO, Generator
from dotenv import load_dotenv
import openai
from elevenlabs.client import ElevenLabs
from elevenlabs import play
from pydub import AudioSegment

# Load environment variables from .env file
load_dotenv()

# Get API keys from environment variables
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
            # Check file size if it's a string path
            if isinstance(audio_file, str):
                file_size = os.path.getsize(audio_file)
                if file_size > 10.5 * 1024 * 1024:  # 10.5MB to be safe
                    print("Warning: File is larger than ElevenLabs' 11MB limit")
                    print("Creating optimized version...")
                    audio_file = self.create_optimized_sample(audio_file)
            
            # Directly use the file path with the ElevenLabs API
            if isinstance(audio_file, str):
                print(f"Using file path: {audio_file}")
                # Verify the file exists and is readable
                if not os.path.exists(audio_file):
                    raise ValueError(f"Audio file not found: {audio_file}")
                
                # Set description if not provided
                if not description:
                    description = f"Cloned voice: {voice_name}"
                
                # Try direct API call first (more reliable)
                try:
                    voice_id = self._direct_clone_api_call(
                        audio_file, 
                        voice_name, 
                        description, 
                        remove_background_noise
                    )
                    if voice_id:
                        self.cloned_voices[voice_name] = voice_id
                        return voice_id
                except Exception as e:
                    print(f"Direct API call failed: {str(e)}")
                    print("Trying with client library...")
                
                # Fall back to client library
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
                    # Try direct API call first
                    voice_id = self._direct_clone_api_call(
                        temp_file.name, 
                        voice_name, 
                        description, 
                        remove_background_noise
                    )
                    
                    if voice_id:
                        self.cloned_voices[voice_name] = voice_id
                        
                        # Clean up the temporary file
                        try:
                            os.unlink(temp_file.name)
                        except (OSError, FileNotFoundError):
                            pass
                        
                        return voice_id
                    
                    # Fall back to client library
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
    
    def _direct_clone_api_call(self, file_path, voice_name, description, remove_background_noise):
        """Make a direct API call to ElevenLabs for voice cloning"""
        url = "https://api.elevenlabs.io/v1/voices/add"
        
        headers = {
            "Accept": "application/json",
            "xi-api-key": self.elevenlabs_api_key
        }
        
        data = {
            "name": voice_name,
            "description": description or f"Cloned voice: {voice_name}",
            "remove_background_noise": "true" if remove_background_noise else "false"
        }
        
        with open(file_path, 'rb') as f:
            files = [
                ('files', (os.path.basename(file_path), f, 'audio/mpeg'))
            ]
            
            print("Sending direct API request to ElevenLabs...")
            response = requests.post(url, headers=headers, data=data, files=files)
            
            if response.status_code == 200:
                voice_id = response.json().get("voice_id")
                print(f"Success with direct API call! Voice ID: {voice_id}")
                return voice_id
            else:
                print(f"Direct API call failed: {response.status_code}")
                print(f"Response: {response.text}")
                return None
    
    def text_to_speech(self, text: str, voice_name: str = None, voice_id: str = None, 
                       save_path: Optional[str] = None, stream: bool = False) -> Optional[Union[bytes, Generator]]:
        """
        Convert text to speech using ElevenLabs API.
        
        Args:
            text: The text to convert to speech
            voice_name: The name of the voice to use (either voice_name or voice_id must be provided)
            voice_id: The ID of the voice to use (either voice_name or voice_id must be provided)
            save_path: Optional path to save the audio file
            stream: Whether to stream the audio (returns a generator instead of bytes)
            
        Returns:
            Audio data as bytes, a generator if stream=True, or None if save_path is provided
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
        if stream:
            # Return the generator directly for streaming
            return self.elevenlabs_client.text_to_speech.convert(
                text=text,
                voice_id=voice_id,
                model_id="eleven_monolingual_v1",
                output_format="mp3_44100_128",
                stream=True
            )
        else:
            # Generate audio as before for non-streaming
            audio = self.elevenlabs_client.text_to_speech.convert(
                text=text,
                voice_id=voice_id,
                model_id="eleven_monolingual_v1",
                output_format="mp3_44100_128"
            )
            
            # Ensure we have bytes
            if not isinstance(audio, bytes):
                # If it's a generator or other iterable, convert to bytes
                if hasattr(audio, '__iter__') and not isinstance(audio, (str, bytes, bytearray)):
                    audio = b''.join(chunk if isinstance(chunk, bytes) else bytes(chunk) for chunk in audio)
                else:
                    raise TypeError(f"Unexpected audio type: {type(audio)}")
            
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
    
    def create_optimized_sample(self, file_path, duration=90, output_path=None, bitrate="96k"):
        """
        Create a small audio sample optimized for ElevenLabs voice cloning.
        
        Args:
            file_path: Path to the input audio file
            duration: Duration in seconds (default: 90)
            output_path: Path to save the output file (default: input_file_optimized.mp3)
            bitrate: Audio bitrate (default: 96k)
        
        Returns:
            Path to the created sample file
        """
        if not os.path.exists(file_path):
            raise ValueError(f"Audio file not found: {file_path}")
        
        # Default output path
        if not output_path:
            output_path = os.path.splitext(file_path)[0] + "_optimized.mp3"
        
        print(f"Creating optimized sample from: {file_path}")
        print(f"Target duration: {duration} seconds")
        
        try:
            # Load audio file
            audio = AudioSegment.from_file(file_path)
            
            # Get audio info
            original_duration = len(audio) / 1000
            print(f"Original duration: {original_duration:.2f} seconds")
            
            # If audio is shorter than requested duration, use the whole file
            if original_duration <= duration:
                print("Audio is already shorter than requested duration, using entire file")
                sample_audio = audio
            else:
                # Find a good segment (skip first 10% and last 10% if possible)
                start_pos = min(int(original_duration * 0.1) * 1000, 10000)  # 10% or 10 seconds, whichever is less
                
                # Extract segment
                sample_audio = audio[start_pos:start_pos + (duration * 1000)]
                print(f"Extracted segment from {start_pos/1000:.2f}s to {(start_pos/1000) + duration:.2f}s")
            
            # Convert to mono and set sample rate
            sample_audio = sample_audio.set_channels(1)
            sample_audio = sample_audio.set_frame_rate(44100)
            
            # Export with appropriate settings
            sample_audio.export(
                output_path,
                format="mp3",
                bitrate=bitrate,
                parameters=["-ac", "1", "-ar", "44100"]
            )
            
            # Check file size
            file_size = os.path.getsize(output_path)
            print(f"Created optimized sample: {output_path}")
            print(f"File size: {file_size / 1024:.2f} KB ({file_size / (1024 * 1024):.2f} MB)")
            
            # If still too large, reduce bitrate and try again
            if file_size > 10 * 1024 * 1024:  # 10MB
                print("File is still too large. Reducing bitrate and duration...")
                reduced_output = os.path.splitext(output_path)[0] + "_reduced.mp3"
                reduced_duration = min(duration, 60)  # Reduce to 60 seconds max
                
                subprocess.run([
                    "ffmpeg", "-y", "-i", output_path,
                    "-t", str(reduced_duration),
                    "-ar", "44100", "-ac", "1", "-b:a", "64k",
                    reduced_output
                ], check=True)
                
                reduced_size = os.path.getsize(reduced_output)
                print(f"Created reduced sample: {reduced_output}")
                print(f"Reduced file size: {reduced_size / 1024:.2f} KB ({reduced_size / (1024 * 1024):.2f} MB)")
                
                return reduced_output
            
            return output_path
        
        except Exception as e:
            print(f"Error creating optimized sample: {e}")
            return None


def main():
    """Main function to run the voice processing tool."""
    parser = argparse.ArgumentParser(description="Voice processing and cloning tool")
    
    # Create subparsers for different commands
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Transcribe command
    transcribe_parser = subparsers.add_parser("transcribe", help="Transcribe speech from an audio file")
    transcribe_parser.add_argument("--file", type=str, required=True, help="Path to the audio file")
    transcribe_parser.add_argument("--save", type=str, help="Path to save the transcription")
    
    # Voice cloning command
    clone_parser = subparsers.add_parser("clone", help="Clone a voice from an audio file")
    clone_parser.add_argument("--file", type=str, required=True, help="Path to the audio file")
    clone_parser.add_argument("--name", type=str, required=True, help="Name for the cloned voice")
    clone_parser.add_argument("--description", type=str, help="Description for the cloned voice")
    clone_parser.add_argument("--remove-noise", action="store_true", help="Remove background noise from samples")
    
    # Text to speech command
    speak_parser = subparsers.add_parser("speak", help="Convert text to speech with a voice")
    speak_parser.add_argument("--text", type=str, help="Text to convert to speech")
    speak_parser.add_argument("--file", type=str, help="File containing text to convert to speech")
    speak_parser.add_argument("--voice", type=str, required=True, help="Voice name to use")
    speak_parser.add_argument("--save", type=str, help="Path to save the audio file")
    
    # Optimize audio command
    optimize_parser = subparsers.add_parser("optimize", help="Create an optimized audio sample for voice cloning")
    optimize_parser.add_argument("--file", type=str, required=True, help="Path to the audio file")
    optimize_parser.add_argument("--duration", type=int, default=90, help="Duration in seconds (default: 90)")
    optimize_parser.add_argument("--output", type=str, help="Path to save the output file")
    
    args = parser.parse_args()
    
    # Initialize the voice processor
    try:
        voice_processor = VoiceProcessor()
    except ValueError as e:
        print(f"Error initializing voice processor: {e}")
        return
    
    # Handle different commands
    if args.command == "transcribe":
        try:
            text = voice_processor.speech_to_text(args.file)
            print(f"\nTranscription:\n{text}\n")
            
            if args.save:
                with open(args.save, "w") as f:
                    f.write(text)
                print(f"Transcription saved to {args.save}")
                
        except Exception as e:
            print(f"Error: {e}")
    
    elif args.command == "clone":
        try:
            voice_id = voice_processor.clone_voice(
                args.file, 
                args.name,
                description=args.description,
                remove_background_noise=args.remove_noise
            )
            print(f"Voice cloned successfully with ID: {voice_id}")
                
        except Exception as e:
            print(f"Error: {e}")
    
    elif args.command == "speak":
        try:
            text = None
            if args.text:
                text = args.text
            elif args.file:
                with open(args.file, "r") as f:
                    text = f.read()
            else:
                print("Either --text or --file must be provided")
                return
            
            audio = voice_processor.text_to_speech(text, voice_name=args.voice, save_path=args.save)
            if audio and not args.save:
                voice_processor.play_audio(audio)
                
        except Exception as e:
            print(f"Error: {e}")
    
    elif args.command == "optimize":
        try:
            optimized_file = voice_processor.create_optimized_sample(
                args.file,
                duration=args.duration,
                output_path=args.output
            )
            if optimized_file:
                print(f"Audio optimized successfully: {optimized_file}")
                print("You can now use this file for voice cloning.")
        except Exception as e:
            print(f"Error: {e}")
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
