// Chamadas ao LOCK-API (não ao LOCKIA-API) — usado pelos certificados de
// autorização do Cowork, que vivem no Supabase (só o LOCK-API tem acesso ao
// banco/Storage). Mesmo padrão cross-origin já usado pelo authContext.tsx
// para login/registro.
const LOCK_API_URL = process.env.REACT_APP_LOCK_API_URL || 'http://localhost:3333';

export interface AuthorizationCertificate {
  id: string;
  file_name: string;
  extracted_text: string;
  created_at: string;
}

async function request<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${LOCK_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // resposta sem corpo JSON (ex: 502 de cold start) — segue com data=null
  }
  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event('lockia:session-expired'));
    }
    throw new Error(data?.message || `Erro ao chamar ${path} (${response.status}).`);
  }
  return data as T;
}

export const lockApi = {
  listCoworkAuthorizations: (token: string) =>
    request<AuthorizationCertificate[]>('/cowork/authorizations', token),

  uploadCoworkAuthorization: (token: string, fileName: string, data: string) =>
    request<AuthorizationCertificate>('/cowork/authorizations', token, {
      method: 'POST',
      body: JSON.stringify({ fileName, data }),
    }),
};
