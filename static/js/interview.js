/**
 * Voice Interview System for AI Agent Profile Creation
 * Handles dynamic questioning to gather information about the user using voice recordings
 */
class VoiceInterviewSystem {
    constructor() {
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.responses = {};
        this.audioResponses = [];
        this.isInterviewComplete = false;
        this.combinedAudioBlob = null;
        
        // Elements
        this.questionContainer = document.getElementById('questionContainer');
        this.responseContainer = document.getElementById('responseContainer');
        this.nextQuestionBtn = document.getElementById('nextQuestionBtn');
        this.finishInterviewBtn = document.getElementById('finishInterviewBtn');
        this.startInterviewBtn = document.getElementById('startInterviewBtn');
        this.interviewProgress = document.getElementById('interviewProgress');
        this.progressFill = document.getElementById('progressFill');
        this.currentQuestionNum = document.getElementById('currentQuestionNum');
        this.totalQuestions = document.getElementById('totalQuestions');
        this.interviewSummary = document.getElementById('interviewSummary');
        this.responseSummary = document.getElementById('responseSummary');
        this.recordButton = document.getElementById('recordButton');
        this.visualizerCanvas = document.getElementById('visualizer');
        this.recordingTimer = document.getElementById('recordingTimer');
        this.audioPlayer = document.querySelector('.audio-player');
        this.recordedAudio = document.getElementById('recordedAudio');
        
        // Initialize recorder
        this.recorder = new AudioRecorder(this.visualizerCanvas);
        
        // Bind event handlers
        this.startInterviewBtn.addEventListener('click', this.startInterview.bind(this));
        this.nextQuestionBtn.addEventListener('click', this.handleNextQuestion.bind(this));
        this.finishInterviewBtn.addEventListener('click', this.finishInterview.bind(this));
        this.recordButton.addEventListener('click', this.toggleRecording.bind(this));
        
        // Initialize
        this.initialize();
    }
    
    async initialize() {
        // Hide progress initially
        this.interviewProgress.style.display = 'none';
        
        // Set canvas dimensions if it exists
        if (this.visualizerCanvas) {
            this.visualizerCanvas.width = this.visualizerCanvas.offsetWidth;
            this.visualizerCanvas.height = this.visualizerCanvas.offsetHeight;
        }
    }
    
    async toggleRecording() {
        if (this.recorder.isRecording) {
            // Stop recording
            this.recordButton.disabled = true;
            this.recordButton.textContent = 'Processing...';
            
            const responseBlob = await this.recorder.stop();
            
            // Save this response
            this.audioResponses.push(responseBlob);
            
            // Update UI
            this.recordButton.classList.remove('recording');
            this.recordButton.innerHTML = '<span class="record-icon"></span>Record Answer';
            this.recordButton.disabled = false;
            
            // Display the recorded audio for this response
            const audioURL = URL.createObjectURL(responseBlob);
            this.recordedAudio.src = audioURL;
            this.recordedAudio.controls = true;
            this.audioPlayer.style.display = 'block';
            
            // Enable next question button
            this.nextQuestionBtn.disabled = false;
            if (this.finishInterviewBtn) this.finishInterviewBtn.disabled = false;
        } else {
            // Start recording
            const started = await this.recorder.start();
            
            if (started) {
                // Update UI
                this.recordButton.classList.add('recording');
                this.recordButton.innerHTML = '<span class="record-icon"></span>Stop Recording';
                this.audioPlayer.style.display = 'none';
                
                // Disable next question button while recording
                this.nextQuestionBtn.disabled = true;
                if (this.finishInterviewBtn) this.finishInterviewBtn.disabled = true;
            } else {
                alert('Could not access microphone. Please ensure you have granted permission.');
            }
        }
    }
    
