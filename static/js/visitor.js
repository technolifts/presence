document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const agentList = document.getElementById('agentList');
    const conversationSection = document.querySelector('.conversation-section');
    const currentAgentName = document.getElementById('currentAgentName');
    const messageContainer = document.getElementById('messageContainer');
    const userMessage = document.getElementById('userMessage');
    const sendButton = document.getElementById('sendButton');
    const micButton = document.getElementById('micButton');
    
    // State
    let selectedAgentId = null;
    let selectedAgentName = null;
    
    // Load available agents
    loadAgents();
    
    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    userMessage.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    micButton.addEventListener('click', toggleVoiceInput);
    
    // Functions
    async function loadAgents() {
        try {
            const response = await fetch('/agents');
            const data = await response.json();
            
            if (data.agents && data.agents.length > 0) {
                displayAgents(data.agents);
            } else {
                agentList.innerHTML = '<p class="no-agents">No agents available yet. <a href="/">Create one now!</a></p>';
            }
        } catch (error) {
            console.error('Error loading agents:', error);
            agentList.innerHTML = '<p class="error">Error loading agents. Please try again later.</p>';
        }
    }
    
    function displayAgents(agents) {
        agentList.innerHTML = '';
        
        agents.forEach(agent => {
            const agentCard = document.createElement('div');
            agentCard.className = 'agent-card';
            agentCard.innerHTML = `
                <h3>${agent.name}</h3>
                <p class="agent-title">${agent.title || ''}</p>
                <p class="agent-bio">${agent.bio || 'No bio available'}</p>
                <button class="btn secondary-btn select-agent" data-id="${agent.voice_id}" data-name="${agent.name}">
                    Talk to ${agent.name}
                </button>
            `;
            
            agentList.appendChild(agentCard);
            
            // Add event listener to the button
            const selectButton = agentCard.querySelector('.select-agent');
            selectButton.addEventListener('click', () => {
                selectAgent(agent.voice_id, agent.name);
            });
        });
    }
    
    function selectAgent(agentId, agentName) {
        selectedAgentId = agentId;
        selectedAgentName = agentName;
        
        // Update UI
        currentAgentName.textContent = agentName;
        conversationSection.style.display = 'block';
        
        // Scroll to conversation section
        conversationSection.scrollIntoView({ behavior: 'smooth' });
        
        // Clear previous messages and add initial greeting
        messageContainer.innerHTML = `
            <div class="message agent">
                <p>Hello! I'm ${agentName}. How can I help you today?</p>
            </div>
        `;
    }
    
    async function sendMessage() {
        const message = userMessage.value.trim();
        if (!message || !selectedAgentId) return;
        
        // Add user message to the conversation
        addMessage(message, 'user');
        
        // Clear input
        userMessage.value = '';
        
        // Show typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'message agent typing';
        typingIndicator.innerHTML = '<p>Thinking...</p>';
        messageContainer.appendChild(typingIndicator);
        
        // Disable send button during processing
        sendButton.disabled = true;
        
        // Scroll to bottom
        messageContainer.scrollTop = messageContainer.scrollHeight;
        
        try {
            // Send message to the server
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    agent_id: selectedAgentId
                })
            });
            
            // Remove typing indicator
            messageContainer.removeChild(typingIndicator);
            
            if (response.ok) {
                const audioBlob = await response.blob();
                
                // Create a placeholder for the agent's response
                const responseMessage = document.createElement('div');
                responseMessage.className = 'message agent';
                responseMessage.innerHTML = '<p>Response loading...</p>';
                messageContainer.appendChild(responseMessage);
                
                // Create audio element
                const audio = new Audio(URL.createObjectURL(audioBlob));
                
                // Add audio to the message
                const audioElement = document.createElement('audio');
                audioElement.controls = true;
                audioElement.src = URL.createObjectURL(audioBlob);
                responseMessage.appendChild(audioElement);
                
                // Add event listener for when audio starts playing
                audio.addEventListener('play', () => {
                    responseMessage.classList.add('playing');
                });
                
                // Add event listener for when audio ends
                audio.addEventListener('ended', () => {
                    responseMessage.classList.remove('playing');
                });
                
                // Play audio
                audio.play();
                
                // Get the text transcript (if available)
                try {
                    const textResponse = await fetch('/last-response-text');
                    if (textResponse.ok) {
                        const textData = await textResponse.json();
                        responseMessage.querySelector('p').textContent = textData.text;
                    }
                } catch (error) {
                    console.error('Error getting response text:', error);
                }
            } else {
                let errorMessage = 'Something went wrong';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // If response is not JSON
                    errorMessage = `Error: ${response.status} ${response.statusText}`;
                }
                addMessage(`Error: ${errorMessage}`, 'error');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            addMessage('Error: Could not connect to the server', 'error');
        } finally {
            // Re-enable send button
            sendButton.disabled = false;
            
            // Scroll to bottom
            messageContainer.scrollTop = messageContainer.scrollHeight;
        }
    }
    
    function addMessage(text, type) {
        const message = document.createElement('div');
        message.className = `message ${type}`;
        message.innerHTML = `<p>${text}</p>`;
        messageContainer.appendChild(message);
        
        // Scroll to bottom
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
    
    function toggleVoiceInput() {
        // Check if browser supports speech recognition
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Your browser does not support speech recognition. Try using Chrome or Edge.');
            return;
        }
        
        // Create speech recognition object
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        // Configure
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        // UI updates
        micButton.classList.add('recording');
        micButton.innerHTML = '<span class="mic-icon"></span> Listening...';
        
        // Create or get input placeholder
        let voiceInputPlaceholder = document.getElementById('voiceInputPlaceholder');
        if (!voiceInputPlaceholder) {
            voiceInputPlaceholder = document.createElement('div');
            voiceInputPlaceholder.id = 'voiceInputPlaceholder';
            voiceInputPlaceholder.className = 'voice-input-placeholder';
            voiceInputPlaceholder.textContent = 'Listening...';
            document.querySelector('.input-container').insertBefore(voiceInputPlaceholder, userMessage);
        } else {
            voiceInputPlaceholder.style.display = 'block';
            voiceInputPlaceholder.textContent = 'Listening...';
        }
        
        // Start listening
        recognition.start();
        
        // Results handler
        let finalTranscript = '';
        recognition.onresult = (event) => {
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            // Update placeholder with interim results
            voiceInputPlaceholder.textContent = interimTranscript || 'Listening...';
        };
        
        // End handler
        recognition.onend = () => {
            // Reset UI
            micButton.classList.remove('recording');
            micButton.innerHTML = '<span class="mic-icon"></span>';
            
            // Hide placeholder
            if (voiceInputPlaceholder) {
                voiceInputPlaceholder.style.display = 'none';
            }
            
            // If we got a final transcript, add it to the input
            if (finalTranscript) {
                userMessage.value = finalTranscript;
                userMessage.focus();
            }
        };
        
        // Error handler
        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            
            // Reset UI
            micButton.classList.remove('recording');
            micButton.innerHTML = '<span class="mic-icon"></span>';
            
            // Hide placeholder
            if (voiceInputPlaceholder) {
                voiceInputPlaceholder.style.display = 'none';
            }
            
            // Show error
            if (event.error === 'no-speech') {
                alert('No speech was detected. Please try again.');
            } else {
                alert(`Error occurred in recognition: ${event.error}`);
            }
        };
    }
});
