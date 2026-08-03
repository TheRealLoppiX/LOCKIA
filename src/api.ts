// Toda chamada de IA vai direto pro LOCKIA-API — o LOCK-API não entra nesse
// caminho (só é usado pelo authContext, pra login/registro).
const LOCKIA_API_URL = process.env.REACT_APP_LOCKIA_API_URL || 'http://localhost:3334';

export interface ChatHistoryEntry {
  role: 'user' | 'aegis';
  content: string;
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
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Erro ao chamar ${path}.`);
  }
  return data as T;
}

export const lockiaApi = {
  chat: (token: string, message: string, history: ChatHistoryEntry[]) =>
    post<{ response: string }>('/chat', token, { message, history }),

  challenge: (token: string, message: string, history: ChatHistoryEntry[]) =>
    post<{ html: string }>('/challenge', token, { message, history }),

  cowork: (token: string, message: string, history: ChatHistoryEntry[], authorizationConfirmed: boolean) =>
    post<{ response: string }>('/cowork', token, { message, history, authorizationConfirmed }),
};
