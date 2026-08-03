import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { PaperPlaneTilt, CircleNotch, Copy, Check, Paperclip, LinkSimple, X, FileText, Image as ImageIcon } from '@phosphor-icons/react';
import './ChatPanel.css';

export interface MessageAttachment {
  name: string;
  mimeType: string;
}

export interface ChatMessage {
  role: 'user' | 'aegis';
  content: string;
  timestamp?: number;
  attachments?: MessageAttachment[];
  links?: string[];
  isError?: boolean;
}

export interface PendingAttachment {
  name: string;
  mimeType: string;
  data: string; // base64, sem o prefixo data:...;base64,
  previewUrl?: string;
}

export const ACCEPTED_ATTACHMENT_TYPES = 'image/png,image/jpeg,image/webp,application/pdf,text/plain';
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_MB = 5;

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
  // Anexos (imagem/documento/link) — opcional; quando omitido, o composer
  // fica só com texto (usado hoje pelo modo Cowork, que ainda não repassa
  // anexos pro LOCKIA-API).
  attachments?: PendingAttachment[];
  onAddAttachments?: (files: FileList) => void;
  onRemoveAttachment?: (index: number) => void;
  attachmentError?: string | null;
  pendingLinks?: string[];
  onAddLink?: (url: string) => void;
  onRemoveLink?: (index: number) => void;
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
  attachments,
  onAddAttachments,
  onRemoveAttachment,
  attachmentError,
  pendingLinks,
  onAddLink,
  onRemoveLink,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');

  const supportsAttachments = !!onAddAttachments;
  const supportsLinks = !!onAddLink;

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onAddAttachments) {
      onAddAttachments(e.target.files);
    }
    e.target.value = ''; // permite selecionar o mesmo arquivo de novo
  };

  const handleConfirmLink = () => {
    const url = linkDraft.trim();
    if (!url || !onAddLink) return;
    onAddLink(url);
    setLinkDraft('');
    setLinkInputOpen(false);
  };

  const canAttachMore = (attachments?.length || 0) < MAX_ATTACHMENTS;
  const hasPending = (attachments && attachments.length > 0) || (pendingLinks && pendingLinks.length > 0);
  const canSend = !isLoading && !disabled && (!!input.trim() || hasPending);

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
              <div key={`${msg.role}-${msg.timestamp ?? 0}-${i}`} className={`chat-message ${msg.role}`}>
                <div className="chat-bubble-wrap">
                  <div className={`chat-bubble ${msg.isError ? 'error' : ''}`}>
                    {(msg.attachments && msg.attachments.length > 0) || (msg.links && msg.links.length > 0) ? (
                      <div className="chat-bubble-attachments">
                        {msg.attachments?.map((att, j) => (
                          <span key={`att-${j}`} className="chat-attachment-chip">
                            {att.mimeType.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}
                            {att.name}
                          </span>
                        ))}
                        {msg.links?.map((link, j) => (
                          <span key={`link-${j}`} className="chat-attachment-chip">
                            <LinkSimple size={14} />
                            {link}
                          </span>
                        ))}
                      </div>
                    ) : null}
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
                    {msg.role === 'aegis' && msg.content && !msg.isError && <CopyMessageButton text={msg.content} />}
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
        {attachmentError && <p className="chat-attachment-error">{attachmentError}</p>}

        {hasPending && (
          <div className="chat-pending-attachments">
            {attachments?.map((att, i) => (
              <div key={`pending-att-${i}`} className="chat-pending-chip">
                {att.previewUrl ? (
                  <img src={att.previewUrl} alt={att.name} className="chat-pending-thumb" />
                ) : (
                  <FileText size={16} />
                )}
                <span className="chat-pending-name">{att.name}</span>
                <button onClick={() => onRemoveAttachment?.(i)} title="Remover anexo" type="button">
                  <X size={12} />
                </button>
              </div>
            ))}
            {pendingLinks?.map((link, i) => (
              <div key={`pending-link-${i}`} className="chat-pending-chip">
                <LinkSimple size={16} />
                <span className="chat-pending-name">{link}</span>
                <button onClick={() => onRemoveLink?.(i)} title="Remover link" type="button">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {linkInputOpen && (
          <div className="chat-link-input-bar">
            <LinkSimple size={15} />
            <input
              type="url"
              value={linkDraft}
              onChange={(e) => setLinkDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirmLink();
                } else if (e.key === 'Escape') {
                  setLinkInputOpen(false);
                  setLinkDraft('');
                }
              }}
              placeholder="Cole o link (ex: https://...)"
              autoFocus
            />
            <button type="button" onClick={handleConfirmLink} disabled={!linkDraft.trim()}>Adicionar</button>
            <button type="button" onClick={() => { setLinkInputOpen(false); setLinkDraft(''); }} title="Cancelar">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="chat-input-bar">
          {supportsAttachments && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_ATTACHMENT_TYPES}
                multiple
                hidden
                onChange={handleFileChange}
              />
              <button
                className="chat-attach-btn"
                title={canAttachMore ? `Anexar imagem ou documento (máx. ${MAX_ATTACHMENT_MB}MB, até ${MAX_ATTACHMENTS} arquivos)` : `Limite de ${MAX_ATTACHMENTS} anexos atingido`}
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || disabled || !canAttachMore}
                type="button"
              >
                <Paperclip size={18} />
              </button>
            </>
          )}
          {supportsLinks && (
            <button
              className="chat-attach-btn"
              title="Anexar link"
              onClick={() => setLinkInputOpen((v) => !v)}
              disabled={isLoading || disabled}
              type="button"
            >
              <LinkSimple size={18} />
            </button>
          )}
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
            disabled={!canSend}
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
