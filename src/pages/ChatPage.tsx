import React, { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../contexts/authContext';
import { lockiaApi } from '../api';
import ModeSidebar, { LockiaMode } from '../components/ModeSidebar';
import ChatPanel, { ChatMessage } from '../components/ChatPanel';
import ChallengeView, { ChallengeEntry } from '../components/ChallengeView';
import CoworkConsent from '../components/CoworkConsent';
import './ChatPage.css';

interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  authorizationConfirmed?: boolean; // só usado no modo cowork
}

interface ChallengeConversation {
  id: string;
  title: string;
  entries: ChallengeEntry[];
}

function deriveTitle(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return 'Nova conversa';
  return trimmed.length > 42 ? `${trimmed.slice(0, 42)}...` : trimmed;
}

function loadChat(key: string): ChatConversation[] {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(saved)) return saved;
  } catch {
    // ignora dados corrompidos
  }
  return [];
}

function loadChallenge(key: string): ChallengeConversation[] {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(saved)) return saved;
  } catch {
    // ignora dados corrompidos
  }
  return [];
}

const CHAT_SUGGESTIONS = [
  'Explique um ataque de SQL Injection',
  'Como funciona um ataque de força bruta?',
  'Prepare-me para a prova CompTIA Security+',
];

const ChatPage: React.FC = () => {
  const { token, user, logout } = useAuth();
  const [mode, setMode] = useState<LockiaMode>('chat');

  // --- Modo Chat ---
  const [chatConvos, setChatConvos] = useState<ChatConversation[]>(() => loadChat('lockia-chat'));
  const [chatActiveId, setChatActiveId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // --- Modo Cowork ---
  const [coworkConvos, setCoworkConvos] = useState<ChatConversation[]>(() => loadChat('lockia-cowork'));
  const [coworkActiveId, setCoworkActiveId] = useState<string | null>(null);
  const [coworkInput, setCoworkInput] = useState('');
  const [coworkLoading, setCoworkLoading] = useState(false);

  // --- Modo Challenge ---
  const [challengeConvos, setChallengeConvos] = useState<ChallengeConversation[]>(() => loadChallenge('lockia-challenge'));
  const [challengeActiveId, setChallengeActiveId] = useState<string | null>(null);
  const [challengeInput, setChallengeInput] = useState('');
  const [challengeLoading, setChallengeLoading] = useState(false);

  const persistChat = useCallback((key: string, next: ChatConversation[], setter: (v: ChatConversation[]) => void) => {
    setter(next);
    localStorage.setItem(key, JSON.stringify(next));
  }, []);

  const persistChallenge = useCallback((next: ChallengeConversation[]) => {
    setChallengeConvos(next);
    localStorage.setItem('lockia-challenge', JSON.stringify(next));
  }, []);

  // ---------------- Chat / Cowork (mesma lógica, endpoint diferente) ----------------
  const runChatLikeSend = async (
    kind: 'chat' | 'cowork',
    message: string,
    convos: ChatConversation[],
    activeId: string | null,
    setActiveId: (id: string | null) => void,
    setInput: (v: string) => void,
    setLoading: (v: boolean) => void,
    storageKey: string,
    setConvos: (v: ChatConversation[]) => void
  ) => {
    if (!message.trim() || !token) return;
    setInput('');
    setLoading(true);

    let workingId = activeId;
    let workingList = convos;

    if (!workingId) {
      workingId = `${Date.now()}`;
      workingList = [{ id: workingId, title: deriveTitle(message), messages: [] }, ...convos];
      setActiveId(workingId);
    }

    const userMsg: ChatMessage = { role: 'user', content: message, timestamp: Date.now() };
    const history = (workingList.find((c) => c.id === workingId)?.messages || []).map((m) => ({ role: m.role, content: m.content }));
    const withUser = workingList.map((c) => (c.id === workingId ? { ...c, messages: [...c.messages, userMsg] } : c));
    persistChat(storageKey, withUser, setConvos);

    try {
      const activeConvo = withUser.find((c) => c.id === workingId);
      const authorizationConfirmed = !!activeConvo?.authorizationConfirmed;
      const { response } =
        kind === 'chat'
          ? await lockiaApi.chat(token, message, history)
          : await lockiaApi.cowork(token, message, history, authorizationConfirmed);
      const reply: ChatMessage = { role: 'aegis', content: response, timestamp: Date.now() };
      persistChat(storageKey, withUser.map((c) => (c.id === workingId ? { ...c, messages: [...c.messages, reply] } : c)), setConvos);
    } catch (err: any) {
      const reply: ChatMessage = { role: 'aegis', content: err.message || 'Erro de conexão com o LOCKIA-API.', timestamp: Date.now() };
      persistChat(storageKey, withUser.map((c) => (c.id === workingId ? { ...c, messages: [...c.messages, reply] } : c)), setConvos);
    } finally {
      setLoading(false);
    }
  };

  const handleChatSend = (override?: string) => {
    const message = (override ?? chatInput).trim();
    runChatLikeSend('chat', message, chatConvos, chatActiveId, setChatActiveId, setChatInput, setChatLoading, 'lockia-chat', setChatConvos);
  };

  const handleCoworkSend = (override?: string) => {
    const message = (override ?? coworkInput).trim();
    runChatLikeSend('cowork', message, coworkConvos, coworkActiveId, setCoworkActiveId, setCoworkInput, setCoworkLoading, 'lockia-cowork', setCoworkConvos);
  };

  const handleCoworkConfirm = () => {
    let workingId = coworkActiveId;
    let workingList = coworkConvos;
    if (!workingId) {
      workingId = `${Date.now()}`;
      workingList = [{ id: workingId, title: 'Nova conversa', messages: [], authorizationConfirmed: true }, ...coworkConvos];
      setCoworkActiveId(workingId);
    } else {
      workingList = coworkConvos.map((c) => (c.id === workingId ? { ...c, authorizationConfirmed: true } : c));
    }
    persistChat('lockia-cowork', workingList, setCoworkConvos);
  };

  // ---------------- Challenge ----------------
  const handleChallengeGenerate = async () => {
    const message = challengeInput.trim();
    if (!message || !token) return;
    setChallengeInput('');
    setChallengeLoading(true);

    let workingId = challengeActiveId;
    let workingList = challengeConvos;
    if (!workingId) {
      workingId = `${Date.now()}`;
      workingList = [{ id: workingId, title: deriveTitle(message), entries: [] }, ...challengeConvos];
      setChallengeActiveId(workingId);
    }

    try {
      const { html } = await lockiaApi.challenge(token, message, []);
      const entry: ChallengeEntry = { prompt: message, html, timestamp: Date.now() };
      persistChallenge(workingList.map((c) => (c.id === workingId ? { ...c, entries: [...c.entries, entry] } : c)));
    } catch (err: any) {
      const entry: ChallengeEntry = {
        prompt: message,
        html: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;"><h1>Erro</h1><p>${err.message || 'Não foi possível gerar o desafio.'}</p></body></html>`,
        timestamp: Date.now(),
      };
      persistChallenge(workingList.map((c) => (c.id === workingId ? { ...c, entries: [...c.entries, entry] } : c)));
    } finally {
      setChallengeLoading(false);
    }
  };

  // ---------------- Sidebar helpers por modo ----------------
  const sidebarProps = useMemo(() => {
    if (mode === 'chat') {
      return {
        conversations: chatConvos.map(({ id, title }) => ({ id, title })),
        activeId: chatActiveId,
        onSelect: setChatActiveId,
        onNewChat: () => setChatActiveId(null),
        onDelete: (id: string) => {
          const next = chatConvos.filter((c) => c.id !== id);
          persistChat('lockia-chat', next, setChatConvos);
          if (chatActiveId === id) setChatActiveId(null);
        },
      };
    }
    if (mode === 'cowork') {
      return {
        conversations: coworkConvos.map(({ id, title }) => ({ id, title })),
        activeId: coworkActiveId,
        onSelect: setCoworkActiveId,
        onNewChat: () => setCoworkActiveId(null),
        onDelete: (id: string) => {
          const next = coworkConvos.filter((c) => c.id !== id);
          persistChat('lockia-cowork', next, setCoworkConvos);
          if (coworkActiveId === id) setCoworkActiveId(null);
        },
      };
    }
    return {
      conversations: challengeConvos.map(({ id, title }) => ({ id, title })),
      activeId: challengeActiveId,
      onSelect: setChallengeActiveId,
      onNewChat: () => setChallengeActiveId(null),
      onDelete: (id: string) => {
        const next = challengeConvos.filter((c) => c.id !== id);
        persistChallenge(next);
        if (challengeActiveId === id) setChallengeActiveId(null);
      },
    };
  }, [mode, chatConvos, chatActiveId, coworkConvos, coworkActiveId, challengeConvos, challengeActiveId, persistChat, persistChallenge]);

  const activeChatMessages = chatConvos.find((c) => c.id === chatActiveId)?.messages || [];
  const activeCoworkConvo = coworkConvos.find((c) => c.id === coworkActiveId);
  const activeChallengeEntries = challengeConvos.find((c) => c.id === challengeActiveId)?.entries || [];

  return (
    <div className="chat-page">
      <ModeSidebar
        mode={mode}
        onModeChange={setMode}
        userName={user?.name}
        onLogout={logout}
        {...sidebarProps}
      />

      {mode === 'chat' && (
        <ChatPanel
          messages={activeChatMessages}
          isLoading={chatLoading}
          input={chatInput}
          onInputChange={setChatInput}
          onSend={handleChatSend}
          conversationId={chatActiveId}
          placeholder="Pergunte sobre cibersegurança..."
          emptyTitle="LOCKIA"
          emptySubtitle="Assistente de IA especializado em cibersegurança."
          suggestions={CHAT_SUGGESTIONS}
        />
      )}

      {mode === 'challenge' && (
        <ChallengeView
          entries={activeChallengeEntries}
          isLoading={challengeLoading}
          input={challengeInput}
          onInputChange={setChallengeInput}
          onGenerate={handleChallengeGenerate}
        />
      )}

      {mode === 'cowork' && (
        !activeCoworkConvo?.authorizationConfirmed ? (
          <CoworkConsent onConfirm={handleCoworkConfirm} />
        ) : (
          <ChatPanel
            messages={activeCoworkConvo.messages}
            isLoading={coworkLoading}
            input={coworkInput}
            onInputChange={setCoworkInput}
            onSend={handleCoworkSend}
            conversationId={coworkActiveId}
            placeholder="Descreva o que você precisa para o teste autorizado..."
            emptyTitle="Cowork"
            emptySubtitle="Assistência técnica para testes de invasão autorizados."
          />
        )
      )}
    </div>
  );
};

export default ChatPage;
