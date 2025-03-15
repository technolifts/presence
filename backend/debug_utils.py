#!/usr/bin/env python3
"""
Debug utilities for the backend application.
"""

import os
import json
import logging
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def log_anthropic_response(prompt, response, error=None):
    """
    Log Anthropic API requests and responses for debugging.
    
    Args:
        prompt: The prompt sent to Anthropic
        response: The response received from Anthropic (or None if error)
        error: Any error that occurred (optional)
    """
    try:
        # Create logs directory if it doesn't exist
        logs_dir = os.path.join(os.path.dirname(__file__), "logs")
        os.makedirs(logs_dir, exist_ok=True)
        
        # Create a log file with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_file = os.path.join(logs_dir, f"anthropic_log_{timestamp}.json")
        
        # Prepare log data
        log_data = {
            "timestamp": datetime.now().isoformat(),
            "prompt": prompt,
            "response": None,
            "error": str(error) if error else None
        }
        
        # Add response data if available
        if response and not error:
            try:
                if hasattr(response, 'content') and response.content:
                    log_data["response"] = {
                        "content": [
                            {"type": item.type, "text": item.text} 
                            for item in response.content
                        ] if hasattr(response.content, '__iter__') else str(response.content)
                    }
                else:
                    log_data["response"] = str(response)
            except Exception as e:
                log_data["response"] = str(response)
                log_data["response_parse_error"] = str(e)
        
        # Write to log file
        with open(log_file, "w", encoding="utf-8") as f:
            json.dump(log_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Anthropic API interaction logged to {log_file}")
        
    except Exception as e:
        logger.error(f"Error logging Anthropic API interaction: {str(e)}")
