import React, { useState } from 'react';
import { PaperPlaneTilt, CircleNotch, Flask } from '@phosphor-icons/react';
import './ChallengeView.css';

export interface ChallengeEntry {
  prompt: string;
  html: string;
  timestamp: number;
}

interface ChallengeViewProps {
  entries: ChallengeEntry[];
  isLoading: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onGenerate: () => void;
  conversationId: string | null;
}

// O HTML gerado pela IA é propositalmente vulnerável (é o próprio objetivo
// do desafio) — por isso roda num iframe sandboxed sem "allow-same-origin":
// o documento fica numa origem opaca isolada, incapaz de ler cookies,
// localStorage ou o DOM do LOCKIA, mesmo que o próprio desafio contenha um
// script malicioso de propósito.
const ChallengeView: React.FC<ChallengeViewProps> = ({ entries, isLoading, input, onInputChange, onGenerate, conversationId }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(entries.length > 0 ? entries.length - 1 : null);

  const selected = selectedIndex !== null ? entries[selectedIndex] : null;

  const handleGenerate = () => {
    onGenerate();
  };

  // Reseleciona o desafio mais recente sempre que a conversa ativa muda (não só
  // quando o número de entradas muda) — evita mostrar o desafio de outra conversa
  // ao trocar para uma que tenha o mesmo número de desafios já gerados.
  React.useEffect(() => {
    setSelectedIndex(entries.length > 0 ? entries.length - 1 : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, entries.length]);

  return (
    <div className="challenge-view">
      <div className="challenge-history">
        <div className="challenge-history-label">
          <Flask size={15} /> Desafios desta conversa
        </div>
        {entries.length === 0 && <p className="challenge-history-empty">Descreva o desafio que você quer praticar.</p>}
        {entries.map((entry, i) => (
          <button
            key={`${entry.timestamp}-${i}`}
            className={`challenge-history-item ${i === selectedIndex ? 'active' : ''}`}
            onClick={() => setSelectedIndex(i)}
          >
            {entry.prompt.slice(0, 60)}
          </button>
        ))}
      </div>

      <div className="challenge-canvas">
        {isLoading ? (
          <div className="challenge-canvas-loading">
            <CircleNotch size={22} className="spin" /> Gerando desafio...
          </div>
        ) : selected ? (
          <iframe
            title="Desafio"
            className="challenge-iframe"
            sandbox="allow-scripts allow-forms"
            srcDoc={selected.html}
          />
        ) : (
          <div className="challenge-canvas-empty">
            <Flask size={40} weight="duotone" />
            <p>Peça um desafio prático (ex: "crie um formulário de login vulnerável a SQL injection") e ele aparece aqui, isolado num painel próprio.</p>
          </div>
        )}
      </div>

      <div className="challenge-composer">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Descreva o desafio que você quer gerar..."
          rows={2}
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleGenerate();
            }
          }}
        />
        <button onClick={handleGenerate} disabled={isLoading || !input.trim()} type="button">
          <PaperPlaneTilt size={18} weight="fill" />
        </button>
      </div>
    </div>
  );
};

export default ChallengeView;
