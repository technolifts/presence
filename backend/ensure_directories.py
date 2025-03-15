#!/usr/bin/env python3
"""
Utility script to ensure required directories exist
"""

import os
import sys

def ensure_directories():
    """Create necessary directories for the application"""
    # Get the base directory (backend)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Directories to create
    directories = [
        os.path.join(base_dir, "documents"),
        os.path.join(base_dir, "profiles"),
    ]
    
    # Create each directory if it doesn't exist
    for directory in directories:
        if not os.path.exists(directory):
            print(f"Creating directory: {directory}")
            os.makedirs(directory, exist_ok=True)
        else:
            print(f"Directory already exists: {directory}")
    
    print("Directory structure verified.")

if __name__ == "__main__":
    ensure_directories()
