import React, { useState } from 'react';
import { ShieldWarning } from '@phosphor-icons/react';
import './CoworkConsent.css';

interface CoworkConsentProps {
  onConfirm: () => void;
}

// Gate de consentimento explícito, por conversa — exigido antes de liberar a
// primeira mensagem no modo Cowork. Isso não substitui o classificador que
// roda em cada mensagem no LOCKIA-API, é a primeira das duas camadas.
const CoworkConsent: React.FC<CoworkConsentProps> = ({ onConfirm }) => {
  const [checked, setChecked] = useState(false);

  return (
    <div className="cowork-consent">
      <div className="cowork-consent-card">
        <ShieldWarning size={36} weight="duotone" />
        <h2>Antes de começar</h2>
        <p>
          O modo Cowork ajuda em testes de invasão reais. Ele só deve ser usado em ambientes que você tem
          autorização explícita para testar (seu próprio ambiente, um CTF, ou um engajamento com escopo
          combinado). Cada mensagem ainda passa por uma checagem própria — recusas podem acontecer mesmo
          depois desta confirmação.
        </p>
        <label className="cowork-consent-checkbox">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          Confirmo que possuo autorização por escrito para realizar este teste de segurança neste alvo.
        </label>
        <button disabled={!checked} onClick={onConfirm}>
          Continuar
        </button>
      </div>
    </div>
  );
};

export default CoworkConsent;
