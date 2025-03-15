/**
 * Voice Cloning UI Application
 * Handles the UI interactions for recording, cloning voices, and testing
 */
document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const recordButton = document.getElementById('recordButton');
    const visualizerCanvas = document.getElementById('visualizer');
    const recordedAudio = document.getElementById('recordedAudio');
    const audioPlayer = document.querySelector('.audio-player');
    const profileForm = document.getElementById('profileForm');
    const voiceCloneForm = document.getElementById('voiceCloneForm');
    const createVoiceButton = document.getElementById('createVoiceButton');
    const cloneStatus = document.getElementById('cloneStatus');
    const cloneResult = document.getElementById('cloneResult');
    const profileName = document.getElementById('profileName');
    const profileTitle = document.getElementById('profileTitle');
    const profileBio = document.getElementById('profileBio');
    const copyLinkButton = document.getElementById('copyLink');
    const shareLinkInput = document.getElementById('shareLink');
    const resultVoiceName = document.getElementById('resultVoiceName');
    const resultVoiceId = document.getElementById('resultVoiceId');
    const speakButton = document.getElementById('speakButton');
    const testText = document.getElementById('testText');
    const testAudio = document.getElementById('testAudio');
    const testAudioPlayer = document.querySelector('.test-audio-player');

    // Set canvas dimensions
    if (visualizerCanvas) {
        visualizerCanvas.width = visualizerCanvas.offsetWidth;
        visualizerCanvas.height = visualizerCanvas.offsetHeight;
    }

    // Initialize recorder
    const recorder = new AudioRecorder(visualizerCanvas);
    let audioBlob = null;
    
    // Sample voice button
    const useSampleVoiceButton = document.getElementById('useSampleVoice');
    if (useSampleVoiceButton) {
        useSampleVoiceButton.addEventListener('click', async () => {
            try {
                useSampleVoiceButton.disabled = true;
                useSampleVoiceButton.textContent = 'Loading sample...';
                
                // Fetch the sample voice file
                const response = await fetch('/backend/sample_voice.mp3');
                audioBlob = await response.blob();
                
                // Display the sample audio
                const audioURL = URL.createObjectURL(audioBlob);
                recordedAudio.src = audioURL;
                audioPlayer.style.display = 'block';
                
                // Enable the create voice button
                createVoiceButton.disabled = false;
                
                // Update UI
                useSampleVoiceButton.textContent = 'Sample voice loaded!';
                recordButton.disabled = true;
                
                // Show success message
                alert('Sample voice loaded successfully! You can now create an AI agent without recording.');
            } catch (error) {
                console.error('Error loading sample voice:', error);
                alert('Error loading sample voice. Please try recording instead.');
                useSampleVoiceButton.textContent = 'Use Sample Voice Instead';
                useSampleVoiceButton.disabled = false;
            }
        });
    }

    // Recording functionality
    if (recordButton) {
        recordButton.addEventListener('click', async () => {
            if (recorder.isRecording) {
                // Stop recording
                recordButton.disabled = true;
                recordButton.textContent = 'Processing...';
                
                audioBlob = await recorder.stop();
                
                // Update UI
                recordButton.classList.remove('recording');
                recordButton.innerHTML = '<span class="record-icon"></span>Start Recording';
                recordButton.disabled = false;
                
                // Display the recorded audio
                const audioURL = URL.createObjectURL(audioBlob);
                recordedAudio.src = audioURL;
                audioPlayer.style.display = 'block';
                
                // Enable the create voice button
                createVoiceButton.disabled = false;
            } else {
                // Start recording
                const started = await recorder.start();
                
                if (started) {
                    // Update UI
                    recordButton.classList.add('recording');
                    recordButton.innerHTML = '<span class="record-icon"></span>Stop Recording';
                    audioPlayer.style.display = 'none';
                } else {
                    alert('Could not access microphone. Please ensure you have granted permission.');
                }
            }
        });
    }

    // Voice cloning form submission
    if (voiceCloneForm) {
        voiceCloneForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!audioBlob) {
                alert('Please record your voice first.');
                return;
            }
            
            // Get profile information
            const name = profileName.value;
            if (!name) {
                alert('Please enter your name');
                profileName.focus();
                return;
            }
            
            // Set the voice name and description from profile
            const voiceName = name + "'s Voice";
            document.getElementById('voiceName').value = voiceName;
            
            const title = profileTitle.value;
            const bio = profileBio.value;
            const voiceDescription = `AI Agent for ${name}${title ? ', ' + title : ''}`;
            document.getElementById('voiceDescription').value = voiceDescription;
            
            // Create form data for API request
            const formData = new FormData();
            formData.append('audio', audioBlob, `${voiceName}.mp3`);
            formData.append('name', voiceName);
            formData.append('description', voiceDescription || `Voice clone for ${voiceName}`);
            formData.append('profile_name', name);
            formData.append('profile_title', title);
            formData.append('profile_bio', bio);
            
            // Show loading state
            createVoiceButton.disabled = true;
            cloneStatus.style.display = 'block';
            cloneResult.style.display = 'none';
            
            try {
                // Send request to clone voice
                const response = await fetch('/clone-voice', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // Show success result
                    document.getElementById('resultAgentName').textContent = name;
                    resultVoiceId.textContent = data.voice_id;
                    cloneResult.style.display = 'block';
                    
                    // Store voice ID for testing
                    window.lastVoiceId = data.voice_id;
                    
                    // Trigger event for agent creation
                    document.dispatchEvent(new CustomEvent('agentCreated', {
                        detail: {
                            agentId: data.voice_id,
                            agentName: name
                        }
                    }));
                } else {
                    // Show error
                    alert(`Error: ${data.error || 'Failed to clone voice'}`);
                    createVoiceButton.disabled = false;
                }
            } catch (error) {
                alert(`Error: ${error.message}`);
                createVoiceButton.disabled = false;
            } finally {
                cloneStatus.style.display = 'none';
            }
        });
    }

    // Text-to-speech testing
    if (speakButton) {
        speakButton.addEventListener('click', async () => {
            const text = testText.value.trim();
            const voiceId = window.lastVoiceId;
            
            if (!text) {
                alert('Please enter some text to speak.');
                return;
            }
            
            if (!voiceId) {
                alert('No voice ID found. Please create a voice clone first.');
                return;
            }
            
            // Show loading state
            speakButton.disabled = true;
            speakButton.textContent = 'Generating...';
            
            try {
                // Send request to generate speech
                const response = await fetch('/text-to-speech', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: text,
                        voice_id: voiceId
                    })
                });
                
                if (response.ok) {
                    // Get audio blob
                    const audioBlob = await response.blob();
                    const audioURL = URL.createObjectURL(audioBlob);
                    
                    // Update audio player
                    testAudio.src = audioURL;
                    testAudioPlayer.style.display = 'block';
                    testAudio.play();
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.error || 'Failed to generate speech'}`);
                }
            } catch (error) {
                alert(`Error: ${error.message}`);
            } finally {
                // Reset button state
                speakButton.disabled = false;
                speakButton.textContent = 'Speak Text';
            }
        });
    }

    // Create templates directory if it doesn't exist
    function createDirectoryStructure() {
        console.log('Ensuring directory structure exists...');
    }

    // Initialize
    createDirectoryStructure();
});
    // Document upload functionality
    const documentUploadForm = document.getElementById('documentUploadForm');
    const documentFile = document.getElementById('documentFile');
    const uploadDocumentButton = document.getElementById('uploadDocumentButton');
    const documentStatus = document.getElementById('documentStatus');
    const documentsContainer = document.getElementById('documentsContainer');
    
    if (documentUploadForm) {
        documentUploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!documentFile.files.length) {
                alert('Please select a document to upload.');
                return;
            }
            
            const voiceId = window.lastVoiceId;
            if (!voiceId) {
                alert('No agent ID found. Please create a voice clone first.');
                return;
            }
            
            // Show loading state
            uploadDocumentButton.disabled = true;
            documentStatus.style.display = 'block';
            
            try {
                // Create form data for API request
                const formData = new FormData();
                formData.append('document', documentFile.files[0]);
                formData.append('agent_id', voiceId);
                
                // Send request to upload document
                const response = await fetch('/upload-document', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // Show success message
                    alert(`Document uploaded successfully: ${documentFile.files[0].name}`);
                    
                    // Clear file input
                    documentFile.value = '';
                    
                    // Refresh documents list
                    loadDocuments(voiceId);
                } else {
                    // Show error
                    alert(`Error: ${data.error || 'Failed to upload document'}`);
                }
            } catch (error) {
                alert(`Error: ${error.message}`);
            } finally {
                // Reset UI
                uploadDocumentButton.disabled = false;
                documentStatus.style.display = 'none';
            }
        });
    }
    
    // Load documents for an agent
    async function loadDocuments(agentId) {
        if (!agentId) return;
        
        try {
            const response = await fetch(`/documents/${agentId}`);
            const data = await response.json();
            
            if (response.ok && data.documents) {
                displayDocuments(data.documents, agentId);
            } else {
                documentsContainer.innerHTML = '<p class="no-documents">No documents uploaded yet.</p>';
            }
        } catch (error) {
            console.error('Error loading documents:', error);
            documentsContainer.innerHTML = '<p class="error">Error loading documents.</p>';
        }
    }
    
    // Display documents in the UI
    function displayDocuments(documents, agentId) {
        if (!documentsContainer) return;
        
        if (documents.length === 0) {
            documentsContainer.innerHTML = '<p class="no-documents">No documents uploaded yet.</p>';
            return;
        }
        
        let html = '<ul class="documents-list">';
        
        documents.forEach(doc => {
            // Format file size
            const fileSize = formatFileSize(doc.file_size);
            
            // Format last modified date
            const lastModified = new Date(doc.last_modified * 1000).toLocaleString();
            
            html += `
                <li class="document-item">
                    <div class="document-info">
                        <span class="document-name">${doc.filename}</span>
                        <span class="document-meta">${fileSize} • ${lastModified}</span>
                    </div>
                    <button class="btn delete-btn" data-filename="${doc.filename}" data-agent="${agentId}">Delete</button>
                </li>
            `;
        });
        
        html += '</ul>';
        documentsContainer.innerHTML = html;
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', async () => {
                const filename = button.dataset.filename;
                const agentId = button.dataset.agent;
                
                if (confirm(`Are you sure you want to delete ${filename}?`)) {
                    try {
                        const response = await fetch(`/documents/${agentId}/${filename}`, {
                            method: 'DELETE'
                        });
                        
                        if (response.ok) {
                            // Refresh documents list
                            loadDocuments(agentId);
                        } else {
                            const data = await response.json();
                            alert(`Error: ${data.error || 'Failed to delete document'}`);
                        }
                    } catch (error) {
                        alert(`Error: ${error.message}`);
                    }
                }
            });
        });
    }
    
    // Format file size
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    
    // Copy share link
    if (copyLinkButton) {
        copyLinkButton.addEventListener('click', () => {
            shareLinkInput.select();
            document.execCommand('copy');
            copyLinkButton.textContent = 'Copied!';
            setTimeout(() => {
                copyLinkButton.textContent = 'Copy';
            }, 2000);
        });
    }
    
    // Load documents when agent is created
    document.addEventListener('agentCreated', (e) => {
        const agentId = e.detail.agentId;
        if (agentId) {
            loadDocuments(agentId);
        }
    });
