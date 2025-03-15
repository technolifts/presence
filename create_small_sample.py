#!/usr/bin/env python3
"""
Create Small Audio Sample

This script creates a small audio sample suitable for ElevenLabs voice cloning.
It extracts a high-quality segment from a larger audio file and ensures it's under 10MB.
"""

import os
import sys
import argparse
import subprocess
from pydub import AudioSegment

def create_small_sample(file_path, duration=120, output_path=None, bitrate="96k"):
    """
    Create a small audio sample from a larger file.
    
    Args:
        file_path: Path to the input audio file
        duration: Duration in seconds (default: 120)
        output_path: Path to save the output file (default: input_file_small.mp3)
        bitrate: Audio bitrate (default: 96k)
    
    Returns:
        Path to the created sample file
    """
    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        return None
    
    # Default output path
    if not output_path:
        output_path = os.path.splitext(file_path)[0] + "_small.mp3"
    
    print(f"Creating small sample from: {file_path}")
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
        print(f"Created sample: {output_path}")
        print(f"File size: {file_size / 1024:.2f} KB ({file_size / (1024 * 1024):.2f} MB)")
        
        # If still too large, reduce bitrate and try again
        if file_size > 10 * 1024 * 1024:  # 10MB
            print("File is still too large. Reducing bitrate and duration...")
            reduced_output = os.path.splitext(output_path)[0] + "_reduced.mp3"
            reduced_duration = min(duration, 90)  # Reduce to 90 seconds max
            
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
        print(f"Error creating sample: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Create a small audio sample for ElevenLabs voice cloning")
    parser.add_argument("file", help="Path to the input audio file")
    parser.add_argument("--duration", type=int, default=120, help="Duration in seconds (default: 120)")
    parser.add_argument("--output", type=str, help="Path to save the output file")
    parser.add_argument("--bitrate", type=str, default="96k", help="Audio bitrate (default: 96k)")
    
    args = parser.parse_args()
    create_small_sample(args.file, args.duration, args.output, args.bitrate)

if __name__ == "__main__":
    main()
