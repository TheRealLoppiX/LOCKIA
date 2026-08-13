import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheckered } from '@phosphor-icons/react';
import { useAuth } from '../contexts/authContext';
import { lockiaApi, ChatAttachment } from '../api';
import ModeSidebar, { LockiaMode } from '../components/ModeSidebar';
import ChatPanel, { ChatMessage, PendingAttachment } from '../components/ChatPanel';
import ChallengeView, { ChallengeEntry } from '../components/ChallengeView';
import CoworkConsent from '../components/CoworkConsent';
import './ChatPage.css';

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ACCEPTED_ATTACHMENT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain'];

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1)); // remove o prefixo "data:mime;base64,"
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  authorizationConfirmed?: boolean; // só usado no modo cowork
  scope?: string; // só usado no modo cowork — escopo declarado no consentimento
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

// Escopadas por userId — sem isso, um segundo usuário logando no mesmo
// navegador herdava as conversas do usuário anterior via localStorage
// compartilhado (o bug reportado).
const CHAT_KEY_PREFIX = 'lockia-chat:';
const COWORK_KEY_PREFIX = 'lockia-cowork:';
const CHALLENGE_KEY_PREFIX = 'lockia-challenge:';
// Chaves antigas (sem escopo por usuário) de antes desta correção — nunca
// mais lidas, só removidas na primeira montagem para não deixar histórico de
// conversa de outro usuário parado no localStorage do navegador.
const LEGACY_CHAT_KEY = 'lockia-chat';
const LEGACY_COWORK_KEY = 'lockia-cowork';
const LEGACY_CHALLENGE_KEY = 'lockia-challenge';

