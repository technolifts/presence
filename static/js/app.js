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
    const questionContainer = document.getElementById('questionContainer');
    const questionText = document.getElementById('questionText');
    const nextQuestionBtn = document.getElementById('nextQuestionBtn');
    const finishRecordingBtn = document.getElementById('finishRecordingBtn');

    // Set canvas dimensions
    if (visualizerCanvas) {
        visualizerCanvas.width = visualizerCanvas.offsetWidth;
        visualizerCanvas.height = visualizerCanvas.offsetHeight;
    }

    // Initialize recorder
    const recorder = new AudioRecorder(visualizerCanvas);
    let audioBlob = null;
    
    // Interview questions
    const questions = [
        "Please introduce yourself and tell us your name.",
        "What's your professional background or expertise?",
        "What topics are you knowledgeable about?",
        "How would you describe your communication style?",
        "What kind of personality would you like your AI voice to have?"
    ];
    let currentQuestionIndex = 0;
    const recordedResponses = [];
    
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

    // Show the first question
    function showQuestion(index) {
        if (index >= questions.length) {
            // All questions answered, combine audio and finish
            combineAudioAndFinish();
            return;
        }
        
        // Update question text
        if (questionText) {
            questionText.textContent = questions[index];
        }
        
        // Show question container
        if (questionContainer) {
            questionContainer.style.display = 'block';
        }
        
        // Update buttons visibility
        if (index === questions.length - 1) {
            if (nextQuestionBtn) nextQuestionBtn.style.display = 'none';
            if (finishRecordingBtn) finishRecordingBtn.style.display = 'inline-flex';
        } else {
            if (nextQuestionBtn) nextQuestionBtn.style.display = 'inline-flex';
            if (finishRecordingBtn) finishRecordingBtn.style.display = 'none';
        }
        
        currentQuestionIndex = index;
    }
    
    // Combine all recorded responses into a single audio file
    async function combineAudioAndFinish() {
        if (recordedResponses.length === 0) {
            alert('No recordings found. Please record your voice first.');
            return;
        }
        
        try {
            // Create a combined audio context
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffers = [];
            
            // Load all audio blobs into audio buffers
            for (const blob of recordedResponses) {
                const arrayBuffer = await blob.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                audioBuffers.push(audioBuffer);
            }
            
            // Calculate total duration
            const totalDuration = audioBuffers.reduce((acc, buffer) => acc + buffer.duration, 0);
            
            // Create a combined buffer
            const combinedBuffer = audioContext.createBuffer(
                1, // mono
                audioContext.sampleRate * totalDuration,
                audioContext.sampleRate
            );
            
            // Copy each buffer into the combined buffer
            let offset = 0;
            for (const buffer of audioBuffers) {
                const channelData = buffer.getChannelData(0);
                combinedBuffer.getChannelData(0).set(channelData, offset);
                offset += buffer.length;
            }
            
            // Convert the combined buffer to a WAV blob
            const offlineContext = new OfflineAudioContext(
                1, combinedBuffer.length, combinedBuffer.sampleRate
            );
            
            const source = offlineContext.createBufferSource();
            source.buffer = combinedBuffer;
            source.connect(offlineContext.destination);
            source.start(0);
            
            const renderedBuffer = await offlineContext.startRendering();
            
            // Convert to WAV
            const wavBlob = await bufferToWave(renderedBuffer, renderedBuffer.length);
            
            // Set as the final audio blob
            audioBlob = wavBlob;
            
            // Display the combined audio
            const audioURL = URL.createObjectURL(audioBlob);
            recordedAudio.src = audioURL;
            audioPlayer.style.display = 'block';
            
            // Hide question container
            if (questionContainer) {
                questionContainer.style.display = 'none';
            }
            
            // Enable the create voice button
            createVoiceButton.disabled = false;
            
            // Update profile fields from responses if they're empty
            if (recordedResponses.length > 0 && profileName.value === '') {
                // Try to extract name from first response
                const nameMatch = questions[0].includes('name');
                if (nameMatch) {
                    profileName.value = 'Voice User'; // Default name
                }
            }
            
        } catch (error) {
            console.error('Error combining audio:', error);
            alert('Error combining audio recordings. Please try again.');
        }
    }
    
    // Convert AudioBuffer to WAV Blob
    function bufferToWave(abuffer, len) {
        const numOfChan = abuffer.numberOfChannels;
        const length = len * numOfChan * 2 + 44;
        const buffer = new ArrayBuffer(length);
        const view = new DataView(buffer);
        const channels = [];
        let i;
        let sample;
        let offset = 0;
        let pos = 0;
        
        // Write WAVE header
        setUint32(0x46464952);                         // "RIFF"
        setUint32(length - 8);                         // file length - 8
        setUint32(0x45564157);                         // "WAVE"
        
        setUint32(0x20746d66);                         // "fmt " chunk
        setUint32(16);                                 // length = 16
        setUint16(1);                                  // PCM (uncompressed)
        setUint16(numOfChan);
        setUint32(abuffer.sampleRate);
        setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
        setUint16(numOfChan * 2);                      // block-align
        setUint16(16);                                 // 16-bit
        
        setUint32(0x61746164);                         // "data" chunk
        setUint32(length - pos - 4);                   // chunk length
        
        // Write interleaved data
        for (i = 0; i < abuffer.numberOfChannels; i++) {
            channels.push(abuffer.getChannelData(i));
        }
        
        while (pos < length) {
            for (i = 0; i < numOfChan; i++) {
                // Clamp the value to the 16-bit range
                sample = Math.max(-1, Math.min(1, channels[i][offset]));
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
                view.setInt16(pos, sample, true); // 'true' -> means little endian
                pos += 2;
            }
            offset++;
        }
        
        function setUint16(data) {
            view.setUint16(pos, data, true);
            pos += 2;
        }
        
        function setUint32(data) {
            view.setUint32(pos, data, true);
            pos += 4;
        }
        
        return new Blob([buffer], { type: 'audio/wav' });
    }
    
    // Recording functionality
    if (recordButton) {
        recordButton.addEventListener('click', async () => {
            if (recorder.isRecording) {
                // Stop recording
                recordButton.disabled = true;
                recordButton.textContent = 'Processing...';
                
                const responseBlob = await recorder.stop();
                
                // Save this response
                recordedResponses.push(responseBlob);
                
                // Update UI
                recordButton.classList.remove('recording');
                recordButton.innerHTML = '<span class="record-icon"></span>Record Answer';
                recordButton.disabled = false;
                
                // Display the recorded audio for this response
                const audioURL = URL.createObjectURL(responseBlob);
                recordedAudio.src = audioURL;
                audioPlayer.style.display = 'block';
                
                // Enable next question button
                if (nextQuestionBtn) nextQuestionBtn.disabled = false;
                if (finishRecordingBtn) finishRecordingBtn.disabled = false;
            } else {
                // Start recording
                const started = await recorder.start();
                
                if (started) {
                    // Update UI
                    recordButton.classList.add('recording');
                    recordButton.innerHTML = '<span class="record-icon"></span>Stop Recording';
                    audioPlayer.style.display = 'none';
                    
                    // Disable next question button while recording
                    if (nextQuestionBtn) nextQuestionBtn.disabled = true;
                    if (finishRecordingBtn) finishRecordingBtn.disabled = true;
                } else {
                    alert('Could not access microphone. Please ensure you have granted permission.');
                }
            }
        });
    }
    
    // Next question button
    if (nextQuestionBtn) {
        nextQuestionBtn.addEventListener('click', () => {
            showQuestion(currentQuestionIndex + 1);
        });
    }
    
    // Finish recording button
    if (finishRecordingBtn) {
        finishRecordingBtn.addEventListener('click', () => {
            combineAudioAndFinish();
        });
    }
    
    // Initialize with first question
    showQuestion(0);

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
            
            // Create interview data from our questions and recordings
            const interviewData = [];
            for (let i = 0; i < questions.length && i < recordedResponses.length; i++) {
                interviewData.push({
                    question: questions[i],
                    answer: `[Voice recording ${i+1}]`
                });
            }
            formData.append('interview_data', JSON.stringify(interviewData));
        
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
                    
                    // Upload any pending documents
                    if (window.pendingDocuments && window.pendingDocuments.length > 0) {
                        uploadPendingDocuments(data.voice_id);
                    }
                    
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
    
    // Store uploaded documents before agent creation
    window.pendingDocuments = [];
    
    if (documentUploadForm) {
        documentUploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!documentFile.files.length) {
                alert('Please select a document to upload.');
                return;
            }
            
            const voiceId = window.lastVoiceId;
            
            // If no agent ID yet, upload to temporary storage
            if (!voiceId) {
                // Show loading state
                uploadDocumentButton.disabled = true;
                documentStatus.style.display = 'block';
                documentStatus.innerHTML = `<div class="loader"></div><p>Uploading document...</p>`;
                
                try {
                    // Create form data for API request
                    const formData = new FormData();
                    formData.append('document', documentFile.files[0]);
                    formData.append('temp_storage', 'true'); // Flag for temporary storage
                    
                    // Send request to upload document to temporary storage
                    const response = await fetch('/upload-temp-document', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        // Store file info for later association
                        const file = documentFile.files[0];
                        window.pendingDocuments.push({
                            file: file,
                            temp_id: data.temp_id
                        });
                        
                        // Show success message
                        documentStatus.innerHTML = `<p>Document uploaded successfully: ${file.name}</p>`;
                        setTimeout(() => {
                            documentStatus.style.display = 'none';
                        }, 3000);
                        
                        // Show in the documents list
                        displayPendingDocuments();
                        
                        // Clear file input
                        documentFile.value = '';
                    } else {
                        // Show error
                        alert(`Error: ${data.error || 'Failed to upload document'}`);
                        documentStatus.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Error uploading document:', error);
                    alert(`Error: ${error.message}`);
                    documentStatus.style.display = 'none';
                } finally {
                    // Reset UI
                    uploadDocumentButton.disabled = false;
                }
                
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
    
    // Display pending documents before agent creation
    function displayPendingDocuments() {
        if (!documentsContainer) return;
        
        if (window.pendingDocuments.length === 0) {
            documentsContainer.innerHTML = '<p class="no-documents">No documents uploaded yet.</p>';
            return;
        }
        
        let html = '<ul class="documents-list"><li class="pending-notice">Documents will be associated with your agent after creation</li>';
        
        window.pendingDocuments.forEach((docInfo, index) => {
            const doc = docInfo.file || docInfo;
            // Format file size
            const fileSize = formatFileSize(doc.size);
            
            html += `
                <li class="document-item pending">
                    <div class="document-info">
                        <span class="document-name">${doc.name}</span>
                        <span class="document-meta">${fileSize} • ${docInfo.temp_id ? 'Uploaded' : 'Pending'}</span>
                    </div>
                    <button class="btn delete-btn" data-index="${index}">Remove</button>
                </li>
            `;
        });
        
        html += '</ul>';
        documentsContainer.innerHTML = html;
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-btn[data-index]').forEach(button => {
            button.addEventListener('click', () => {
                const index = parseInt(button.dataset.index);
                window.pendingDocuments.splice(index, 1);
                displayPendingDocuments();
            });
        });
    }
    
    // Display documents in the UI
    function displayDocuments(documents, agentId) {
        if (!documentsContainer) return;
        
        if (documents.length === 0 && (!window.pendingDocuments || window.pendingDocuments.length === 0)) {
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
    
    // Upload pending documents after agent creation
    async function uploadPendingDocuments(agentId) {
        if (!window.pendingDocuments || window.pendingDocuments.length === 0) return;
        
        const totalDocs = window.pendingDocuments.length;
        let uploadedCount = 0;
        let failedCount = 0;
        
        // Show status
        documentStatus.style.display = 'block';
        documentStatus.innerHTML = `<div class="loader"></div><p>Associating ${totalDocs} document(s) with agent...</p>`;
        
        // Process each document
        for (const docInfo of window.pendingDocuments) {
            try {
                console.log(`Associating document with agent: ${agentId}`);
                
                // Create form data for API request
                const formData = new FormData();
                if (docInfo.temp_id) {
                    // If we have a temp_id, use that to associate the already uploaded document
                    formData.append('temp_id', docInfo.temp_id);
                    formData.append('agent_id', agentId);
                    
                    // Send request to associate document
                    const response = await fetch('/associate-document', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const responseData = await response.json();
                    
                    if (response.ok) {
                        console.log(`Successfully associated document: ${docInfo.file.name}`, responseData);
                        uploadedCount++;
                    } else {
                        failedCount++;
                        console.error(`Failed to associate document: ${docInfo.file.name}`, responseData);
                        alert(`Failed to associate document: ${docInfo.file.name} - ${responseData.error || 'Unknown error'}`);
                    }
                } else {
                    // Fall back to the old method if no temp_id
                    formData.append('document', docInfo.file || docInfo);
                    formData.append('agent_id', agentId);
                    
                    // Send request to upload document
                    const response = await fetch('/upload-document', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const responseData = await response.json();
                    
                    if (response.ok) {
                        console.log(`Successfully uploaded document: ${docInfo.file ? docInfo.file.name : docInfo.name}`, responseData);
                        uploadedCount++;
                    } else {
                        failedCount++;
                        console.error(`Failed to upload document: ${docInfo.file ? docInfo.file.name : docInfo.name}`, responseData);
                        alert(`Failed to upload document: ${docInfo.file ? docInfo.file.name : docInfo.name} - ${responseData.error || 'Unknown error'}`);
                    }
                }
            } catch (error) {
                failedCount++;
                const fileName = docInfo.file ? docInfo.file.name : (docInfo.name || 'Unknown file');
                console.error(`Error processing document: ${fileName}`, error);
                alert(`Error processing document: ${fileName} - ${error.message}`);
            }
        }
        
        // Clear pending documents
        window.pendingDocuments = [];
        
        // Update status
        if (failedCount > 0) {
            documentStatus.innerHTML = `<p>Uploaded ${uploadedCount} document(s). ${failedCount} failed.</p>`;
            setTimeout(() => {
                documentStatus.style.display = 'none';
            }, 3000);
        } else {
            documentStatus.innerHTML = `<p>Successfully uploaded ${uploadedCount} document(s)!</p>`;
            setTimeout(() => {
                documentStatus.style.display = 'none';
            }, 3000);
        }
        
        // Refresh documents list
        loadDocuments(agentId);
    }
    
    // Load documents when agent is created
    document.addEventListener('agentCreated', (e) => {
        const agentId = e.detail.agentId;
        if (agentId) {
            loadDocuments(agentId);
        }
    });
