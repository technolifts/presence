/**
 * Audio recorder with visualization
 * Handles recording audio from the microphone and visualizing the audio waveform
 */
class AudioRecorder {
    constructor(visualizerCanvas) {
        this.audioContext = null;
        this.stream = null;
        this.recorder = null;
        this.analyser = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.startTime = null;
        this.timerInterval = null;
        this.visualizerCanvas = visualizerCanvas;
        this.canvasContext = visualizerCanvas ? visualizerCanvas.getContext('2d') : null;
        this.animationFrame = null;
    }

    async start() {
        if (this.isRecording) return;

        try {
            // Request microphone access
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create media stream source
            const source = this.audioContext.createMediaStreamSource(this.stream);
            
            // Create analyser for visualization
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);
            
            // Create media recorder
            this.recorder = new MediaRecorder(this.stream);
            
            // Event handler for data available
            this.recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            // Start recording
            this.audioChunks = [];
            this.recorder.start();
            this.isRecording = true;
            this.startTime = Date.now();
            
            // Start timer
            this.startTimer();
            
            // Start visualization if canvas is available
            if (this.canvasContext) {
                this.visualize();
            }
            
            return true;
        } catch (error) {
            console.error('Error starting recording:', error);
            return false;
        }
    }

    stop() {
        if (!this.isRecording) return Promise.resolve(null);
        
        return new Promise((resolve) => {
            this.recorder.onstop = () => {
                // Create blob from audio chunks
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/mp3' });
                
                // Stop timer
                this.stopTimer();
                
                // Stop visualization
                if (this.animationFrame) {
                    cancelAnimationFrame(this.animationFrame);
                    this.animationFrame = null;
                }
                
                // Stop and clean up
                this.isRecording = false;
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
                this.recorder = null;
                
                if (this.audioContext) {
                    this.audioContext.close();
                    this.audioContext = null;
                }
                
                resolve(audioBlob);
            };
            
            this.recorder.stop();
        });
    }

    startTimer() {
        const updateTimer = (timerElement) => {
            if (!this.startTime || !timerElement) return;
            
            const elapsed = Date.now() - this.startTime;
            const seconds = Math.floor((elapsed / 1000) % 60).toString().padStart(2, '0');
            const minutes = Math.floor((elapsed / 1000 / 60) % 60).toString().padStart(2, '0');
            
            timerElement.textContent = `${minutes}:${seconds}`;
        };
        
        const timerElement = document.getElementById('recordingTimer');
        if (timerElement) {
            this.timerInterval = setInterval(() => updateTimer(timerElement), 1000);
            updateTimer(timerElement);
        }
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    visualize() {
        if (!this.analyser || !this.canvasContext) return;
        
        const width = this.visualizerCanvas.width;
        const height = this.visualizerCanvas.height;
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        this.canvasContext.clearRect(0, 0, width, height);
        
        const draw = () => {
            this.animationFrame = requestAnimationFrame(draw);
            
            this.analyser.getByteFrequencyData(dataArray);
            
            this.canvasContext.fillStyle = '#f5f5f5';
            this.canvasContext.fillRect(0, 0, width, height);
            
            const barWidth = (width / bufferLength) * 2.5;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * height;
                
                this.canvasContext.fillStyle = `rgb(${dataArray[i]}, 102, 255)`;
                this.canvasContext.fillRect(x, height - barHeight, barWidth, barHeight);
                
                x += barWidth + 1;
            }
        };
        
        draw();
    }

    getRecordingDuration() {
        if (!this.startTime) return 0;
        return (Date.now() - this.startTime) / 1000;
    }
}
