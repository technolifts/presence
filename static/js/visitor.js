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
        
        // Clear previous messages
        messageContainer.innerHTML = '';
        
        // Send an initial greeting request to get a personalized greeting from the AI
        sendInitialGreeting(agentId, agentName);
    }
    
    async function sendInitialGreeting(agentId, agentName) {
        // Show typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'message agent typing';
        typingIndicator.innerHTML = '<p>Thinking...</p>';
        messageContainer.appendChild(typingIndicator);
        
        try {
            // Create a message element for the streaming response
            const responseMessage = document.createElement('div');
            responseMessage.className = 'message agent';
            responseMessage.innerHTML = '<p></p><div class="typing-indicator"><span></span><span></span><span></span></div>';
            
            // Start the stream
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: "Please introduce yourself briefly",
                    agent_id: agentId,
                    streaming: true
                })
            });
            
            if (response.ok && response.headers.get('Content-Type').includes('text/event-stream')) {
                // Replace typing indicator with the actual message element
                messageContainer.replaceChild(responseMessage, typingIndicator);
                
                const responseParagraph = responseMessage.querySelector('p');
                let fullResponse = '';
                
                // Create a reader for the stream
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                
                // Process the stream
                let buffer = '';
                                
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                                    
                    // Decode the chunk and add to buffer
                    buffer += decoder.decode(value, { stream: true });
                                    
                    console.log("Received buffer:", buffer.length > 100 ? buffer.substring(0, 100) + "..." : buffer); // Debug log
                                    
                    // Process complete events in the buffer
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || ''; // Keep the last incomplete chunk in the buffer
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const dataStr = line.substring(6);
                                console.log("Data string:", dataStr); // Debug log
                                
                                const data = JSON.parse(dataStr);
                                console.log("Parsed data:", data); // Debug log
                                
                                // If this is a text chunk, add it to the response
                                if (data.chunk) {
                                    // Hide typing indicator on first chunk
                                    if (fullResponse === '') {
                                        const typingIndicator = responseMessage.querySelector('.typing-indicator');
                                        if (typingIndicator) {
                                            typingIndicator.style.display = 'none';
                                        }
                                    }
                                    
                                    fullResponse += data.chunk;
                                    responseParagraph.textContent = fullResponse;
                                    
                                    // Add visual streaming effect
                                    responseMessage.classList.add('streaming');
                                    
                                    // Scroll to bottom
                                    messageContainer.scrollTop = messageContainer.scrollHeight;
                                }
                                
                                // If this is the end of the stream, play the audio
                                if (data.done) {
                                    console.log("Stream complete, full response:", fullResponse); // Debug log
                                    
                                    // Remove streaming effect
                                    responseMessage.classList.remove('streaming');
                                    
                                    // Check if we have a valid response
                                    if (fullResponse && fullResponse.trim()) {
                                        // Check if the response is the fallback error message
                                        if (fullResponse.trim() === "I'm sorry, I couldn't generate a response at this time. Please try again.") {
                                            // Don't try to play audio for the fallback message
                                            console.log("Received fallback error message, not playing audio");
                                            responseParagraph.textContent = fullResponse;
                                        } else {
                                            // Play the audio response for normal responses
                                            playAudioResponse(fullResponse, agentId, responseMessage);
                                        }
                                    } else {
                                        // Handle empty response
                                        responseParagraph.textContent = "I'm sorry, I couldn't generate a response. Please try again.";
                                    }
                                }
                            } catch (e) {
                                console.error('Error parsing event data:', e, 'Raw data:', line.substring(6));
                            }
                        }
                    }
                }
            } else if (response.ok) {
                // Fallback to non-streaming response
                messageContainer.removeChild(typingIndicator);
                
                try {
                    // Try to parse as JSON first (new format)
                    const jsonResponse = await response.json();
                    console.log("Received JSON response:", jsonResponse);
                    
                    if (jsonResponse.text) {
                        // Display the text response
                        responseMessage.innerHTML = `<p>${jsonResponse.text}</p>`;
                        messageContainer.appendChild(responseMessage);
                        
                        // Play the audio response
                        playAudioResponse(jsonResponse.text, agentId, responseMessage);
                    } else {
                        throw new Error("No text in response");
                    }
                } catch (jsonError) {
                    console.error("Error parsing JSON response:", jsonError);
                    
                    // Fallback to audio blob (old format)
                    try {
                        // Reset the response to get the blob
                        const blobResponse = await fetch('/chat', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                message: "Please introduce yourself briefly",
                                agent_id: agentId,
                                streaming: false
                            })
                        });
                        
                        const audioBlob = await blobResponse.blob();
                        
                        // Create a placeholder for the agent's response
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
                    } catch (blobError) {
                        console.error("Error getting blob response:", blobError);
                        responseMessage.innerHTML = '<p>Error loading response</p>';
                        messageContainer.appendChild(responseMessage);
                    }
                }
            } else {
                // Remove typing indicator
                messageContainer.removeChild(typingIndicator);
                
                // If there's an error, just show a default greeting
                const defaultGreeting = document.createElement('div');
                defaultGreeting.className = 'message agent';
                defaultGreeting.innerHTML = `<p>Hello! I'm ${agentName}. How can I help you today?</p>`;
                messageContainer.appendChild(defaultGreeting);
            }
        } catch (error) {
            console.error('Error sending initial greeting:', error);
            
            // Remove typing indicator if it still exists
            const typingIndicators = messageContainer.querySelectorAll('.typing');
            typingIndicators.forEach(indicator => messageContainer.removeChild(indicator));
            
            // Show default greeting on error
            const defaultGreeting = document.createElement('div');
            defaultGreeting.className = 'message agent';
            defaultGreeting.innerHTML = `<p>Hello! I'm ${agentName}. How can I help you today?</p>`;
            messageContainer.appendChild(defaultGreeting);
        }
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
            // Create a message element for the streaming response
            const responseMessage = document.createElement('div');
            responseMessage.className = 'message agent';
            responseMessage.innerHTML = '<p></p><div class="typing-indicator"><span></span><span></span><span></span></div>';
            
            // Start the stream
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    agent_id: selectedAgentId,
                    streaming: true
                })
            });
            
            if (response.ok && response.headers.get('Content-Type').includes('text/event-stream')) {
                // Replace typing indicator with the actual message element
                messageContainer.replaceChild(responseMessage, typingIndicator);
                
                const responseParagraph = responseMessage.querySelector('p');
                let fullResponse = '';
                
                // Create a reader for the stream
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                
                // Process the stream
                let buffer = '';
                
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    
                    // Decode the chunk and add to buffer
                    buffer += decoder.decode(value, { stream: true });
                    
                    console.log("Received buffer:", buffer.length > 100 ? buffer.substring(0, 100) + "..." : buffer); // Debug log
                    
                    // Process complete events in the buffer
                    const events = buffer.split('\n\n');
                    buffer = events.pop() || ''; // Keep the last incomplete chunk in the buffer
                    for (const event of events) {
                        if (event.startsWith('data: ')) {
                            try {
                                const dataStr = event.substring(6);
                                console.log("Data string:", dataStr); // Debug log
                                
                                const data = JSON.parse(dataStr);
                                console.log("Parsed data:", data); // Debug log
                                
                                // If this is a text chunk, add it to the response
                                if (data.chunk) {
                                    // Hide typing indicator on first chunk
                                    if (fullResponse === '') {
                                        const typingIndicator = responseMessage.querySelector('.typing-indicator');
                                        if (typingIndicator) {
                                            typingIndicator.style.display = 'none';
                                        }
                                    }
                                    
                                    fullResponse += data.chunk;
                                    responseParagraph.textContent = fullResponse;
                                    
                                    // Add visual streaming effect
                                    responseMessage.classList.add('streaming');
                                    
                                    // Scroll to bottom
                                    messageContainer.scrollTop = messageContainer.scrollHeight;
                                }
                                
                                // If this is the end of the stream, play the audio
                                if (data.done) {
                                    console.log("Stream complete, full response:", fullResponse); // Debug log
                                    
                                    // Remove streaming effect
                                    responseMessage.classList.remove('streaming');
                                    
                                    // Check if we have a valid response
                                    if (fullResponse && fullResponse.trim()) {
                                        // Check if the response is the fallback error message
                                        if (fullResponse.trim() === "I'm sorry, I couldn't generate a response at this time. Please try again.") {
                                            // Don't try to play audio for the fallback message
                                            console.log("Received fallback error message, not playing audio");
                                            responseParagraph.textContent = fullResponse;
                                        } else {
                                            // Play the audio response
                                            playAudioResponse(fullResponse, selectedAgentId, responseMessage);
                                        }
                                    } else {
                                        // Handle empty response
                                        responseParagraph.textContent = "I'm sorry, I couldn't generate a response. Please try again.";
                                    }
                                }
                            } catch (e) {
                                console.error('Error parsing event data:', e, 'Raw event:', event);
                            }
                        }
                    }
                }
            } else if (response.ok) {
                // Fallback to non-streaming response
                messageContainer.removeChild(typingIndicator);
                
                try {
                    // Try to parse as JSON first (new format)
                    const jsonResponse = await response.json();
                    console.log("Received JSON response:", jsonResponse);
                    
                    if (jsonResponse.text) {
                        // Display the text response
                        responseMessage.innerHTML = `<p>${jsonResponse.text}</p>`;
                        messageContainer.appendChild(responseMessage);
                        
                        // Play the audio response
                        playAudioResponse(jsonResponse.text, selectedAgentId, responseMessage);
                    } else {
                        throw new Error("No text in response");
                    }
                } catch (jsonError) {
                    console.error("Error parsing JSON response:", jsonError);
                    
                    // Fallback to audio blob (old format)
                    try {
                        // Reset the response to get the blob
                        const blobResponse = await fetch('/chat', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                message: message,
                                agent_id: selectedAgentId,
                                streaming: false
                            })
                        });
                        
                        const audioBlob = await blobResponse.blob();
                        
                        // Create a placeholder for the agent's response
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
                    } catch (blobError) {
                        console.error("Error getting blob response:", blobError);
                        responseMessage.innerHTML = '<p>Error loading response</p>';
                        messageContainer.appendChild(responseMessage);
                    }
                }
            } else {
                // Remove typing indicator
                messageContainer.removeChild(typingIndicator);
                
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
            
            // Remove typing indicator if it still exists
            const typingIndicators = messageContainer.querySelectorAll('.typing');
            typingIndicators.forEach(indicator => messageContainer.removeChild(indicator));
            
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
    
    async function playAudioResponse(text, agentId, messageElement) {
        try {
            // Check if text is empty or is the fallback error message
            if (!text || !text.trim()) {
                console.error('Empty text provided to playAudioResponse');
                return;
            }
            
            // Check if the text is the fallback error message
            if (text.trim() === "I'm sorry, I couldn't generate a response at this time. Please try again.") {
                console.error('Fallback error message provided to playAudioResponse');
                return;
            }
            
            // Add a loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'audio-loading';
            loadingIndicator.textContent = 'Generating audio...';
            messageElement.appendChild(loadingIndicator);
            
            // Request TTS for the complete response
            const response = await fetch('/stream-tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    voice_id: agentId
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to generate speech: ${response.status} ${response.statusText}`);
            }
            
            // Get the audio blob
            const audioBlob = await response.blob();
            
            // Remove loading indicator
            messageElement.removeChild(loadingIndicator);
            
            // Create audio element
            const audioElement = document.createElement('audio');
            audioElement.controls = true;
            audioElement.src = URL.createObjectURL(audioBlob);
            messageElement.appendChild(audioElement);
            
            // Create a separate Audio object for auto-playing
            const audio = new Audio(URL.createObjectURL(audioBlob));
            
            // Add event listener for when audio starts playing
            audio.addEventListener('play', () => {
                messageElement.classList.add('playing');
            });
            
            // Add event listener for when audio ends
            audio.addEventListener('ended', () => {
                messageElement.classList.remove('playing');
            });
            
            // Play audio
            audio.play().catch(e => {
                console.error('Error auto-playing audio:', e);
                // Add a play button as fallback
                const playButton = document.createElement('button');
                playButton.className = 'play-audio-btn';
                playButton.textContent = 'Play Response';
                playButton.onclick = () => audio.play();
                messageElement.appendChild(playButton);
            });
        } catch (error) {
            console.error('Error playing audio response:', error);
            // Add error message to the UI
            const errorElement = document.createElement('div');
            errorElement.className = 'audio-error';
            errorElement.textContent = 'Could not generate audio. Click to retry.';
            errorElement.onclick = () => playAudioResponse(text, agentId, messageElement);
            messageElement.appendChild(errorElement);
        }
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
