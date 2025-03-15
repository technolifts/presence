#!/usr/bin/env python3
"""
Flask UI for Voice Cloning

This module provides a simple web interface for recording voice samples
and creating voice clones using the Voice Processing API.
"""

import os
import requests
import json
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
API_URL = os.getenv("API_URL", "http://localhost:8000")
API_KEY = os.getenv("API_KEY", "default_api_key")

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev_secret_key")  # Set a secure key in .env for production

# API client functions
def api_request(endpoint, method="GET", data=None, files=None):
    """Make a request to the Voice Processing API"""
    url = f"{API_URL}{endpoint}"
    headers = {"x-api-key": API_KEY}
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, headers=headers, data=data, files=files)
        else:
            return {"error": "Unsupported method"}, 400
        
        if response.status_code == 200:
            if response.headers.get("content-type") == "application/json":
                return response.json(), 200
            return response.content, 200
        else:
            return {"error": f"API error: {response.text}"}, response.status_code
    except Exception as e:
        return {"error": f"Request error: {str(e)}"}, 500

# Routes
@app.route("/")
def index():
    """Render the main page"""
    return render_template("index.html")

@app.route("/voices")
def voices():
    """Get all available voices"""
    response, status_code = api_request("/api/voices")
    if status_code == 200:
        return jsonify(response)
    return jsonify(response), status_code

@app.route("/clone-voice", methods=["POST"])
def clone_voice():
    """Clone a voice from an audio recording"""
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    audio_file = request.files["audio"]
    name = request.form.get("name", "My Voice Clone")
    description = request.form.get("description", "Created with Voice Cloning UI")
    
    files = {"file": (f"{name}.mp3", audio_file, "audio/mpeg")}
    data = {
        "name": name,
        "description": description,
        "remove_noise": "true"
    }
    
    response, status_code = api_request("/api/voices/clone", method="POST", data=data, files=files)
    
    if status_code == 200:
        # Store the voice ID in session
        session["last_voice_id"] = response.get("voice_id")
        session["last_voice_name"] = name
        return jsonify(response)
    
    return jsonify(response), status_code

@app.route("/text-to-speech", methods=["POST"])
def text_to_speech():
    """Convert text to speech using a cloned voice"""
    data = request.json
    
    if not data or "text" not in data:
        return jsonify({"error": "No text provided"}), 400
    
    voice_id = data.get("voice_id") or session.get("last_voice_id")
    
    if not voice_id:
        return jsonify({"error": "No voice ID provided or found in session"}), 400
    
    payload = {
        "text": data["text"],
        "voice_id": voice_id
    }
    
    response, status_code = api_request("/api/tts", method="POST", data=json.dumps(payload))
    
    if status_code == 200:
        # This is binary audio data
        return response, 200, {"Content-Type": "audio/mpeg"}
    
    return jsonify(response), status_code

@app.route("/download-speech", methods=["POST"])
def download_speech():
    """Download text-to-speech as an MP3 file"""
    data = request.json
    
    if not data or "text" not in data:
        return jsonify({"error": "No text provided"}), 400
    
    voice_id = data.get("voice_id") or session.get("last_voice_id")
    
    if not voice_id:
        return jsonify({"error": "No voice ID provided or found in session"}), 400
    
    filename = data.get("filename", "voice_output.mp3")
    
    payload = {
        "text": data["text"],
        "voice_id": voice_id,
        "filename": filename
    }
    
    response, status_code = api_request("/api/tts/download", method="POST", data=json.dumps(payload))
    
    if status_code == 200:
        # This is binary audio data with download headers
        return response, 200, {
            "Content-Type": "audio/mpeg",
            "Content-Disposition": f"attachment; filename=\"{filename}\""
        }
    
    return jsonify(response), status_code

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5050)