const ChatPage: React.FC = () => {
  const { token, user, logout } = useAuth();
  // PrivateRoute só monta esta página com isAuthenticated true, então user já
  // está resolvido aqui — o fallback 'anon' nunca é de fato usado, só
  // satisfaz o tipo (User | null) do contexto.
  const userId = user?.id || 'anon';
  const chatKey = `${CHAT_KEY_PREFIX}${userId}`;
  const coworkKey = `${COWORK_KEY_PREFIX}${userId}`;
  const challengeKey = `${CHALLENGE_KEY_PREFIX}${userId}`;

  // Remove as chaves antigas (sem escopo por usuário) uma única vez — elas
  // podem ter histórico de conversa de outro usuário que já usou este
  // navegador antes desta correção.
  useEffect(() => {
    localStorage.removeItem(LEGACY_CHAT_KEY);
    localStorage.removeItem(LEGACY_COWORK_KEY);
    localStorage.removeItem(LEGACY_CHALLENGE_KEY);
  }, []);

  const [mode, setMode] = useState<LockiaMode>('chat');

  // --- Modo Chat ---
  const [chatConvos, setChatConvos] = useState<ChatConversation[]>(() => loadChat(chatKey));
  const [chatActiveId, setChatActiveId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatAttachments, setChatAttachments] = useState<PendingAttachment[]>([]);
  const [chatAttachmentError, setChatAttachmentError] = useState<string | null>(null);
  const [chatPendingLinks, setChatPendingLinks] = useState<string[]>([]);

  // --- Modo Cowork ---
  const [coworkConvos, setCoworkConvos] = useState<ChatConversation[]>(() => loadChat(coworkKey));
  const [coworkActiveId, setCoworkActiveId] = useState<string | null>(null);
  const [coworkInput, setCoworkInput] = useState('');
  const [coworkLoading, setCoworkLoading] = useState(false);

  // --- Modo Challenge ---
  const [challengeConvos, setChallengeConvos] = useState<ChallengeConversation[]>(() => loadChallenge(challengeKey));
  const [challengeActiveId, setChallengeActiveId] = useState<string | null>(null);
  const [challengeInput, setChallengeInput] = useState('');
  const [challengeLoading, setChallengeLoading] = useState(false);

  const persistChat = useCallback((key: string, next: ChatConversation[], setter: (v: ChatConversation[]) => void) => {
    setter(next);
    localStorage.setItem(key, JSON.stringify(next));
  }, []);

  const persistChallenge = useCallback((next: ChallengeConversation[]) => {
    setChallengeConvos(next);
    localStorage.setItem(challengeKey, JSON.stringify(next));
  }, [challengeKey]);

  // Mesmo raciocínio de appendConvoReply: parte do estado mais recente, não
  // de uma cópia capturada antes do "await" de lockiaApi.challenge. Uma
  // conversa nova só entra no estado real quando a 1ª entrada chega (ver
  // handleChallengeGenerate), então se ela ainda não existir em `prev` é
  // inserida aqui — do contrário, apenas mescla no que já existe.
  const appendChallengeEntry = useCallback((id: string, title: string, entry: ChallengeEntry) => {
    setChallengeConvos((prev) => {
      const base = prev.some((c) => c.id === id) ? prev : [{ id, title, entries: [] }, ...prev];
      const next = base.map((c) => (c.id === id ? { ...c, entries: [...c.entries, entry] } : c));
      localStorage.setItem(challengeKey, JSON.stringify(next));
      return next;
    });
  }, [challengeKey]);

  // Anexa a resposta (ou erro) de uma requisição em andamento à conversa,
  // partindo sempre do estado MAIS RECENTE (não de uma cópia capturada antes
  // do "await" da chamada à API). Entre o envio e a resposta chegar, o
  // usuário pode trocar/apagar conversas pela sidebar (nada ali é bloqueado
  // por isLoading) — usar uma cópia antiga aqui reverteria essas ações
  // (ex: "ressuscitar" uma conversa apagada nesse meio-tempo).
  const appendConvoReply = useCallback(
    (key: string, id: string, reply: ChatMessage, setter: React.Dispatch<React.SetStateAction<ChatConversation[]>>) => {
      setter((prev) => {
        const next = prev.map((c) => (c.id === id ? { ...c, messages: [...c.messages, reply] } : c));
        localStorage.setItem(key, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  // Sincroniza entre abas: se outra aba salvar uma dessas chaves (nova
  // mensagem, conversa apagada etc.), recarrega o estado em vez de deixar a
  // cópia em memória desta aba sobrescrever o que a outra aba salvou.
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === chatKey) setChatConvos(loadChat(chatKey));
      else if (e.key === coworkKey) setCoworkConvos(loadChat(coworkKey));
      else if (e.key === challengeKey) setChallengeConvos(loadChallenge(challengeKey));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [chatKey, coworkKey, challengeKey]);

  // ---------------- Anexos do modo Chat (imagem/documento/link) ----------------
  const handleAddChatAttachments = async (files: FileList) => {
    setChatAttachmentError(null);
    const incoming = Array.from(files);
    if (chatAttachments.length + incoming.length > MAX_ATTACHMENTS) {
      setChatAttachmentError(`Você pode anexar no máximo ${MAX_ATTACHMENTS} arquivos por mensagem.`);
      return;
    }
    const next: PendingAttachment[] = [...chatAttachments];
    for (const file of incoming) {
      if (!ACCEPTED_ATTACHMENT_MIME_TYPES.includes(file.type)) {
        setChatAttachmentError(`Tipo de arquivo não suportado: ${file.name}. Use PNG, JPEG, WEBP, PDF ou TXT.`);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setChatAttachmentError(`"${file.name}" passa do limite de 5MB.`);
        continue;
      }
      try {
        const data = await readFileAsBase64(file);
        next.push({
          name: file.name,
          mimeType: file.type,
          data,
          previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        });
      } catch {
        setChatAttachmentError(`Não foi possível ler o arquivo "${file.name}".`);
      }
    }
    setChatAttachments(next);
  };

  const handleRemoveChatAttachment = (index: number) => {
    setChatAttachments((prev) => {
      const removed = prev[index];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleAddChatLink = (url: string) => {
    setChatPendingLinks((prev) => [...prev, url]);
  };

  const handleRemoveChatLink = (index: number) => {
    setChatPendingLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const clearChatPending = useCallback(() => {
    chatAttachments.forEach((a) => {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
    });
    setChatAttachments([]);
    setChatPendingLinks([]);
    setChatAttachmentError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatAttachments]);

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
    setConvos: React.Dispatch<React.SetStateAction<ChatConversation[]>>,
    pendingAttachments: PendingAttachment[] = [],
    pendingLinks: string[] = [],
    clearPending?: () => void
  ) => {
    if ((!message.trim() && pendingAttachments.length === 0 && pendingLinks.length === 0) || !token) return;
    setInput('');
    clearPending?.();
    setLoading(true);

    let workingId = activeId;
    let workingList = convos;

    if (!workingId) {
      workingId = `${Date.now()}`;
      const title = deriveTitle(message || pendingAttachments[0]?.name || pendingLinks[0] || 'Novo anexo');
      workingList = [{ id: workingId, title, messages: [] }, ...convos];
      setActiveId(workingId);
    }

    const userMsg: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: Date.now(),
      attachments: pendingAttachments.length > 0 ? pendingAttachments.map(({ name, mimeType }) => ({ name, mimeType })) : undefined,
      links: pendingLinks.length > 0 ? pendingLinks : undefined,
    };
    const history = (workingList.find((c) => c.id === workingId)?.messages || []).map((m) => ({ role: m.role, content: m.content }));
    const withUser = workingList.map((c) => (c.id === workingId ? { ...c, messages: [...c.messages, userMsg] } : c));
    persistChat(storageKey, withUser, setConvos);

    // O LOCKIA-API não busca conteúdo de URL nenhuma (sem risco de SSRF) — um
    // link anexado só é repassado como texto pra IA comentar a partir do que
    // já sabe, igual citar um link numa conversa normal.
    const messageForApi = pendingLinks.length > 0
      ? `${message}${message ? '\n\n' : ''}Link(s) compartilhado(s) pelo usuário:\n${pendingLinks.map((l) => `- ${l}`).join('\n')}`
      : message;

    try {
      const activeConvo = withUser.find((c) => c.id === workingId);
      const authorizationConfirmed = !!activeConvo?.authorizationConfirmed;
      const apiAttachments: ChatAttachment[] | undefined = pendingAttachments.length > 0
        ? pendingAttachments.map(({ name, mimeType, data }) => ({ name, mimeType, data }))
        : undefined;
      const { response } =
        kind === 'chat'
          ? await lockiaApi.chat(token, messageForApi, history, apiAttachments)
          : await lockiaApi.cowork(token, messageForApi, history, authorizationConfirmed, activeConvo?.scope);
      const reply: ChatMessage = { role: 'aegis', content: response, timestamp: Date.now() };
      appendConvoReply(storageKey, workingId, reply, setConvos);
    } catch (err: any) {
      const reply: ChatMessage = { role: 'aegis', content: err.message || 'Erro de conexão com o LOCKIA-API.', timestamp: Date.now(), isError: true };
      appendConvoReply(storageKey, workingId, reply, setConvos);
    } finally {
      setLoading(false);
    }
  };

  const handleChatSend = (override?: string) => {
    const message = (override ?? chatInput).trim();
    runChatLikeSend(
      'chat', message, chatConvos, chatActiveId, setChatActiveId, setChatInput, setChatLoading, chatKey, setChatConvos,
      chatAttachments, chatPendingLinks, clearChatPending
    );
  };

  const handleCoworkSend = (override?: string) => {
    const message = (override ?? coworkInput).trim();
    runChatLikeSend('cowork', message, coworkConvos, coworkActiveId, setCoworkActiveId, setCoworkInput, setCoworkLoading, coworkKey, setCoworkConvos);
  };

  const handleCoworkConfirm = (scope: string) => {
    let workingId = coworkActiveId;
    let workingList = coworkConvos;
    if (!workingId) {
      workingId = `${Date.now()}`;
      workingList = [{ id: workingId, title: 'Nova conversa', messages: [], authorizationConfirmed: true, scope }, ...coworkConvos];
      setCoworkActiveId(workingId);
    } else {
      workingList = coworkConvos.map((c) => (c.id === workingId ? { ...c, authorizationConfirmed: true, scope } : c));
    }
    persistChat(coworkKey, workingList, setCoworkConvos);
  };

  // ---------------- Challenge ----------------
  const handleChallengeGenerate = async () => {
    const message = challengeInput.trim();
    if (!message || !token) return;
    setChallengeInput('');
    setChallengeLoading(true);

    let workingId = challengeActiveId;
    const title = deriveTitle(message);
    if (!workingId) {
      workingId = `${Date.now()}`;
      setChallengeActiveId(workingId);
    }

    // Histórico da conversa (desafios já gerados nela) — sem isso, um pedido
    // de acompanhamento como "agora deixa mais difícil" não tinha nenhum
    // contexto do desafio anterior. Manda o prompt de cada desafio anterior
    // e uma descrição curta em vez do HTML completo (que pode passar de
    // 4000 caracteres e não ajuda o modelo a entender o desafio gerado).
    const priorEntries = challengeConvos.find((c) => c.id === workingId)?.entries || [];
    const history = priorEntries.flatMap((e) => [
      { role: 'user' as const, content: e.prompt },
      { role: 'aegis' as const, content: `[Desafio HTML gerado anteriormente sobre: "${e.prompt}"]` },
    ]);

    try {
      const { html } = await lockiaApi.challenge(token, message, history);
      const entry: ChallengeEntry = { prompt: message, html, timestamp: Date.now() };
      appendChallengeEntry(workingId, title, entry);
    } catch (err: any) {
      const entry: ChallengeEntry = {
        prompt: message,
        html: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;"><h1>Erro</h1><p>${err.message || 'Não foi possível gerar o desafio.'}</p></body></html>`,
        timestamp: Date.now(),
      };
      appendChallengeEntry(workingId, title, entry);
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
        onSelect: (id: string) => {
          setChatActiveId(id);
          setChatInput('');
          clearChatPending();
        },
        onNewChat: () => {
          setChatActiveId(null);
          setChatInput('');
          clearChatPending();
        },
        onDelete: (id: string) => {
          const next = chatConvos.filter((c) => c.id !== id);
          persistChat(chatKey, next, setChatConvos);
          if (chatActiveId === id) setChatActiveId(null);
        },
        onRename: (id: string, title: string) => {
          const next = chatConvos.map((c) => (c.id === id ? { ...c, title } : c));
          persistChat(chatKey, next, setChatConvos);
        },
      };
    }
    if (mode === 'cowork') {
      return {
        conversations: coworkConvos.map(({ id, title }) => ({ id, title })),
        activeId: coworkActiveId,
        onSelect: (id: string) => {
          setCoworkActiveId(id);
          setCoworkInput('');
        },
        onNewChat: () => {
          setCoworkActiveId(null);
          setCoworkInput('');
        },
        onDelete: (id: string) => {
          const next = coworkConvos.filter((c) => c.id !== id);
          persistChat(coworkKey, next, setCoworkConvos);
          if (coworkActiveId === id) setCoworkActiveId(null);
        },
        onRename: (id: string, title: string) => {
          const next = coworkConvos.map((c) => (c.id === id ? { ...c, title } : c));
          persistChat(coworkKey, next, setCoworkConvos);
        },
      };
    }
    return {
      conversations: challengeConvos.map(({ id, title }) => ({ id, title })),
      activeId: challengeActiveId,
      onSelect: (id: string) => {
        setChallengeActiveId(id);
        setChallengeInput('');
      },
      onNewChat: () => {
        setChallengeActiveId(null);
        setChallengeInput('');
      },
      onDelete: (id: string) => {
        const next = challengeConvos.filter((c) => c.id !== id);
        persistChallenge(next);
        if (challengeActiveId === id) setChallengeActiveId(null);
      },
      onRename: (id: string, title: string) => {
        const next = challengeConvos.map((c) => (c.id === id ? { ...c, title } : c));
        persistChallenge(next);
      },
    };
  }, [mode, chatConvos, chatActiveId, coworkConvos, coworkActiveId, challengeConvos, challengeActiveId, persistChat, persistChallenge, clearChatPending, chatKey, coworkKey]);

  const activeChatMessages = chatConvos.find((c) => c.id === chatActiveId)?.messages || [];
  const activeCoworkConvo = coworkConvos.find((c) => c.id === coworkActiveId);
  const activeChallengeEntries = challengeConvos.find((c) => c.id === challengeActiveId)?.entries || [];

  return (
    <div className="chat-page">
      <ModeSidebar
        mode={mode}
        onModeChange={setMode}
        userName={user?.name}
        token={token}
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
          attachments={chatAttachments}
          onAddAttachments={handleAddChatAttachments}
          onRemoveAttachment={handleRemoveChatAttachment}
          attachmentError={chatAttachmentError}
          pendingLinks={chatPendingLinks}
          onAddLink={handleAddChatLink}
          onRemoveLink={handleRemoveChatLink}
        />
      )}

      {mode === 'challenge' && (
        <ChallengeView
          entries={activeChallengeEntries}
          isLoading={challengeLoading}
          input={challengeInput}
          onInputChange={setChallengeInput}
          onGenerate={handleChallengeGenerate}
          conversationId={challengeActiveId}
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
            banner={
              activeCoworkConvo.scope ? (
                <div className="chat-scope-banner">
                  <ShieldCheckered size={14} weight="duotone" /> Escopo declarado: {activeCoworkConvo.scope}
                </div>
              ) : undefined
            }
          />
        )
      )}
    </div>
  );
};

export default ChatPage;
