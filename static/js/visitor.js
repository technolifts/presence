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
        typingIndicator.innerHTML = '<p>Typing...</p>';
        messageContainer.appendChild(typingIndicator);
        
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
                const errorData = await response.json();
                addMessage(`Error: ${errorData.error || 'Something went wrong'}`, 'error');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            addMessage('Error: Could not connect to the server', 'error');
        }
        
        // Scroll to bottom
        messageContainer.scrollTop = messageContainer.scrollHeight;
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
        // This would be implemented with the Web Speech API
        alert('Voice input feature coming soon!');
    }
});
