// ChatInterface.jsx
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import './ChatInterface.css'; // Make sure to create this CSS file

const ChatInterface = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const messagesEndRef = useRef(null);
  const speechSynthesisRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() === '') return;
    
    // Add user message
    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    
    // Simulate AI response
    setIsLoading(true);
    setTimeout(() => {
      const aiResponse = `I received your message: "${input}". This is a simulated response from the AI assistant.`;
      setMessages([...newMessages, { 
        role: 'assistant', 
        content: aiResponse
      }]);
      setIsLoading(false);
      
      // Speak the AI response if enabled
      if (speakEnabled) {
        speak(aiResponse);
      }
    }, 1500);
  };

  // Function to handle speech synthesis
  const speak = (text) => {
    // Cancel any ongoing speech
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Toggle speech functionality
  const toggleSpeech = () => {
    if (speakEnabled) {
      // If turning off, stop any ongoing speech
      window.speechSynthesis.cancel();
    }
    setSpeakEnabled(!speakEnabled);
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean up speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <div className="chat-container">
      {/* Header */}
      <header className="chat-header">
        <div className="header-content">
          {/* Left Logo */}
          <div className="left-logo">
            <div className="logo-circle">
              <MessageSquare size={20} />
            </div>
            <span className="logo-text">ChatAI</span>
          </div>
          
          {/* Right Logo and Speech Toggle */}
          <div className="header-right">
            <button 
              className={`speech-toggle ${speakEnabled ? 'enabled' : 'disabled'}`}
              onClick={toggleSpeech}
              title={speakEnabled ? "Turn off speech" : "Turn on speech"}
            >
              {speakEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <div className="right-logo">
              <span>ACME</span>
            </div>
          </div>
        </div>
      </header>
      
      {/* Chat Area */}
      <div className="message-area">
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`message-container ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
          >
            <div className={`message-bubble ${message.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>
              {message.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message-container assistant-message">
            <div className="message-bubble assistant-bubble loading-bubble">
              <RefreshCw size={16} className="loading-icon" />
              <span>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <div className="input-area">
        <form onSubmit={handleSubmit} className="input-form">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message here..."
            className="message-input"
          />
          <button 
            type="submit" 
            className="send-button"
            disabled={input.trim() === '' || isLoading}
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;