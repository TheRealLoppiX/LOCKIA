// Toda chamada de IA vai direto pro LOCKIA-API — o LOCK-API não entra nesse
// caminho (só é usado pelo authContext, pra login/registro).
const LOCKIA_API_URL = process.env.REACT_APP_LOCKIA_API_URL || 'http://localhost:3334';

export interface ChatHistoryEntry {
  role: 'user' | 'aegis';
  content: string;
}

export interface ChatAttachment {
  name: string;
  mimeType: string;
  data: string; // base64, sem o prefixo data:...;base64,
}

async function post<T>(path: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(`${LOCKIA_API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  // Um 502/504 de gateway (ex: cold start do servidor) ou uma resposta sem
  // corpo não vêm como JSON — sem isso, response.json() lançaria antes de
  // chegarmos na checagem de response.ok, e o usuário veria um erro de parse
  // em vez de uma mensagem legível.
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // segue com data=null
  }
  if (!response.ok) {
    // 401 aqui só acontece por token ausente/expirado/inválido (toda rota
    // chamada por este client faz jwtVerify antes de mais nada) — sem esse
    // evento, o usuário via só uma bolha de erro no chat e ficava "logado"
    // na UI, sem nenhuma ação clara pra recuperar a sessão. authContext.tsx
    // escuta este evento pra deslogar e redirecionar pro login.
    if (response.status === 401) {
      window.dispatchEvent(new Event('lockia:session-expired'));
    }
    throw new Error(data?.message || `Erro ao chamar ${path} (${response.status}).`);
  }
  return data as T;
}

export const lockiaApi = {
  chat: (token: string, message: string, history: ChatHistoryEntry[], attachments?: ChatAttachment[]) =>
    post<{ response: string }>('/chat', token, { message, history, attachments }),

  challenge: (token: string, message: string, history: ChatHistoryEntry[]) =>
    post<{ html: string }>('/challenge', token, { message, history }),

  cowork: (token: string, message: string, history: ChatHistoryEntry[], authorizationConfirmed: boolean) =>
    post<{ response: string }>('/cowork', token, { message, history, authorizationConfirmed }),
};
