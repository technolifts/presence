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
import glob
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
    
    # Get interview data if available
    interview_data = request.form.get("interview_data", "[]")
    try:
        interview_responses = json.loads(interview_data)
    except:
        interview_responses = []
    
    # Create documents directory for this agent (will be populated later)
    documents_dir = os.path.join(app.root_path, "documents")
    os.makedirs(documents_dir, exist_ok=True)
    
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
                "interview_data": interview_responses,
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
    
    # Get agent documents if available
    agent_documents = []
    documents_dir = os.path.join(app.root_path, "documents", agent_id)
    if os.path.exists(documents_dir):
        for doc_file in glob.glob(os.path.join(documents_dir, "*.txt")):
            try:
                with open(doc_file, "r", encoding="utf-8") as f:
                    agent_documents.append(f.read())
            except Exception as e:
                app.logger.error(f"Error reading document {doc_file}: {str(e)}")
    
    # Generate response using Anthropic Claude
    try:
        import anthropic
        
        # Get API key from environment
        anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
        if not anthropic_api_key:
            app.logger.error("ANTHROPIC_API_KEY not found in environment")
            return jsonify({"error": "API key not configured"}), 500
        
        # Initialize Anthropic client
        client = anthropic.Anthropic(api_key=anthropic_api_key)
        
        # Create system prompt using profile information
        system_prompt = f"""You are now acting as {profile['name']}, based on their provided information. Your goal is to respond to questions as if you were them, using their communication style, values, preferences, and knowledge. Only share information that has been explicitly provided in their profile or can be reasonably inferred from it. When asked about topics not covered in their profile, respond with how {profile['name']} would likely handle such a question based on their personality, without making up specific facts. Maintain their tone and speaking style in all responses.

Here's information about {profile['name']}:"""
        
        if profile.get('title'):
            system_prompt += f"\nProfessional Title: {profile['title']}"
        
        if profile.get('bio'):
            system_prompt += f"\nBackground Information: {profile['bio']}"
        
        # Add interview data if available
        if profile.get('interview_data') and len(profile['interview_data']) > 0:
            system_prompt += "\n\nAdditional Information from Interview:"
            for item in profile['interview_data']:
                system_prompt += f"\n\nQuestion: {item['question']}\nAnswer: {item['answer']}"
        
        system_prompt += """

When responding to the user:
1. Stay in character as the person described above
2. Use first-person perspective ("I" not "they")
3. Be conversational and authentic to the person's style
4. Draw on the background information to inform your responses
5. If asked something you don't know, respond naturally without making up specific details
6. Maintain the person's tone, vocabulary, and communication patterns
"""

        # Add document context if available
        if agent_documents:
            system_prompt += "\n\nAdditional context from documents:\n"
            for i, doc in enumerate(agent_documents):
                # Limit document length to avoid exceeding context window
                max_doc_length = 10000  # Adjust based on your model's context window
                doc_text = doc[:max_doc_length] + "..." if len(doc) > max_doc_length else doc
                system_prompt += f"\nDocument {i+1}:\n{doc_text}\n"
        
        # Get conversation history from session
        conversation_key = f"conversation_{agent_id}"
        conversation_history = session.get(conversation_key, [])
        
        # Generate response with Claude
        response = client.messages.create(
            model="claude-3-7-sonnet-20250219",
            system=system_prompt,
            max_tokens=1000,
            messages=[
                *conversation_history,
                {"role": "user", "content": message}
            ]
        )
        
        # Extract the response text
        response_text = response.content[0].text
        
        # Update conversation history (keep last 10 messages to manage context window)
        conversation_history.append({"role": "user", "content": message})
        conversation_history.append({"role": "assistant", "content": response_text})
        
        # Trim history if it gets too long (keep last 10 messages)
        if len(conversation_history) > 10:
            conversation_history = conversation_history[-10:]
        
        # Store updated history in session
        session[conversation_key] = conversation_history
        
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

@app.route("/upload-document", methods=["POST"])
def upload_document():
    """Upload a document to be associated with an agent"""
    if "document" not in request.files:
        return jsonify({"error": "No document file provided"}), 400
    
    document_file = request.files["document"]
    agent_id = request.form.get("agent_id")
    
    if not agent_id:
        return jsonify({"error": "No agent ID provided"}), 400
    
    # Check if agent exists
    profile_path = os.path.join(app.root_path, "profiles", f"{agent_id}.json")
    if not os.path.exists(profile_path):
        return jsonify({"error": "Agent not found"}), 404
    
    # Send the document to the API for parsing
    files = {"file": (document_file.filename, document_file, document_file.content_type)}
    data = {"agent_id": agent_id}
    
    response, status_code = api_request("/api/documents/parse", method="POST", data=data, files=files)
    
    if status_code == 200:
        return jsonify(response)
    
    return jsonify(response), status_code

