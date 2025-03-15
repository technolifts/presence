#!/usr/bin/env python3
"""
Document Parser Module

This module provides functionality to parse different document types
and extract text content for use as context in AI agents.
"""

import os
import re
import tempfile
from typing import List, Dict, Optional, BinaryIO, Union
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Try to import document parsing libraries
try:
    import PyPDF2
    HAS_PDF = True
except ImportError:
    logger.warning("PyPDF2 not installed. PDF parsing will be unavailable.")
    HAS_PDF = False

try:
    import docx
    HAS_DOCX = True
except ImportError:
    logger.warning("python-docx not installed. DOCX parsing will be unavailable.")
    HAS_DOCX = False

try:
    import markdown
    HAS_MARKDOWN = True
except ImportError:
    logger.warning("markdown not installed. Markdown parsing will be unavailable.")
    HAS_MARKDOWN = False


class DocumentParser:
    """
    A class for parsing various document types and extracting text content.
    """
    
    def __init__(self):
        """Initialize the document parser."""
        self.supported_extensions = {
            '.txt': self.parse_text,
            '.md': self.parse_markdown if HAS_MARKDOWN else self.parse_text,
            '.pdf': self.parse_pdf if HAS_PDF else None,
            '.docx': self.parse_docx if HAS_DOCX else None,
            '.doc': None  # Legacy .doc files not supported directly
        }
    
    def get_supported_extensions(self) -> List[str]:
        """Return a list of supported file extensions."""
        return [ext for ext, parser in self.supported_extensions.items() if parser is not None]
    
    def parse_document(self, file_path: Union[str, BinaryIO], file_extension: Optional[str] = None) -> str:
        """
        Parse a document and extract its text content.
        
        Args:
            file_path: Path to the document file or file-like object
            file_extension: File extension (if file_path is a file-like object)
            
        Returns:
            Extracted text content
            
        Raises:
            ValueError: If the file type is not supported
        """
        # If file_path is a string (path), get the extension from it
        if isinstance(file_path, str):
            _, ext = os.path.splitext(file_path)
            ext = ext.lower()
        # Otherwise use the provided extension
        elif file_extension:
            ext = file_extension.lower() if not file_extension.startswith('.') else file_extension.lower()
        else:
            raise ValueError("File extension must be provided for file-like objects")
        
        # Check if the extension is supported
        if ext not in self.supported_extensions:
            raise ValueError(f"Unsupported file type: {ext}")
        
        # Get the appropriate parser function
        parser_func = self.supported_extensions[ext]
        if parser_func is None:
            raise ValueError(f"Parser not available for {ext} files")
        
        # Parse the document
        return parser_func(file_path)
    
    def parse_text(self, file_path: Union[str, BinaryIO]) -> str:
        """Parse a plain text file."""
        try:
            if isinstance(file_path, str):
                with open(file_path, 'r', encoding='utf-8') as f:
                    return f.read()
            else:
                # Assume file_path is a file-like object
                if hasattr(file_path, 'read'):
                    # Try to read as text
                    try:
                        file_path.seek(0)
                        return file_path.read().decode('utf-8')
                    except UnicodeDecodeError:
                        # If it fails, it might be in binary mode
                        file_path.seek(0)
                        return file_path.read().decode('utf-8', errors='replace')
                else:
                    raise ValueError("Invalid file object")
        except Exception as e:
            logger.error(f"Error parsing text file: {str(e)}")
            return f"Error parsing text: {str(e)}"
    
    def parse_markdown(self, file_path: Union[str, BinaryIO]) -> str:
        """Parse a markdown file."""
        try:
            # First get the raw text
            raw_text = self.parse_text(file_path)
            
            # Convert markdown to HTML (to strip markdown syntax)
            html = markdown.markdown(raw_text)
            
            # Remove HTML tags to get plain text
            text = re.sub(r'<[^>]+>', '', html)
            
            return text
        except Exception as e:
            logger.error(f"Error parsing markdown file: {str(e)}")
            return f"Error parsing markdown: {str(e)}"
    
    def parse_pdf(self, file_path: Union[str, BinaryIO]) -> str:
        """Parse a PDF file."""
        try:
            # If file_path is a file-like object, save it to a temporary file
            temp_file = None
            if not isinstance(file_path, str):
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
                file_path.seek(0)
                temp_file.write(file_path.read())
                temp_file.close()
                file_path = temp_file.name
            
            # Open the PDF file
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                text = ""
                
                # Extract text from each page
                for page_num in range(len(reader.pages)):
                    page = reader.pages[page_num]
                    text += page.extract_text() + "\n\n"
                
                return text
        except Exception as e:
            logger.error(f"Error parsing PDF file: {str(e)}")
            return f"Error parsing PDF: {str(e)}"
        finally:
            # Clean up temporary file if created
            if temp_file and os.path.exists(temp_file.name):
                os.unlink(temp_file.name)
    
    def parse_docx(self, file_path: Union[str, BinaryIO]) -> str:
        """Parse a DOCX file."""
        try:
            # If file_path is a file-like object, save it to a temporary file
            temp_file = None
            if not isinstance(file_path, str):
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.docx')
                file_path.seek(0)
                temp_file.write(file_path.read())
                temp_file.close()
                file_path = temp_file.name
            
            # Open the DOCX file
            doc = docx.Document(file_path)
            
            # Extract text from paragraphs
            text = "\n".join([para.text for para in doc.paragraphs])
            
            return text
        except Exception as e:
            logger.error(f"Error parsing DOCX file: {str(e)}")
            return f"Error parsing DOCX: {str(e)}"
        finally:
            # Clean up temporary file if created
            if temp_file and os.path.exists(temp_file.name):
                os.unlink(temp_file.name)
