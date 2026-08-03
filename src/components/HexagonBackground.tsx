import React, { useState, useEffect } from 'react';
import './HexagonBackground.css';

interface Hexagon {
  id: number;
  style: React.CSSProperties;
}

const NUM_HEXAGONS = 40;

const HexagonBackground: React.FC = () => {
  const [hexagons, setHexagons] = useState<Hexagon[]>([]);

  useEffect(() => {
    const generated: Hexagon[] = [];
    for (let i = 0; i < NUM_HEXAGONS; i++) {
      const size = 50 + Math.random() * 100;
      const duration = 10 + Math.random() * 15;
      const delay = Math.random() * 10;
      generated.push({
        id: i,
        style: {
          left: `${Math.random() * 100}%`,
          width: `${size}px`,
          height: `${size}px`,
          animationDuration: `${duration}s`,
          animationDelay: `${delay}s`,
        },
      });
    }
    setHexagons(generated);
  }, []);

  return (
    <div className="hexagon-background">
      {hexagons.map((hex) => (
        <div key={hex.id} className="rising-hexagon" style={hex.style} />
      ))}
    </div>
  );
};

export default HexagonBackground;
