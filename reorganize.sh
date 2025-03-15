#!/bin/bash

# Create backend directory if it doesn't exist
mkdir -p backend

# Move Python backend files to backend directory
mv voice_clone.py backend/
mv anthropic_to_voice.py backend/
mv api.py backend/
mv app.py backend/

# Create __init__.py to make backend a proper package
touch backend/__init__.py

# Copy sample voice file to backend
cp sample_voice.mp3 backend/

# Create a symlink to static and templates directories in backend
# This ensures Flask can still find these directories
ln -sf ../static backend/
ln -sf ../templates backend/

echo "Reorganization complete. Backend files moved to backend/ directory."