@app.route("/documents/<agent_id>")
def list_documents(agent_id):
    """List all documents associated with an agent"""
    response, status_code = api_request(f"/api/documents?agent_id={agent_id}")
    
    if status_code == 200:
        return jsonify(response)
    
    return jsonify(response), status_code

@app.route("/documents/<agent_id>/<filename>", methods=["DELETE"])
def delete_document(agent_id, filename):
    """Delete a document associated with an agent"""
    response, status_code = api_request(f"/api/documents/{filename}?agent_id={agent_id}", method="DELETE")
    
    if status_code == 200:
        return jsonify(response)
    
    return jsonify(response), status_code

@app.route("/generate-interview-questions", methods=["POST"])
def generate_interview_questions():
    """Generate interview questions using the provided prompt"""
    try:
        import anthropic
        
        # Get API key from environment
        anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
        if not anthropic_api_key:
            app.logger.error("ANTHROPIC_API_KEY not found in environment")
            return jsonify({"error": "API key not configured"}), 500
        
        # Initialize Anthropic client
        client = anthropic.Anthropic(api_key=anthropic_api_key)
        
        # The interview prompt
        prompt = """# Professional Experience & Hobbies Extraction

You are a specialized interview system designed to extract specific information about a person's professional experience and hobbies to create their digital twin. Your goal is to generate MAXIMUM 10 QUESTIONS TOTAL that will help us understand:
1) Their professional background, expertise, and work knowledge in detail
2) Their hobbies and personal interests with specific examples

Focus on questions that reveal concrete facts and specific examples rather than abstract preferences. Do not include questions about communication style, as this will be extracted from audio recordings. Do not exceed 15 questions under any circumstances.

## Instructions

1. Generate a diverse set of questions across the categories below. Focus on questions that reveal meaningful aspects of the person that would be important for realistic conversation simulation.

2. Make questions specific, not generic. For example, instead of "What are your hobbies?" ask "What activity do you find yourself losing track of time while doing, and what about it captivates you?"

3. Ask progressive questions that build on expected answers to create a natural conversational flow.

4. Include both direct questions for factual information and indirect questions that reveal personality, values, and communication style.

5. Consider the emotional dimension - ask questions that might reveal how the person responds to different emotional scenarios.

## Focused Categories

### Professional Experience
- Their career path and specific roles they've held
- Areas of professional expertise and specialized knowledge
- Significant projects or achievements they could discuss in detail
- How they talk about their industry or field
- Factual information about their work that visitors might ask about
- Common questions they receive about their profession
- Professional opinions or perspectives they often share

### Hobbies & Interests
- Specific activities they engage in regularly
- Detailed aspects of their hobbies they could discuss knowledgeably
- How long they've been involved with these interests
- Factual information about their hobbies that shows their expertise
- Why they are drawn to these particular activities
- Recommendations they typically give related to their interests
- Personal experiences tied to their hobbies

## Output Format

1. Generate EXACTLY 10 QUESTIONS TOTAL across both categories (professional experience and hobbies).
2. Distribute the questions roughly equally between the two categories.
3. Each question should be designed to elicit specific, factual information or concrete examples.
4. Present the questions in a conversational sequence that flows naturally.
5. Prioritize questions that will generate responses useful for someone else chatting with this person's digital twin.
6. Use clear, direct language that encourages detailed responses.
7. Number each question clearly (1-10 maximum).
8. Include a mix of questions about:
   - Facts (specific information the digital twin should know)
   - Experiences (detailed examples that demonstrate knowledge)
   - Preferences (that show personality through interests)
9. DO NOT include any questions about communication style, speaking patterns, or language preferences.
10. Review your final output to confirm you have not exceeded 10 questions and that all questions focus specifically on professional experience or hobbies.

Return ONLY the numbered questions as a JSON array, with no additional text or explanation."""
        
        # Generate questions with Claude
        response = client.messages.create(
            model="claude-3-7-sonnet-20250219",
            max_tokens=1000,
            system="You are a helpful assistant that generates interview questions according to the provided instructions. Return only the questions in a JSON array format.",
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        
        # Extract the response text
        response_text = response.content[0].text
        
        # Parse the JSON array from the response
        import json
        import re
        
        # Try to extract a JSON array from the response
        json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
        if json_match:
            questions_json = json_match.group(0)
            questions = json.loads(questions_json)
        else:
            # Fallback: extract numbered questions
            questions = []
            for line in response_text.split('\n'):
                match = re.match(r'^\s*\d+\.\s*(.*)', line)
                if match:
                    questions.append(match.group(1))
        
        return jsonify({"questions": questions})
    except Exception as e:
        app.logger.error(f"Error generating interview questions: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/save-interview-responses", methods=["POST"])
def save_interview_responses():
    """Save interview responses to the user's profile"""
    try:
        data = request.json
        responses = data.get("responses", [])
        
        # Store in session for now
        session["interview_responses"] = responses
        
        return jsonify({"success": True})
    except Exception as e:
        app.logger.error(f"Error saving interview responses: {str(e)}")
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
