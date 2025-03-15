#!/usr/bin/env python3
"""
Voice Processing API

This module provides a FastAPI implementation of the voice processing functionality,
exposing endpoints for transcription, voice cloning, and text-to-speech.
"""

import os
import tempfile
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, Header
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv
from io import BytesIO

# Import the VoiceProcessor class
from voice_clone import VoiceProcessor

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Voice Processing API",
    description="API for voice transcription, cloning, and text-to-speech",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Modify in production to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API key authentication
API_KEY = os.getenv("API_KEY", "default_api_key")  # Set a secure API key in .env

def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key

# Initialize VoiceProcessor
voice_processor = None

@app.on_event("startup")
async def startup_event():
    global voice_processor
    try:
        voice_processor = VoiceProcessor()
    except ValueError as e:
        print(f"Error initializing voice processor: {e}")
        # Continue without voice processor, will handle in endpoints

# Models
class TextResponse(BaseModel):
    text: str

class VoiceResponse(BaseModel):
    voice_id: str
    name: str

class VoiceListResponse(BaseModel):
    voices: List[VoiceResponse]

class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None
    voice_name: Optional[str] = None

# Endpoints
@app.post("/api/transcribe", response_model=TextResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    api_key: str = Depends(verify_api_key)
):
    """
    Transcribe speech from an audio file to text.
    """
    if not voice_processor:
        raise HTTPException(status_code=500, detail="Voice processor not initialized")
    
    # Save uploaded file to a temporary file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
    try:
        # Write content to temp file
        content = await file.read()
        temp_file.write(content)
        temp_file.close()
        
        # Transcribe the audio
        text = voice_processor.speech_to_text(temp_file.name)
        
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error transcribing audio: {str(e)}")
    finally:
        # Clean up the temporary file
        try:
            os.unlink(temp_file.name)
        except (OSError, FileNotFoundError):
            pass

@app.post("/api/voices/clone", response_model=VoiceResponse)
async def clone_voice(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    remove_noise: bool = Form(False),
    api_key: str = Depends(verify_api_key)
):
    """
    Clone a voice from an audio file.
    """
    if not voice_processor:
        raise HTTPException(status_code=500, detail="Voice processor not initialized")
    
    # Save uploaded file to a temporary file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
    try:
        # Write content to temp file
        content = await file.read()
        temp_file.write(content)
        temp_file.close()
        
        # Clone the voice
        voice_id = voice_processor.clone_voice(
            temp_file.name,
            name,
            description=description,
            remove_background_noise=remove_noise
        )
        
        return {"voice_id": voice_id, "name": name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error cloning voice: {str(e)}")
    finally:
        # Clean up the temporary file
        try:
            os.unlink(temp_file.name)
        except (OSError, FileNotFoundError):
            pass

@app.get("/api/voices", response_model=VoiceListResponse)
async def list_voices(api_key: str = Depends(verify_api_key)):
    """
    List all available voices.
    """
    if not voice_processor:
        raise HTTPException(status_code=500, detail="Voice processor not initialized")
    
    try:
        # Get all voices from ElevenLabs
        voices_response = voice_processor.elevenlabs_client.voices.get_all()
        
        # Format the response
        voices = [
            {"voice_id": voice.voice_id, "name": voice.name}
            for voice in voices_response.voices
        ]
        
        return {"voices": voices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing voices: {str(e)}")

@app.post("/api/tts")
async def text_to_speech(
    request: TTSRequest,
    api_key: str = Depends(verify_api_key)
):
    """
    Convert text to speech using a specified voice.
    """
    if not voice_processor:
        raise HTTPException(status_code=500, detail="Voice processor not initialized")
    
    if not request.voice_id and not request.voice_name:
        raise HTTPException(status_code=400, detail="Either voice_id or voice_name must be provided")
    
    try:
        # Generate speech
        audio = voice_processor.text_to_speech(
            text=request.text,
            voice_id=request.voice_id,
            voice_name=request.voice_name
        )
        
        # Ensure audio is bytes, not a generator
        if not isinstance(audio, bytes):
            # If it's a generator or other iterable, convert to bytes
            if hasattr(audio, '__iter__') and not isinstance(audio, (str, bytes, bytearray)):
                audio_bytes = b''.join(chunk if isinstance(chunk, bytes) else bytes(chunk) for chunk in audio)
            else:
                raise TypeError(f"Unexpected audio type: {type(audio)}")
        else:
            audio_bytes = audio
        
        # Return audio as a streaming response
        return StreamingResponse(
            BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "attachment; filename=speech.mp3"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating speech: {str(e)}")

@app.post("/api/optimize-audio")
async def optimize_audio(
    file: UploadFile = File(...),
    duration: int = Form(90),
    api_key: str = Depends(verify_api_key)
):
    """
    Optimize an audio file for voice cloning.
    """
    if not voice_processor:
        raise HTTPException(status_code=500, detail="Voice processor not initialized")
    
    # Save uploaded file to a temporary file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
    try:
        # Write content to temp file
        content = await file.read()
        temp_file.write(content)
        temp_file.close()
        
        # Create a temporary output file
        output_file = tempfile.NamedTemporaryFile(delete=False, suffix="_optimized.mp3")
        output_file.close()
        
        # Optimize the audio
        optimized_file = voice_processor.create_optimized_sample(
            temp_file.name,
            duration=duration,
            output_path=output_file.name
        )
        
        if not optimized_file:
            raise HTTPException(status_code=500, detail="Failed to optimize audio")
        
        # Return the optimized file
        return FileResponse(
            optimized_file,
            media_type="audio/mpeg",
            filename="optimized_audio.mp3"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error optimizing audio: {str(e)}")
    finally:
        # Clean up the temporary files
        try:
            os.unlink(temp_file.name)
            # Don't delete output_file here as it's being returned
        except (OSError, FileNotFoundError):
            pass

def start():
    """Start the API server"""
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)

if __name__ == "__main__":
    start()
