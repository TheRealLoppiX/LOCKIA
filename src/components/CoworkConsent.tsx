import React, { useState } from 'react';
import { ShieldWarning } from '@phosphor-icons/react';
import './CoworkConsent.css';

interface CoworkConsentProps {
  onConfirm: (scope: string) => void;
}

const MIN_SCOPE_LENGTH = 10;

// Gate de consentimento explícito, por conversa — exigido antes de liberar a
// primeira mensagem no modo Cowork. Isso não substitui o classificador que
// roda em cada mensagem no LOCKIA-API, é a primeira das duas camadas.
//
// O campo de escopo (além do checkbox) existe porque, sem um texto de
// referência fixo, o classificador do backend precisava reconstruir "isso é
// autorizado?" vasculhando o histórico a cada mensagem — na dúvida ele
// recusa, então conversas normais viviam esbarrando em recusas
// falso-positivas. Descrever o escopo uma vez aqui e reenviá-lo em toda
// mensagem dá ao classificador um fato fixo pra checar, em vez de inferir.
const CoworkConsent: React.FC<CoworkConsentProps> = ({ onConfirm }) => {
  const [checked, setChecked] = useState(false);
  const [scope, setScope] = useState('');

  const scopeValid = scope.trim().length >= MIN_SCOPE_LENGTH;

  const handleConfirm = () => {
    if (!checked || !scopeValid) return;
    onConfirm(scope.trim());
  };

  return (
    <div className="cowork-consent">
      <div className="cowork-consent-card">
        <ShieldWarning size={36} weight="duotone" />
        <h2>Antes de começar</h2>
        <p>
          O modo Cowork ajuda em testes de invasão reais. Ele só deve ser usado em ambientes que você tem
          autorização explícita para testar (seu próprio ambiente, um CTF, ou um engajamento com escopo
          combinado). Cada mensagem ainda passa por uma checagem própria — recusas podem acontecer mesmo
          depois desta confirmação, mas descrever o escopo abaixo reduz bastante as recusas falsas.
        </p>
        <label className="cowork-consent-label" htmlFor="cowork-scope">
          Descreva o ambiente/escopo autorizado
        </label>
        <textarea
          id="cowork-scope"
          className="cowork-consent-scope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          placeholder='Ex: "Laboratório próprio na minha rede local", "CTF HackTheBox — máquina Forest", "Pentest com contrato assinado cobrindo o domínio exemplo.com"'
          rows={3}
          maxLength={300}
        />
        <label className="cowork-consent-checkbox">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          Confirmo que possuo autorização por escrito para realizar este teste de segurança neste escopo.
        </label>
        <button disabled={!checked || !scopeValid} onClick={handleConfirm}>
          Continuar
        </button>
      </div>
    </div>
  );
};

export default CoworkConsent;
