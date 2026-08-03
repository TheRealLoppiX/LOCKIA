import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { PaperPlaneTilt, CircleNotch, Copy, Check } from '@phosphor-icons/react';
import './ChatPanel.css';

export interface ChatMessage {
  role: 'user' | 'aegis';
  content: string;
  timestamp?: number;
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Efeito de "digitação" — a resposta já chega inteira e passou pelas camadas
// de segurança no servidor; isto só revela o texto progressivamente no
// cliente, sem reabrir a janela de um streaming real token-a-token.
const TypewriterMarkdown: React.FC<{ text: string; onDone?: () => void }> = ({ text, onDone }) => {
  const [visibleChars, setVisibleChars] = useState(0);

  useEffect(() => {
    setVisibleChars(0);
  }, [text]);

  useEffect(() => {
    if (visibleChars >= text.length) {
      if (visibleChars > 0) onDone?.();
      return;
    }
    const id = window.setTimeout(() => setVisibleChars((v) => Math.min(v + 3, text.length)), 12);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleChars, text]);

  const done = visibleChars >= text.length;
  return (
    <div className="chat-markdown">
      <ReactMarkdown>{text.slice(0, visibleChars)}</ReactMarkdown>
      {!done && <span className="chat-typing-cursor" />}
    </div>
  );
};

const CopyMessageButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponível — ignora silenciosamente
    }
  };
  return (
    <button className="chat-copy-btn" title={copied ? 'Copiado!' : 'Copiar mensagem'} onClick={handleCopy} type="button">
      {copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
    </button>
  );
};

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: (message?: string) => void;
  conversationId?: string | null;
  disabled?: boolean;
  placeholder?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  suggestions?: string[];
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isLoading,
  input,
  onInputChange,
  onSend,
  conversationId,
  disabled,
  placeholder = 'Envie uma mensagem...',
  emptyTitle = 'Novo chat',
  emptySubtitle = '',
  suggestions = [],
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const prevConversationIdRef = useRef(conversationId);
  const prevMessageCountRef = useRef(messages.length);
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);

  useEffect(() => {
    const conversationChanged = prevConversationIdRef.current !== conversationId;
    const grew = messages.length > prevMessageCountRef.current;
    const lastMessage = messages[messages.length - 1];

    if (!conversationChanged && grew && lastMessage?.role === 'aegis') {
      setAnimatingIndex(messages.length - 1);
    } else if (conversationChanged) {
      setAnimatingIndex(null);
    }
    prevConversationIdRef.current = conversationId;
    prevMessageCountRef.current = messages.length;
  }, [messages, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onInputChange(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <h1>{emptyTitle}</h1>
            {emptySubtitle && <p>{emptySubtitle}</p>}
            {suggestions.length > 0 && (
              <div className="chat-suggestions">
                {suggestions.map((prompt) => (
                  <button key={prompt} className="chat-suggestion-btn" onClick={() => onSend(prompt)} disabled={disabled}>
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.role}`}>
                <div className="chat-bubble-wrap">
                  <div className="chat-bubble">
                    {msg.role === 'aegis' ? (
                      i === animatingIndex ? (
                        <TypewriterMarkdown text={msg.content} onDone={() => setAnimatingIndex(null)} />
                      ) : (
                        <div className="chat-markdown">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )
                    ) : (
                      msg.content
                    )}
                  </div>
                  <div className="chat-bubble-meta">
                    {msg.timestamp && <span className="chat-message-time">{formatTime(msg.timestamp)}</span>}
                    {msg.role === 'aegis' && msg.content && <CopyMessageButton text={msg.content} />}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="chat-message aegis">
                <div className="chat-bubble loading">
                  <CircleNotch size={16} className="spin" /> Pensando...
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-bar">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={isLoading || disabled}
          />
          <button
            onClick={() => onSend()}
            disabled={isLoading || disabled || !input.trim()}
            className="chat-send-btn"
            title="Enviar"
            type="button"
          >
            <PaperPlaneTilt size={18} weight="fill" />
          </button>
        </div>
        <p className="chat-disclaimer">A IA pode cometer erros. Verifique informações críticas de segurança.</p>
      </div>
    </div>
  );
};

export default ChatPanel;
