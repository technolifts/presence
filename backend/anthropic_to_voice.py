#!/usr/bin/env python3
"""
Script to generate text using Anthropic API and speak it using a cloned voice from ElevenLabs.

This script demonstrates how to:
1. Generate text using Anthropic's Claude API
2. Use a previously cloned voice to speak the generated text
"""

import os
import sys
import argparse
from dotenv import load_dotenv
import anthropic
from elevenlabs.client import ElevenLabs
from elevenlabs import play

# Load environment variables from .env file
load_dotenv()

# Get API keys from environment variables
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

def generate_text_with_anthropic(prompt, max_tokens=300):
    """
    Generate text using Anthropic's Claude API.
    
    Args:
        prompt: The prompt to send to Claude
        max_tokens: Maximum number of tokens to generate
        
    Returns:
        Generated text from Claude
    """
    if not ANTHROPIC_API_KEY:
        raise ValueError("Anthropic API key not found. Please set ANTHROPIC_API_KEY environment variable.")
    
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    
    try:
        message = client.messages.create(
            model="claude-3-opus-20240229",
            max_tokens=max_tokens,
            system="You are a helpful assistant that provides concise, informative responses.",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        return message.content[0].text
    except Exception as e:
        print(f"Error generating text with Anthropic: {str(e)}")
        raise

def text_to_speech(text, voice_id):
    """
    Convert text to speech using ElevenLabs API.
    
    Args:
        text: The text to convert to speech
        voice_id: The ID of the voice to use
        
    Returns:
        Audio data as bytes
    """
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key not found. Please set ELEVENLABS_API_KEY environment variable.")
    
    client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
    
    try:
        audio = client.text_to_speech.convert(
            text=text,
            voice_id=voice_id,
            model_id="eleven_monolingual_v1",
            output_format="mp3_44100_128"
        )
        
        # Ensure we have bytes
        if not isinstance(audio, bytes):
            # If it's a generator or other iterable, convert to bytes
            if hasattr(audio, '__iter__') and not isinstance(audio, (str, bytes, bytearray)):
                audio = b''.join(chunk if isinstance(chunk, bytes) else bytes(chunk) for chunk in audio)
            else:
                raise TypeError(f"Unexpected audio type: {type(audio)}")
                
        return audio
    except Exception as e:
        print(f"Error converting text to speech: {str(e)}")
        raise

def main():
    """Main function to run the script."""
    parser = argparse.ArgumentParser(description="Generate text with Anthropic and speak it using a cloned voice")
    
    parser.add_argument("--voice-id", type=str, required=True, 
                        help="Voice ID of the cloned voice")
    parser.add_argument("--prompt", type=str, required=True,
                        help="Prompt to send to Anthropic's Claude")
    parser.add_argument("--max-tokens", type=int, default=300,
                        help="Maximum number of tokens to generate (default: 300)")
    parser.add_argument("--save", type=str,
                        help="Path to save the audio file")
    
    args = parser.parse_args()
    
    try:
        print(f"Generating text with Anthropic using prompt: '{args.prompt}'")
        generated_text = generate_text_with_anthropic(args.prompt, args.max_tokens)
        
        print("\nGenerated text:")
        print("--------------")
        print(generated_text)
        print("--------------\n")
        
        print(f"Converting text to speech using voice ID: {args.voice_id}")
        audio = text_to_speech(generated_text, args.voice_id)
        
        if args.save:
            with open(args.save, "wb") as f:
                f.write(audio)
            print(f"Audio saved to {args.save}")
        else:
            print("Playing audio...")
            play(audio)
            
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
