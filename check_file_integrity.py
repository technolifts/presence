#!/usr/bin/env python3
"""
Audio File Integrity Checker

This script performs detailed checks on audio files to verify their integrity
and compatibility with services like ElevenLabs.
"""

import os
import sys
import argparse
import subprocess
import tempfile
import mimetypes
from pydub import AudioSegment
import wave
import struct

def check_file_basics(file_path):
    """Check basic file properties"""
    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        return False
    
    file_size = os.path.getsize(file_path)
    print(f"File path: {file_path}")
    print(f"File exists: {os.path.exists(file_path)}")
    print(f"File size: {file_size} bytes ({file_size / 1024:.2f} KB)")
    
    mime_type = mimetypes.guess_type(file_path)[0]
    print(f"Detected MIME type: {mime_type}")
    
    # Try to read file header
    try:
        with open(file_path, 'rb') as f:
            header = f.read(100)
            print(f"File header (hex): {header.hex()[:50]}...")
    except Exception as e:
        print(f"Error reading file header: {e}")
    
    return True

def check_audio_with_pydub(file_path):
    """Check audio file with pydub"""
    print("\nChecking with pydub:")
    try:
        audio = AudioSegment.from_file(file_path)
        print(f"Format: {audio.channels} channel(s), {audio.frame_rate} Hz, {audio.sample_width} bytes/sample")
        print(f"Duration: {len(audio) / 1000:.2f} seconds")
        print(f"Max amplitude: {audio.max}")
        print(f"dBFS: {audio.dBFS}")
        return True
    except Exception as e:
        print(f"Error analyzing with pydub: {e}")
        return False

def check_audio_with_ffprobe(file_path):
    """Check audio file with ffprobe"""
    print("\nChecking with ffprobe:")
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_format", "-show_streams", file_path],
            capture_output=True,
            text=True
        )
        print(result.stdout)
        return True
    except Exception as e:
        print(f"Error running ffprobe: {e}")
        return False

def convert_and_check(file_path):
    """Convert to WAV and check integrity"""
    print("\nConverting to WAV and checking integrity:")
    try:
        # Create a temporary WAV file
        fd, temp_path = tempfile.mkstemp(suffix='.wav')
        os.close(fd)
        
        # Convert to WAV
        subprocess.run(
            ["ffmpeg", "-y", "-i", file_path, "-ar", "44100", "-ac", "1", temp_path],
            capture_output=True
        )
        
        print(f"Converted to WAV: {temp_path}")
        
        # Check the WAV file
        with wave.open(temp_path, 'rb') as wav:
            print(f"WAV format: {wav.getnchannels()} channel(s), {wav.getframerate()} Hz, {wav.getsampwidth()} bytes/sample")
            print(f"Number of frames: {wav.getnframes()}")
            
            # Check for data corruption by reading all frames
            frames = wav.readframes(wav.getnframes())
            print(f"Successfully read {len(frames)} bytes of audio data")
            
            # Check for silence or very low volume
            if wav.getsampwidth() == 2:  # 16-bit audio
                fmt = f"{wav.getnframes()}h"
                data = struct.unpack(fmt, frames)
                max_amplitude = max(abs(x) for x in data)
                print(f"Maximum amplitude in WAV: {max_amplitude} (should be well above 0)")
                
                if max_amplitude < 100:
                    print("WARNING: Audio may be silent or very quiet")
        
        # Create a fixed MP3 from the WAV with size limit for ElevenLabs (under 11MB)
        fixed_mp3 = os.path.splitext(file_path)[0] + "_fixed_from_wav.mp3"
        subprocess.run(
            ["ffmpeg", "-y", "-i", temp_path, "-ar", "44100", "-ac", "1", "-b:a", "128k", fixed_mp3],
            capture_output=True
        )
        
        # Check if file is still too large (>10MB to be safe)
        if os.path.getsize(fixed_mp3) > 10 * 1024 * 1024:
            print("File is still too large for ElevenLabs (>10MB). Creating a shorter version...")
            # Create a shorter version (first 5 minutes or less)
            short_mp3 = os.path.splitext(file_path)[0] + "_short.mp3"
            # Use a fixed duration of 5 minutes (300 seconds) for the shorter version
            duration_seconds = 300  # 5 minutes max
            subprocess.run(
                ["ffmpeg", "-y", "-i", fixed_mp3, "-t", str(duration_seconds), 
                 "-ar", "44100", "-ac", "1", "-b:a", "96k", short_mp3],
                capture_output=True
            )
            print(f"Created shorter MP3 (under 10MB): {short_mp3}")
            return short_mp3
        
        print(f"Created fixed MP3: {fixed_mp3}")
        
        # Clean up
        os.unlink(temp_path)
        
        return fixed_mp3
    except Exception as e:
        print(f"Error in conversion process: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Check audio file integrity")
    parser.add_argument("file", help="Path to the audio file to check")
    parser.add_argument("--fix", action="store_true", help="Create a fixed version of the file")
    
    args = parser.parse_args()
    
    if check_file_basics(args.file):
        check_audio_with_pydub(args.file)
        check_audio_with_ffprobe(args.file)
        
        if args.fix:
            fixed_file = convert_and_check(args.file)
            if fixed_file:
                print(f"\nTry using this fixed file with ElevenLabs: {fixed_file}")

if __name__ == "__main__":
    main()
