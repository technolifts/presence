# Voice Cloning and Processing Tool

A command-line tool for voice processing, cloning, and text-to-speech conversion using ElevenLabs and OpenAI APIs.

## Features

- **Speech to Text**: Transcribe audio files using OpenAI's Whisper model
- **Voice Cloning**: Clone voices using ElevenLabs API
- **Text to Speech**: Generate speech from text using standard or cloned voices
- **Audio Optimization**: Create optimized audio samples for voice cloning

## Requirements

- Python 3.8+
- FFmpeg (for audio processing)
- API keys for:
  - ElevenLabs
  - OpenAI

## Installation

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
   OPENAI_API_KEY=your_openai_key_here
   ```

## Usage

### Transcribe Audio to Text

```
python voice_clone.py transcribe --file <audio_file> [--save <output_file>]
```

### Clone a Voice

```
python voice_clone.py clone --file <audio_file> --name <voice_name> [--description <desc>]
```

### Convert Text to Speech

```
python voice_clone.py speak --text "Your text here" --voice <voice_name> [--save <output_file>]
```

Or from a file:

```
python voice_clone.py speak --file <text_file> --voice <voice_name> [--save <output_file>]
```

### Optimize Audio for Voice Cloning

```
python voice_clone.py optimize --file <audio_file> [--duration <seconds>] [--output <output_file>]
```

## Troubleshooting

- **File Size Issues**: ElevenLabs has an 11MB file size limit for voice cloning. Use the `optimize` command to create a smaller file.
- **Audio Format Issues**: Make sure your audio files are in a compatible format (MP3 is recommended).
- **API Key Errors**: Ensure your API keys are correctly set in the `.env` file.

## License

MIT
