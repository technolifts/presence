#!/usr/bin/env python3
"""
ElevenLabs Voice Cloning Test Script

This script tests voice cloning functionality using the ElevenLabs API directly.
It helps diagnose issues with audio file compatibility.
"""

import os
import sys
from elevenlabs import play
from elevenlabs.client import ElevenLabs
from dotenv import load_dotenv
import argparse
import requests

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
        
        # Check if file is readable
        try:
            with open(file_path, 'rb') as f:
                # Read a small portion to verify it's accessible
                f.read(1024)
                f.seek(0)
        except Exception as e:
            print(f"Error reading file: {e}")
            return None
        
        # Try using the client's voices.add method
        try:
            voice = client.voices.add(
                name=voice_name,
                description=description,
                files=[file_path],
            )
            print(f"Success! Voice ID: {voice.voice_id}")
            return voice.voice_id
        except Exception as e:
            print(f"Error with client.voices.add: {e}")
            
            # Fall back to direct API call if the client method fails
            print("Trying direct API call...")
            url = "https://api.elevenlabs.io/v1/voices/add"
            
            headers = {
                "Accept": "application/json",
                "xi-api-key": ELEVENLABS_API_KEY
            }
            
            data = {
                "name": voice_name,
                "description": description
            }
            
            with open(file_path, 'rb') as f:
                files = [
                    ('files', (os.path.basename(file_path), f, 'audio/mpeg'))
                ]
                
                response = requests.post(url, headers=headers, data=data, files=files)
                
                if response.status_code == 200:
                    voice_id = response.json().get("voice_id")
                    print(f"Success with direct API call! Voice ID: {voice_id}")
                    return voice_id
                else:
                    print(f"Direct API call failed: {response.status_code}")
                    print(f"Response: {response.text}")
                    return None
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
