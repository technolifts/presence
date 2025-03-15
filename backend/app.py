#!/usr/bin/env python3
"""
Flask UI for Voice Cloning

This module provides a simple web interface for recording voice samples
and creating voice clones using the Voice Processing API.
"""

import os
import requests
import json
import datetime
from flask import Flask, render_template, request, jsonify, redirect, url_for, session, send_file
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
    """Render the profile creation page"""
    return render_template("index.html")

@app.route("/backend/sample_voice.mp3")
def sample_voice():
    """Serve the sample voice file"""
    return send_file(os.path.join(app.root_path, "sample_voice.mp3"))

@app.route("/visitor")
def visitor():
    """Render the visitor page for interacting with AI agents"""
    return render_template("visitor.html")

@app.route("/voices")
def voices():
    """Get all available voices"""
    response, status_code = api_request("/api/voices")
    if status_code == 200:
        return jsonify(response)
    return jsonify(response), status_code

@app.route("/clone-voice", methods=["POST"])
def clone_voice():
    """Clone a voice from an audio recording and create an agent profile"""
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    audio_file = request.files["audio"]
    name = request.form.get("name", "My AI Agent")
    description = request.form.get("description", "")
    
    # Get additional profile information
    profile_name = request.form.get("profile_name", "")
    profile_title = request.form.get("profile_title", "")
    profile_bio = request.form.get("profile_bio", "")
    
    # Create a more detailed description for the voice
    if not description and (profile_name or profile_title or profile_bio):
        description = f"AI Agent for {profile_name}"
        if profile_title:
            description += f", {profile_title}"
    
    files = {"file": (f"{name}.mp3", audio_file, "audio/mpeg")}
    data = {
        "name": name,
        "description": description,
        "remove_noise": "true"
    }
    
    response, status_code = api_request("/api/voices/clone", method="POST", data=data, files=files)
    
    if status_code == 200:
        # Store the voice ID and profile info in session
        session["last_voice_id"] = response.get("voice_id")
        session["last_voice_name"] = name
        session["profile_name"] = profile_name
        session["profile_title"] = profile_title
        session["profile_bio"] = profile_bio
        
        # Store the profile in a database or file system (simplified for now)
        # In a real implementation, you would save this to a database
        try:
            profiles_dir = os.path.join(app.root_path, "profiles")
            os.makedirs(profiles_dir, exist_ok=True)
            
            profile_data = {
                "voice_id": response.get("voice_id"),
                "name": profile_name,
                "title": profile_title,
                "bio": profile_bio,
                "created_at": str(datetime.datetime.now())
            }
            
            with open(os.path.join(profiles_dir, f"{response.get('voice_id')}.json"), "w") as f:
                json.dump(profile_data, f)
                
            response["profile"] = profile_data
        except Exception as e:
            app.logger.error(f"Error saving profile: {str(e)}")
            
        return jsonify(response)
    
    return jsonify(response), status_code

@app.route("/text-to-speech", methods=["POST"])
def text_to_speech():
    """Convert text to speech using a cloned voice"""
    data = request.json
    
    if not data or "text" not in data:
        return jsonify({"error": "No text provided"}), 400
    
    voice_id = data.get("voice_id") or session.get("last_voice_id") or "v8qylBrMZzkqn8nZJUZX"  # Default: Testing
    
    payload = {
        "text": data["text"],
        "voice_id": voice_id
    }
    
    response, status_code = api_request("/api/tts", method="POST", data=json.dumps(payload))
    
    if status_code == 200:
        # This is binary audio data
        return response, 200, {"Content-Type": "audio/mpeg"}
    
    return jsonify(response), status_code

@app.route("/agents")
def list_agents():
    """List all available agents"""
    try:
        profiles_dir = os.path.join(app.root_path, "profiles")
        if not os.path.exists(profiles_dir):
            return jsonify({"agents": []})
        
        agents = []
        for filename in os.listdir(profiles_dir):
            if filename.endswith(".json"):
                with open(os.path.join(profiles_dir, filename), "r") as f:
                    profile = json.load(f)
                    agents.append(profile)
        
        return jsonify({"agents": agents})
    except Exception as e:
        app.logger.error(f"Error listing agents: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/chat", methods=["POST"])
def chat():
    """Chat with an AI agent"""
    data = request.json
    
    if not data or "message" not in data or "agent_id" not in data:
        return jsonify({"error": "Missing required parameters"}), 400
    
    message = data["message"]
    agent_id = data["agent_id"]
    
    # Get agent profile
    try:
        profile_path = os.path.join(app.root_path, "profiles", f"{agent_id}.json")
        if not os.path.exists(profile_path):
            return jsonify({"error": "Agent not found"}), 404
            
        with open(profile_path, "r") as f:
            profile = json.load(f)
    except Exception as e:
        app.logger.error(f"Error loading agent profile: {str(e)}")
        return jsonify({"error": "Error loading agent profile"}), 500
    
    # Generate response using Anthropic (or other LLM)
    # This is a simplified version - in a real app, you'd use the anthropic_to_voice module
    try:
        # For now, we'll use a simple response
        response_text = f"This is a placeholder response from {profile['name']}. In the full implementation, this would be generated by Claude based on the user's message: '{message}'"
        
        # Store the response text in the session for retrieval
        session["last_response_text"] = response_text
        
        # Convert to speech
        payload = {
            "text": response_text,
            "voice_id": agent_id
        }
        
        response, status_code = api_request("/api/tts", method="POST", data=json.dumps(payload))
        
        if status_code == 200:
            # This is binary audio data
            return response, 200, {"Content-Type": "audio/mpeg"}
        
        return jsonify({"error": "Error generating speech"}), status_code
    except Exception as e:
        app.logger.error(f"Error in chat: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/last-response-text")
def last_response_text():
    """Get the text of the last response"""
    text = session.get("last_response_text", "No response available")
    return jsonify({"text": text})

@app.route("/download-speech", methods=["POST"])
def download_speech():
    """Download text-to-speech as an MP3 file"""
    data = request.json
    
    if not data or "text" not in data:
        return jsonify({"error": "No text provided"}), 400
    
    voice_id = data.get("voice_id") or session.get("last_voice_id") or "v8qylBrMZzkqn8nZJUZX"  # Default: Testing
    
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
