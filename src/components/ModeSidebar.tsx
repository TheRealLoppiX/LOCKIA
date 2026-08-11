import React, { useState } from 'react';
import { ChatCircleText, Flask, ShieldCheckered, Plus, Trash, SignOut } from '@phosphor-icons/react';
import logo from '../assets/lockia-logo.png';
import './ModeSidebar.css';

export type LockiaMode = 'chat' | 'challenge' | 'cowork';

export interface ConversationSummary {
  id: string;
  title: string;
}

interface ModeSidebarProps {
  mode: LockiaMode;
  onModeChange: (mode: LockiaMode) => void;
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  userName?: string;
  onLogout: () => void;
}

const MODES: { key: LockiaMode; label: string; icon: React.ReactNode }[] = [
  { key: 'chat', label: 'Chat', icon: <ChatCircleText size={18} weight="duotone" /> },
  { key: 'challenge', label: 'Challenge', icon: <Flask size={18} weight="duotone" /> },
  { key: 'cowork', label: 'Cowork', icon: <ShieldCheckered size={18} weight="duotone" /> },
];

const ModeSidebar: React.FC<ModeSidebarProps> = ({
  mode,
  onModeChange,
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  onRename,
  userName,
  onLogout,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const commitRename = () => {
    if (editingId && onRename) {
      const trimmed = editValue.trim();
      if (trimmed) onRename(editingId, trimmed);
    }
    setEditingId(null);
  };

  return (
    <aside className="mode-sidebar">
      <div className="mode-sidebar-brand">
        <img src={logo} alt="LOCKIA" className="mode-sidebar-logo" />
      </div>

      <div className="mode-tabs">
        {MODES.map((m) => (
          <button
            key={m.key}
            className={`mode-tab ${mode === m.key ? 'active' : ''}`}
            onClick={() => onModeChange(m.key)}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      <button className="mode-new-btn" onClick={onNewChat}>
        <Plus weight="bold" /> Nova conversa
      </button>

      <div className="mode-history">
        {conversations.length === 0 && <p className="mode-history-empty">Nenhuma conversa ainda.</p>}
        {conversations.map((c) =>
          editingId === c.id ? (
            // Um <input> dentro de um <button> seria HTML inválido (conteúdo
            // interativo aninhado) — por isso a linha em edição usa uma <div>
            // no lugar do <button> normal, só enquanto dura a edição.
            <div key={c.id} className="mode-history-item editing">
              <input
                className="mode-history-edit-input"
                value={editValue}
                autoFocus
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitRename();
                  } else if (e.key === 'Escape') {
                    setEditingId(null);
                  }
                }}
              />
            </div>
          ) : (
            <button
              key={c.id}
              className={`mode-history-item ${c.id === activeId ? 'active' : ''}`}
              onClick={() => onSelect(c.id)}
              title={onRename ? 'Duplo-clique para renomear' : undefined}
              onDoubleClick={() => {
                if (!onRename) return;
                setEditingId(c.id);
                setEditValue(c.title);
              }}
            >
              <span className="mode-history-title">{c.title}</span>
              <span
                className="mode-history-delete"
                role="button"
                aria-label="Excluir conversa"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Excluir a conversa "${c.title}"? Essa ação não pode ser desfeita.`)) {
                    onDelete(c.id);
                  }
                }}
              >
                <Trash size={13} />
              </span>
            </button>
          )
        )}
      </div>

      <button className="mode-logout-btn" onClick={onLogout}>
        <SignOut size={16} /> {userName || 'Sair'}
      </button>
    </aside>
  );
};

export default ModeSidebar;