    async startInterview() {
        try {
            // Show loading state
            this.startInterviewBtn.disabled = true;
            this.startInterviewBtn.textContent = 'Loading questions...';
            
            // Fetch questions from the server
            const response = await fetch('/generate-interview-questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to generate interview questions');
            }
            
            const data = await response.json();
            this.questions = data.questions;
            
            // Update UI
            this.totalQuestions.textContent = this.questions.length;
            this.interviewProgress.style.display = 'block';
            
            // Show first question
            this.showQuestion(0);
            
            // Hide start button, show response container
            if (this.startInterviewBtn && this.startInterviewBtn.parentElement) {
                this.startInterviewBtn.parentElement.style.display = 'none';
            }
            if (this.responseContainer) {
                this.responseContainer.style.display = 'block';
            }
        } catch (error) {
            console.error('Error starting interview:', error);
            alert('Error starting interview. Please try again.');
            
            // Reset button
            this.startInterviewBtn.disabled = false;
            this.startInterviewBtn.textContent = 'Start Interview';
        }
    }
    
    showQuestion(index) {
        if (index >= this.questions.length) {
            this.finishInterview();
            return;
        }
        
        // Update question text
        const questionText = this.questions[index];
        this.questionContainer.innerHTML = `<p class="question-text">${questionText}</p>`;
        this.questionContainer.style.display = 'block';
        
        // Update progress
        this.currentQuestionIndex = index;
        this.currentQuestionNum.textContent = index + 1;
        this.progressFill.style.width = `${((index + 1) / this.questions.length) * 100}%`;
        
        // Show finish button on last question
        if (index === this.questions.length - 1) {
            this.nextQuestionBtn.style.display = 'none';
            this.finishInterviewBtn.style.display = 'inline-flex';
        } else {
            this.nextQuestionBtn.style.display = 'inline-flex';
            this.finishInterviewBtn.style.display = 'none';
        }
    }
    
    handleNextQuestion() {
        if (this.audioResponses.length <= this.currentQuestionIndex) {
            alert('Please record an answer before continuing.');
            return;
        }
        
        // Save response
        this.responses[this.currentQuestionIndex] = {
            question: this.questions[this.currentQuestionIndex],
            answer: `[Voice recording ${this.currentQuestionIndex + 1}]`
        };
        
        // Move to next question
        this.showQuestion(this.currentQuestionIndex + 1);
    }
    
    async finishInterview() {
        // Save final response if there is one
        if (this.audioResponses.length > this.currentQuestionIndex) {
            this.responses[this.currentQuestionIndex] = {
                question: this.questions[this.currentQuestionIndex],
                answer: `[Voice recording ${this.currentQuestionIndex + 1}]`
            };
        } else {
            alert('Please record an answer before finishing.');
            return;
        }
        
        // Update progress to 100%
        this.currentQuestionNum.textContent = this.questions.length;
        this.progressFill.style.width = '100%';
        
        // Combine all audio recordings
        await this.combineAudioRecordings();
        
        // Hide question and response containers
        this.questionContainer.style.display = 'none';
        this.responseContainer.style.display = 'none';
        
        // Show summary
        this.generateSummary();
        this.interviewSummary.style.display = 'block';
        
        // Mark interview as complete
        this.isInterviewComplete = true;
        
        // Save responses to server
        try {
            await fetch('/save-interview-responses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    responses: Object.values(this.responses)
                })
            });
            
            // Notify parent that we have a combined audio blob
            if (this.combinedAudioBlob) {
                document.dispatchEvent(new CustomEvent('interviewComplete', {
                    detail: {
                        audioBlob: this.combinedAudioBlob,
                        responses: Object.values(this.responses)
                    }
                }));
            }
        } catch (error) {
            console.error('Error saving interview responses:', error);
        }
    }
    
    async combineAudioRecordings() {
        if (this.audioResponses.length === 0) {
            console.error('No recordings to combine');
            return;
        }
        
        try {
            // Create a combined audio context
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffers = [];
            
            // Load all audio blobs into audio buffers
            for (const blob of this.audioResponses) {
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
            this.combinedAudioBlob = await this.bufferToWave(renderedBuffer, renderedBuffer.length);
            
            // Display the combined audio
            const audioURL = URL.createObjectURL(this.combinedAudioBlob);
            this.recordedAudio.src = audioURL;
            this.audioPlayer.style.display = 'block';
            
            return this.combinedAudioBlob;
        } catch (error) {
            console.error('Error combining audio:', error);
            alert('Error combining audio recordings. Please try again.');
        }
    }
    
    // Convert AudioBuffer to WAV Blob
    bufferToWave(abuffer, len) {
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
            if (offset >= channels[0].length) break;
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
    
    generateSummary() {
        this.responseSummary.innerHTML = '';
        
        Object.values(this.responses).forEach((item, index) => {
            const responseItem = document.createElement('div');
            responseItem.className = 'response-item';
            responseItem.innerHTML = `
                <div class="response-question">${item.question}</div>
                <div class="response-answer">${item.answer}</div>
            `;
            this.responseSummary.appendChild(responseItem);
        });
    }
    
    getResponses() {
        return Object.values(this.responses);
    }
    
    getAudioBlob() {
        return this.combinedAudioBlob;
    }
}

// Initialize interview system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('startInterviewBtn')) {
        window.interviewSystem = new VoiceInterviewSystem();
    }
});
