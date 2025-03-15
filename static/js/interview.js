/**
 * Interview System for AI Agent Profile Creation
 * Handles dynamic questioning to gather information about the user
 */
class InterviewSystem {
    constructor() {
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.responses = {};
        this.isInterviewComplete = false;
        
        // Elements
        this.questionContainer = document.getElementById('questionContainer');
        this.responseContainer = document.getElementById('responseContainer');
        this.userResponse = document.getElementById('userResponse');
        this.nextQuestionBtn = document.getElementById('nextQuestionBtn');
        this.finishInterviewBtn = document.getElementById('finishInterviewBtn');
        this.startInterviewBtn = document.getElementById('startInterviewBtn');
        this.interviewProgress = document.getElementById('interviewProgress');
        this.progressFill = document.getElementById('progressFill');
        this.currentQuestionNum = document.getElementById('currentQuestionNum');
        this.totalQuestions = document.getElementById('totalQuestions');
        this.interviewSummary = document.getElementById('interviewSummary');
        this.responseSummary = document.getElementById('responseSummary');
        
        // Bind event handlers
        this.startInterviewBtn.addEventListener('click', this.startInterview.bind(this));
        this.nextQuestionBtn.addEventListener('click', this.handleNextQuestion.bind(this));
        this.finishInterviewBtn.addEventListener('click', this.finishInterview.bind(this));
        
        // Initialize
        this.initialize();
    }
    
    async initialize() {
        // Hide progress initially
        this.interviewProgress.style.display = 'none';
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
            this.questionContainer.style.display = 'none';
            this.responseContainer.style.display = 'block';
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
        
        // Clear previous response
        this.userResponse.value = '';
        
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
        
        // Focus on response textarea
        this.userResponse.focus();
    }
    
    handleNextQuestion() {
        const response = this.userResponse.value.trim();
        
        if (!response) {
            alert('Please provide an answer before continuing.');
            return;
        }
        
        // Save response
        this.responses[this.currentQuestionIndex] = {
            question: this.questions[this.currentQuestionIndex],
            answer: response
        };
        
        // Move to next question
        this.showQuestion(this.currentQuestionIndex + 1);
    }
    
    async finishInterview() {
        // Save final response if there is one
        const response = this.userResponse.value.trim();
        if (response) {
            this.responses[this.currentQuestionIndex] = {
                question: this.questions[this.currentQuestionIndex],
                answer: response
            };
        }
        
        // Update progress to 100%
        this.currentQuestionNum.textContent = this.questions.length;
        this.progressFill.style.width = '100%';
        
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
        } catch (error) {
            console.error('Error saving interview responses:', error);
        }
    }
    
    generateSummary() {
        this.responseSummary.innerHTML = '';
        
        Object.values(this.responses).forEach(item => {
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
}

// Initialize interview system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('startInterviewBtn')) {
        window.interviewSystem = new InterviewSystem();
    }
});
