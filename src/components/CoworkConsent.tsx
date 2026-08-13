import React, { useEffect, useState } from 'react';
import { ShieldWarning, FilePdf } from '@phosphor-icons/react';
import { lockApi, AuthorizationCertificate } from '../lockApi';
import './CoworkConsent.css';

interface CoworkConsentProps {
  token: string | null;
  onConfirm: (scope: string) => void;
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;

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

// Gate de consentimento explícito, por conversa — exigido antes de liberar a
// primeira mensagem no modo Cowork. Isso não substitui o classificador que
// roda em cada mensagem no LOCKIA-API, é a primeira das duas camadas.
//
// Diferente da versão anterior (um campo de texto livre descrevendo o
// escopo), aqui o usuário precisa enviar um PDF — o certificado/autorização
// de verdade. O LOCK-API extrai e valida o texto, guarda o PDF original no
// Supabase Storage e devolve o texto extraído, que vira o "escopo
// declarado" reenviado a cada mensagem do Cowork (mesmo mecanismo de antes,
// só que a fonte do texto agora é um documento em vez de digitação livre).
const CoworkConsent: React.FC<CoworkConsentProps> = ({ token, onConfirm }) => {
  const [checked, setChecked] = useState(false);
  const [certificates, setCertificates] = useState<AuthorizationCertificate[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoadingList(false);
      return;
    }
    lockApi
      .listCoworkAuthorizations(token)
      .then((list) => {
        setCertificates(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .catch(() => {
        // Lista vazia se falhar — o usuário ainda pode enviar um PDF novo.
      })
      .finally(() => setLoadingList(false));
  }, [token]);

  // A confirmação é sobre um certificado específico ("confirmo que o
  // certificado SELECIONADO é válido") — sem resetar aqui, trocar de
  // certificado (ou enviar um novo PDF, que troca a seleção automaticamente)
  // mantinha o botão liberado para um documento que o usuário nunca de fato
  // confirmou.
  useEffect(() => {
    setChecked(false);
  }, [selectedId]);

  const selected = certificates.find((c) => c.id === selectedId) || null;
  const canConfirm = checked && !!selected;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite selecionar o mesmo arquivo de novo depois de um erro
    if (!file || !token) return;

    if (file.type !== 'application/pdf') {
      setUploadError('Envie um arquivo PDF.');
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setUploadError('O PDF passa do limite de 10MB.');
      return;
    }

    setUploadError(null);
    setUploading(true);
    try {
      const data = await readFileAsBase64(file);
      const created = await lockApi.uploadCoworkAuthorization(token, file.name, data);
      setCertificates((prev) => [created, ...prev]);
      setSelectedId(created.id);
    } catch (err: any) {
      setUploadError(err.message || 'Não foi possível processar o PDF.');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = () => {
    if (!selected) return;
    onConfirm(selected.extracted_text);
  };

  return (
    <div className="cowork-consent">
      <div className="cowork-consent-card">
        <ShieldWarning size={36} weight="duotone" />
        <h2>Antes de começar</h2>
        <p>
          O modo Cowork ajuda em testes de invasão reais. Ele só deve ser usado em ambientes que você tem
          autorização explícita para testar. Envie o PDF do certificado/autorização (seu próprio ambiente,
          um CTF, ou um contrato de pentest com escopo definido) — o texto extraído dele vira a referência
          fixa que o classificador do Cowork usa a cada mensagem, reduzindo recusas falsas sem precisar
          redigitar o contexto toda hora.
        </p>

        <label className="cowork-consent-label">Certificado de autorização (PDF)</label>

        {loadingList ? (
          <p className="cowork-consent-hint">Carregando certificados enviados...</p>
        ) : certificates.length > 0 ? (
          <div className="cowork-cert-list">
            {certificates.map((c) => (
              <label key={c.id} className={`cowork-cert-item ${selectedId === c.id ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="cowork-cert"
                  checked={selectedId === c.id}
                  onChange={() => setSelectedId(c.id)}
                />
                <FilePdf size={16} />
                <span className="cowork-cert-name">{c.file_name}</span>
                <span className="cowork-cert-date">{new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="cowork-consent-hint">Nenhum certificado enviado ainda.</p>
        )}

        {selected && (
          <p className="cowork-cert-preview">
            {selected.extracted_text.slice(0, 220)}
            {selected.extracted_text.length > 220 ? '…' : ''}
          </p>
        )}

        <label className="cowork-consent-upload-btn">
          {uploading ? 'Enviando e lendo o PDF...' : 'Enviar novo certificado (PDF)'}
          <input type="file" accept="application/pdf" onChange={handleFileChange} disabled={uploading} hidden />
        </label>
        {uploadError && <p className="cowork-consent-error">{uploadError}</p>}

        <label className="cowork-consent-checkbox">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          Confirmo que o certificado selecionado é válido e autoriza este teste de segurança.
        </label>
        <button disabled={!canConfirm} onClick={handleConfirm}>
          Continuar
        </button>
      </div>
    </div>
  );
};

export default CoworkConsent;
