#!/usr/bin/env python3
"""
ElevenLabs Voice Cloning Test Script

This script tests voice cloning functionality using the ElevenLabs API directly.
It helps diagnose issues with audio file compatibility.
"""

import os
import sys
from elevenlabs import clone, play
from elevenlabs.client import ElevenLabs
from dotenv import load_dotenv
import argparse

# Load environment variables from .env file
load_dotenv()

def test_voice_cloning(file_path, voice_name="Test Voice", description="Test voice description"):
    """
    Test voice cloning with ElevenLabs API
    
    Args:
        file_path: Path to the audio file
        voice_name: Name for the cloned voice
        description: Description for the cloned voice
    """
    # Get API key
    ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
    if not ELEVENLABS_API_KEY:
        print("Error: ELEVENLABS_API_KEY not found in environment variables")
        return

    # Verify file exists
    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        return
    
    # Print file info
    print(f"File path: {file_path}")
    print(f"File size: {os.path.getsize(file_path) / 1024:.2f} KB")
    
    # Initialize client
    client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
    
    # Try to clone voice
    try:
        print(f"Attempting to clone voice from {file_path}...")
        voice = client.voices.add(
            name=voice_name,
            description=description,
            files=[file_path],
        )
        print(f"Success! Voice ID: {voice.voice_id}")
        return voice.voice_id
    except Exception as e:
        print(f"Error: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Test ElevenLabs voice cloning")
    parser.add_argument("--file", type=str, required=True, help="Path to the audio file")
    parser.add_argument("--name", type=str, default="Test Voice", help="Name for the cloned voice")
    parser.add_argument("--description", type=str, default="Test voice description", 
                        help="Description for the cloned voice")
    
    args = parser.parse_args()
    test_voice_cloning(args.file, args.name, args.description)

if __name__ == "__main__":
    main()
