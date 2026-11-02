import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, Sparkles, User, ExternalLink, Loader2 } from 'lucide-react';
import { aiService } from '../services/api';

const AiAssistantDrawer = ({ isOpen, onClose, onSelectOpportunity }) => {
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Hello! I am **HackElite AI**, your technical career and hackathon advisor. Ask me for recommendations based on your skills, upcoming deadlines, or tips for competitive applications!',
      recommendations: [],
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (messageText) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || loading) return;

    const userMessage = { sender: 'user', text: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await aiService.chat(textToSend);
      const botReply = {
        sender: 'bot',
        text: res.data.reply || 'I found some matching items in the database for you:',
        recommendations: res.data.recommendedOpportunities || [],
        source: res.data.source,
      };
      setMessages((prev) => [...prev, botReply]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: 'Apologies, I encountered an issue connecting to the AI contextual service. Please check that the backend server is running.',
          recommendations: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'Recommend hackathons for React & AI',
    'Find high-stipend internships',
    'Upcoming deadlines this month',
    'Give me pro tips for application pitches',
  ];

  return (
    <div className="ai-drawer">
      <div className="modal-header" style={{ padding: '16px 20px', background: 'rgba(10, 13, 20, 0.8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="brand-icon" style={{ width: '32px', height: '32px' }}>
            <Bot size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>HackElite AI Advisor</h3>
            <span style={{ fontSize: '0.72rem', color: '#10b981' }}>● Live MongoDB Grounded</span>
          </div>
        </div>
        <button className="modal-close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="ai-messages-container">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`ai-message-bubble ${
              msg.sender === 'user' ? 'ai-message-user' : 'ai-message-bot'
            }`}
          >
            <div style={{ whiteSpace: 'pre-line', lineHeight: '1.5' }}>
              {msg.text}
            </div>

            {msg.recommendations && msg.recommendations.length > 0 && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase' }}>
                  Recommended Live Opportunities:
                </span>
                {msg.recommendations.map((opp) => (
                  <div key={opp._id || opp.title} className="ai-recommendation-mini-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{opp.title}</strong>
                      <span className="badge badge-domain" style={{ fontSize: '0.65rem' }}>{opp.domain}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '3px 0' }}>
                      {opp.company} • {opp.reward}
                    </div>
                    <button
                      className="btn btn-outline-primary btn-sm"
                      style={{ padding: '3px 8px', fontSize: '0.72rem', marginTop: '4px', width: '100%' }}
                      onClick={() => onSelectOpportunity(opp)}
                    >
                      <span>Explore & Apply</span>
                      <ExternalLink size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="ai-message-bubble ai-message-bot" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Loader2 size={16} className="animate-spin" color="#818cf8" />
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              Analyzing live opportunities & generating recommendation...
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div className="ai-suggestions-row">
        {suggestions.map((s, idx) => (
          <button key={idx} className="suggestion-chip" onClick={() => handleSend(s)}>
            {s}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <form
        className="ai-input-bar"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <input
          type="text"
          className="form-input"
          style={{ flex: 1, padding: '9px 12px' }}
          placeholder="Ask for recommendations or tips..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !input.trim()}>
          <Send size={15} />
        </button>
      </form>
    </div>
  );
};

export default AiAssistantDrawer;
