#!/usr/bin/env python3
"""
Direct ElevenLabs API Test

This script tests voice cloning by making direct HTTP requests to the ElevenLabs API.
"""

import os
import sys
import requests
import argparse
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_direct_api(file_path, voice_name="Test Voice", description="Test voice description"):
    """Test voice cloning with direct API calls"""
    
    # Get API key
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        print("Error: ELEVENLABS_API_KEY not found in environment variables")
        return
    
    # Check if file exists
    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        return
    
    # Print file info
    file_size = os.path.getsize(file_path)
    print(f"File path: {file_path}")
    print(f"File size: {file_size / 1024:.2f} KB ({file_size / (1024 * 1024):.2f} MB)")
    
    # Check if file is too large
    if file_size > 10.5 * 1024 * 1024:  # 10.5MB to be safe
        print("Warning: File is larger than ElevenLabs' 11MB limit")
        print("Please use a smaller file or run check_file_integrity.py with --fix to create a smaller version")
    
    # API endpoint
    url = "https://api.elevenlabs.io/v1/voices/add"
    
    # Headers
    headers = {
        "Accept": "application/json",
        "xi-api-key": api_key
    }
    
    # Form data
    data = {
        "name": voice_name,
        "description": description
    }
    
    # Files
    try:
        with open(file_path, 'rb') as f:
            files = [
                ('files', (os.path.basename(file_path), f, 'audio/mpeg'))
            ]
            
            print("Sending request to ElevenLabs API...")
            response = requests.post(url, headers=headers, data=data, files=files)
            
            print(f"Response status code: {response.status_code}")
            print(f"Response headers: {response.headers}")
            print(f"Response body: {response.text}")
            
            if response.status_code == 200:
                voice_id = response.json().get("voice_id")
                print(f"Success! Voice ID: {voice_id}")
                return voice_id
            else:
                print(f"API request failed with status code: {response.status_code}")
                return None
    except Exception as e:
        print(f"Error: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Test ElevenLabs voice cloning with direct API calls")
    parser.add_argument("--file", type=str, required=True, help="Path to the audio file")
    parser.add_argument("--name", type=str, default="Test Voice", help="Name for the cloned voice")
    parser.add_argument("--description", type=str, default="Test voice description", 
                        help="Description for the cloned voice")
    
    args = parser.parse_args()
    test_direct_api(args.file, args.name, args.description)

if __name__ == "__main__":
    main()
