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
