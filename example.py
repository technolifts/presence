#!/usr/bin/env python3
"""
Example script demonstrating how to use the VoiceProcessor class.
"""

from voice_processor import VoiceProcessor
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def main():
    """Run a demonstration of the VoiceProcessor capabilities."""
    # Initialize the voice processor
    voice_processor = VoiceProcessor()
    
    # Example 1: Transcribe an audio file
    print("\n=== Example 1: Speech to Text ===")
    audio_file = input("Enter path to an audio file for transcription: ")
    if os.path.exists(audio_file):
        try:
            text = voice_processor.speech_to_text(audio_file)
            print(f"Transcription: {text}")
        except Exception as e:
            print(f"Error transcribing audio: {e}")
    else:
        print(f"File not found: {audio_file}")
    
    # Example 2: Clone a voice
    print("\n=== Example 2: Voice Cloning ===")
    clone_voice = input("Would you like to clone a voice from the audio file? (y/n): ").lower() == 'y'
    if clone_voice:
        voice_name = input("Enter a name for the cloned voice: ")
        try:
            voice_id = voice_processor.clone_voice(audio_file, voice_name)
            print(f"Voice cloned successfully with ID: {voice_id}")
            
            # Example 3: Text to speech with cloned voice
            print("\n=== Example 3: Text to Speech with Cloned Voice ===")
            text_to_speak = input("Enter text to speak with the cloned voice: ")
            audio = voice_processor.text_to_speech(text_to_speak, voice_name=voice_name)
            print("Playing audio with cloned voice...")
            voice_processor.play_audio(audio)
        except Exception as e:
            print(f"Error cloning voice: {e}")
    
    # Example 4: Text to speech with standard voice
    print("\n=== Example 4: Text to Speech with Standard Voice ===")
    text_to_speak = input("Enter text to speak with a standard voice: ")
    try:
        audio = voice_processor.text_to_speech(text_to_speak, voice_name="Adam")
        print("Playing audio with standard voice...")
        voice_processor.play_audio(audio)
    except Exception as e:
        print(f"Error generating speech: {e}")


if __name__ == "__main__":
    main()
