import React from 'react';
import { ChatCircleText, Flask, ShieldCheckered, Plus, Trash, SignOut, Robot } from '@phosphor-icons/react';
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
  userName,
  onLogout,
}) => {
  return (
    <aside className="mode-sidebar">
      <div className="mode-sidebar-brand">
        <Robot size={22} weight="duotone" />
        LOCKIA
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
        {conversations.map((c) => (
          <button
            key={c.id}
            className={`mode-history-item ${c.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <span className="mode-history-title">{c.title}</span>
            <span
              className="mode-history-delete"
              role="button"
              aria-label="Excluir conversa"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(c.id);
              }}
            >
              <Trash size={13} />
            </span>
          </button>
        ))}
      </div>

      <button className="mode-logout-btn" onClick={onLogout}>
        <SignOut size={16} /> {userName || 'Sair'}
      </button>
    </aside>
  );
};

export default ModeSidebar;
