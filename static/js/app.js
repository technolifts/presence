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
    const voiceCloneForm = document.getElementById('voiceCloneForm');
    const createVoiceButton = document.getElementById('createVoiceButton');
    const cloneStatus = document.getElementById('cloneStatus');
    const cloneResult = document.getElementById('cloneResult');
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
            
            // Get form data
            const voiceName = document.getElementById('voiceName').value;
            const voiceDescription = document.getElementById('voiceDescription').value;
            
            // Create form data for API request
            const formData = new FormData();
            formData.append('audio', audioBlob, `${voiceName}.mp3`);
            formData.append('name', voiceName);
            formData.append('description', voiceDescription || `Voice clone for ${voiceName}`);
            
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
                    resultVoiceName.textContent = voiceName;
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
