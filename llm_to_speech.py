#!/usr/bin/env python3
"""
LLM to Speech Converter

This script converts text generated by Anthropic's Claude API to speech using ElevenLabs.
It requires API keys for both services.
"""

import os
import time
import argparse
from typing import Optional
import anthropic
from elevenlabs.client import ElevenLabs
from elevenlabs import play
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get API keys from environment variables
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

# Initialize ElevenLabs client
elevenlabs_client = None
if ELEVENLABS_API_KEY:
    elevenlabs_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)


def get_llm_response(prompt: str, model: str = "claude-3-opus-20240229") -> str:
    """
    Get a response from Anthropic's Claude API.
    
    Args:
        prompt: The user prompt to send to the LLM
        model: The model to use (default: claude-3-opus-20240229)
        
    Returns:
        The text response from the LLM
    """
    if not ANTHROPIC_API_KEY:
        raise ValueError("Anthropic API key not found. Please set ANTHROPIC_API_KEY environment variable.")
    
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    
    message = client.messages.create(
        model=model,
        max_tokens=1024,
        temperature=0.7,
        system="You are a helpful assistant that provides concise and informative responses.",
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    
    return message.content[0].text


def text_to_speech(text: str, voice_name: str = "Adam", save_path: Optional[str] = None) -> None:
    """
    Convert text to speech using ElevenLabs API.
    
    Args:
        text: The text to convert to speech
        voice_name: The voice to use (default: Adam)
        save_path: Optional path to save the audio file
    """
    if not elevenlabs_client:
        raise ValueError("ElevenLabs API key not found. Please set ELEVENLABS_API_KEY environment variable.")
    
    # Get available voices
    voices = elevenlabs_client.voices.get_all()
    voice_id = None
    
    # Find the voice ID by name
    for voice in voices.voices:
        if voice.name.lower() == voice_name.lower():
            voice_id = voice.voice_id
            break
    
    if not voice_id:
        # If voice not found, use the first available voice or a default voice
        default_voice_id = "21m00Tcm4TlvDq8ikWAM"  # Default voice (Rachel)
        voice_id = voices.voices[0].voice_id if voices.voices else default_voice_id
        print(f"Voice '{voice_name}' not found. Using a default voice instead.")
    
    # Generate audio
    audio = elevenlabs_client.text_to_speech.convert(
        text=text,
        voice_id=voice_id,
        model_id="eleven_monolingual_v1",
        output_format="mp3_44100_128"
    )
    
    if save_path:
        with open(save_path, "wb") as f:
            f.write(audio)
        print(f"Audio saved to {save_path}")
    else:
        # Play audio using elevenlabs play function
        play(audio)


def main():
    """Main function to run the LLM to speech pipeline."""
    parser = argparse.ArgumentParser(description="Convert LLM responses to speech")
    parser.add_argument("--prompt", type=str, help="Prompt to send to the LLM")
    parser.add_argument("--model", type=str, default="claude-3-opus-20240229", 
                        help="Anthropic model to use")
    parser.add_argument("--voice", type=str, default="Adam", 
                        help="ElevenLabs voice to use")
    parser.add_argument("--save", type=str, help="Path to save the audio file")
    parser.add_argument("--interactive", action="store_true", 
                        help="Run in interactive mode")
    
    args = parser.parse_args()
    
    if args.interactive:
        while True:
            prompt = input("\nEnter your prompt (or 'exit' to quit): ")
            if prompt.lower() == 'exit':
                break
                
            print("Getting response from Claude...")
            try:
                response = get_llm_response(prompt, args.model)
                print(f"\nClaude's response:\n{response}\n")
                
                print("Converting to speech...")
                text_to_speech(response, args.voice, args.save)
                
            except Exception as e:
                print(f"Error: {e}")
    
    elif args.prompt:
        try:
            response = get_llm_response(args.prompt, args.model)
            print(f"\nClaude's response:\n{response}\n")
            
            text_to_speech(response, args.voice, args.save)
            
        except Exception as e:
            print(f"Error: {e}")
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
