# Presence.ai

## Create Your Digital Twin with Voice Cloning

Presence.ai allows you to create a digital version of yourself that others can interact with anytime, anywhere. Using advanced AI technology, we clone your voice and create a personalized AI agent that responds to questions in your voice, based on information you provide.

## How It Works

1. **Upload Your Information**: Provide details about yourself through our profile creation process and upload documents that contain information about you.

2. **Record Your Voice**: Record audio samples that help us understand your voice patterns and speaking style.

3. **Create Your Digital Twin**: Our system builds a custom AI personality and clones your voice.

4. **Share With Others**: Get a unique link that allows people to chat with your digital twin.

## Key Features

- **Voice Cloning**: Advanced voice synthesis that captures your unique vocal characteristics
- **Document Processing**: Upload resumes, bios, and other documents to inform your digital twin
- **Conversational AI**: Natural language processing that responds to questions in your style
- **Secure Sharing**: Control who can interact with your digital presence

## Technical Details

- Built with Python, Flask, and modern web technologies
- Powered by ElevenLabs for voice cloning and synthesis
- Uses Anthropic's Claude for natural language understanding
- Document parsing supports PDF, DOCX, TXT, and Markdown formats

## Getting Started

### Requirements

- Python 3.8+
- FFmpeg (for audio processing)
- API keys for:
  - ElevenLabs
  - Anthropic (Claude)

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Create a `.env` file with your API keys:
   ```
   ELEVENLABS_API_KEY=your_elevenlabs_key_here
   ANTHROPIC_API_KEY=your_anthropic_key_here
   FLASK_SECRET_KEY=your_secret_key_here
   ```

4. Run the application:
   ```
   python backend/app.py
   ```

## Usage

1. Visit the web interface at `http://localhost:5050`
2. Create your profile and record your voice
3. Upload relevant documents about yourself
4. Share your unique link with others

## Privacy & Data Security

- Your voice data and personal information are used only for creating your digital twin
- All conversations are processed securely
- You control who has access to your digital presence

## License

MIT
=======
