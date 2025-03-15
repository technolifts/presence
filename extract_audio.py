#!/usr/bin/env python3
"""
Script to extract audio from MP4 files and save as MP3.
"""

import os
import sys
import argparse
from moviepy.editor import VideoFileClip

def extract_audio(input_file, output_file=None):
    """
    Extract audio from a video file and save as MP3.
    
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
    
    try:
        # Load the video file
        video = VideoFileClip(input_file)
        
        # Extract the audio
        audio = video.audio
        
        # Save the audio as MP3
        audio.write_audiofile(output_file)
        
        # Close the video file
        video.close()
        
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
