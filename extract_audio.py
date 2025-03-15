#!/usr/bin/env python3
"""
Script to extract audio from MP4 files and save as MP3.
"""

import os
import sys
import argparse
import subprocess
import shutil

def extract_audio(input_file, output_file=None):
    """
    Extract audio from a video file and save as MP3 using ffmpeg.
    
    Args:
        input_file (str): Path to the input video file
        output_file (str, optional): Path to save the output audio file.
            If not provided, will use the same name as input with .mp3 extension.
    
    Returns:
        str: Path to the saved audio file
    """
    if not os.path.exists(input_file):
        raise FileNotFoundError(f"Input file not found: {input_file}")
    
    # If output file not specified, use input filename with .mp3 extension
    if output_file is None:
        output_file = os.path.splitext(input_file)[0] + ".mp3"
    
    # Check if ffmpeg is installed
    if not shutil.which("ffmpeg"):
        print("Error: ffmpeg is not installed or not in PATH.")
        print("Please install ffmpeg:")
        print("  - macOS: brew install ffmpeg")
        print("  - Linux: apt-get install ffmpeg")
        print("  - Windows: download from https://ffmpeg.org/download.html")
        sys.exit(1)
    
    try:
        # Use ffmpeg to extract audio
        cmd = [
            "ffmpeg",
            "-i", input_file,  # Input file
            "-q:a", "0",       # Highest quality
            "-map", "a",       # Extract audio only
            "-y",              # Overwrite output file if it exists
            output_file        # Output file
        ]
        
        # Run the command
        process = subprocess.run(
            cmd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Check if the command was successful
        if process.returncode != 0:
            print(f"Error running ffmpeg: {process.stderr}")
            sys.exit(1)
            
        return output_file
    except Exception as e:
        print(f"Error extracting audio: {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Extract audio from video files")
    parser.add_argument("input_file", help="Path to the input video file")
    parser.add_argument("-o", "--output", help="Path to save the output audio file (optional)")
    
    args = parser.parse_args()
    
    output_path = extract_audio(args.input_file, args.output)
    print(f"Audio extracted successfully to: {output_path}")

if __name__ == "__main__":
    main()
