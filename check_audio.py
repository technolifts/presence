#!/usr/bin/env python3
"""
Audio File Checker

This script checks if an audio file is valid and provides information about it.
It can be used to verify if an audio file is suitable for ElevenLabs voice cloning.
"""

import os
import sys
import argparse
from pydub import AudioSegment
import tempfile
import subprocess

def check_audio_file(file_path):
    """
    Check if an audio file is valid and print information about it.
    
    Args:
        file_path: Path to the audio file
    """
    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        return False
    
    print(f"Checking audio file: {file_path}")
    print(f"File size: {os.path.getsize(file_path) / 1024:.2f} KB")
    
    try:
        # Try to load with pydub
        audio = AudioSegment.from_file(file_path)
        print(f"Audio duration: {len(audio) / 1000:.2f} seconds")
        print(f"Channels: {audio.channels}")
        print(f"Sample rate: {audio.frame_rate} Hz")
        print(f"Sample width: {audio.sample_width} bytes")
        print(f"Frame rate: {audio.frame_rate} fps")
        
        # Check if the audio meets ElevenLabs requirements
        if len(audio) < 30000:  # 30 seconds
            print("Warning: Audio may be too short for good voice cloning (less than 30 seconds)")
        
        if audio.channels > 1:
            print("Converting stereo to mono...")
            audio = audio.set_channels(1)
        
        if audio.frame_rate != 44100:
            print(f"Converting sample rate from {audio.frame_rate} to 44100 Hz...")
            audio = audio.set_frame_rate(44100)
        
        # Export a properly formatted version
        output_path = os.path.splitext(file_path)[0] + "_elevenlabs.mp3"
        audio.export(output_path, format="mp3", bitrate="192k")
        print(f"Created optimized file for ElevenLabs: {output_path}")
        
        return True
    except Exception as e:
        print(f"Error processing audio file: {str(e)}")
        
        # Try using ffmpeg directly
        print("Attempting to fix with ffmpeg...")
        try:
            output_path = os.path.splitext(file_path)[0] + "_fixed.mp3"
            subprocess.run([
                "ffmpeg", "-y", "-i", file_path, 
                "-ar", "44100", "-ac", "1", "-b:a", "192k", 
                output_path
            ], check=True)
            print(f"Created fixed file with ffmpeg: {output_path}")
            return True
        except subprocess.CalledProcessError as e:
            print(f"FFmpeg error: {str(e)}")
            return False

def main():
    parser = argparse.ArgumentParser(description="Check audio file validity for ElevenLabs")
    parser.add_argument("file", help="Path to the audio file to check")
    
    args = parser.parse_args()
    check_audio_file(args.file)

if __name__ == "__main__":
    main()
