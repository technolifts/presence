"""
WebSocket Text-to-Speech Module

This module provides WebSocket support for real-time text-to-speech conversion
using ElevenLabs API.
"""

import json
import asyncio
from typing import Dict, Any, Optional
from fastapi import WebSocket, WebSocketDisconnect, HTTPException
from voice_clone import VoiceProcessor

class WebSocketTTSManager:
    """
    Manager for WebSocket text-to-speech connections.
    """
    
    def __init__(self, voice_processor: VoiceProcessor):
        """
        Initialize the WebSocket TTS Manager.
        
        Args:
            voice_processor: The VoiceProcessor instance to use for TTS
        """
        self.voice_processor = voice_processor
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str) -> None:
        """
        Accept a WebSocket connection and store it.
        
        Args:
            websocket: The WebSocket connection
            client_id: A unique identifier for the client
        """
        await websocket.accept()
        self.active_connections[client_id] = websocket
    
    def disconnect(self, client_id: str) -> None:
        """
        Remove a WebSocket connection.
        
        Args:
            client_id: The client ID to remove
        """
        if client_id in self.active_connections:
            del self.active_connections[client_id]
    
    async def process_text(self, websocket: WebSocket, client_id: str) -> None:
        """
        Process incoming text messages and stream audio back.
        
        Args:
            websocket: The WebSocket connection
            client_id: The client ID
        """
        try:
            # Initial configuration message
            config = await websocket.receive_json()
            
            # Extract voice information
            voice_id = config.get("voice_id")
            voice_name = config.get("voice_name")
            
            if not voice_id and not voice_name:
                await websocket.send_json({
                    "error": "Either voice_id or voice_name must be provided"
                })
                return
            
            # Send acknowledgment
            await websocket.send_json({
                "status": "ready",
                "message": "Ready to receive text"
            })
            
            # Process incoming text messages
            while True:
                try:
                    # Receive text message
                    message = await websocket.receive_json()
                    text = message.get("text", "")
                    
                    if not text:
                        continue
                    
                    # Check for end of conversation
                    if text.lower() == "end":
                        await websocket.send_json({
                            "status": "completed",
                            "message": "Text-to-speech session ended"
                        })
                        break
                    
                    # Generate speech with streaming
                    audio_stream = self.voice_processor.text_to_speech(
                        text=text,
                        voice_id=voice_id,
                        voice_name=voice_name,
                        stream=True
                    )
                    
                    # Send audio chunks
                    for chunk in audio_stream:
                        await websocket.send_bytes(chunk)
                    
                    # Send end marker
                    await websocket.send_json({
                        "status": "chunk_completed",
                        "message": "Audio chunk completed"
                    })
                    
                except json.JSONDecodeError:
                    await websocket.send_json({
                        "error": "Invalid JSON message"
                    })
                
        except WebSocketDisconnect:
            self.disconnect(client_id)
        except Exception as e:
            try:
                await websocket.send_json({
                    "error": f"Error processing text: {str(e)}"
                })
            except:
                pass
            self.disconnect(client_id)

# Function to register WebSocket endpoints with FastAPI
def register_websocket_routes(app, voice_processor: VoiceProcessor):
    """
    Register WebSocket routes with a FastAPI application.
    
    Args:
        app: The FastAPI application
        voice_processor: The VoiceProcessor instance
    """
    manager = WebSocketTTSManager(voice_processor)
    
    @app.websocket("/api/ws/tts/{client_id}")
    async def websocket_tts_endpoint(websocket: WebSocket, client_id: str):
        """
        WebSocket endpoint for text-to-speech.
        
        Args:
            websocket: The WebSocket connection
            client_id: A unique identifier for the client
        """
        await manager.connect(websocket, client_id)
        await manager.process_text(websocket, client_id)
