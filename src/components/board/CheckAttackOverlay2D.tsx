import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface CheckAttackOverlay2DProps {
  boardOrientation: 'white' | 'black';
  attackerSquares: string[];
  kingSquare: string | null;
  isCheck: boolean;
}

export default function CheckAttackOverlay2D({
  boardOrientation,
  attackerSquares,
  kingSquare,
  isCheck
}: CheckAttackOverlay2DProps) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (isCheck && kingSquare && attackerSquares.length > 0) {
      setAnimate(true);
    } else {
      setAnimate(false);
    }
  }, [isCheck, kingSquare, attackerSquares]);

  if (!isCheck || !kingSquare || attackerSquares.length === 0) return null;

  // Helper to get center coordinates (%) of a square
  const getSquareCoords = (sq: string) => {
    if (sq.length < 2) return { x: 50, y: 50 };
    const f = sq[0];
    const r = parseInt(sq[1], 10);
    
    let fileIdx = f.charCodeAt(0) - 97;
    let rankIdx = 8 - r;
    
    if (boardOrientation === 'black') {
      fileIdx = 7 - fileIdx;
      rankIdx = 7 - rankIdx;
    }
    
    return {
      x: (fileIdx + 0.5) * 12.5,
      y: (rankIdx + 0.5) * 12.5
    };
  };

  const kingCoords = getSquareCoords(kingSquare);

  // Show max 2 attackers to avoid clutter
  const visibleAttackers = attackerSquares.slice(0, 2);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-hidden">
      {/* 2D SVGs for Attack Beams */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
        {visibleAttackers.map((attSquare) => {
          const start = getSquareCoords(attSquare);
          return (
            <g key={attSquare}>
              {/* Outer Beam Glow */}
              <line
                x1={`${start.x}%`}
                y1={`${start.y}%`}
                x2={`${kingCoords.x}%`}
                y2={`${kingCoords.y}%`}
                stroke="rgba(255, 60, 0, 0.4)"
                strokeWidth="16"
                strokeLinecap="round"
                opacity="0.7"
                style={{
                  filter: 'blur(4px)',
                  animation: 'checkBeamShoot 420ms ease-out forwards'
                }}
              />
              {/* Central Glowing Beam Core */}
              <line
                className="attack-beam-2d"
                x1={`${start.x}%`}
                y1={`${start.y}%`}
                x2={`${kingCoords.x}%`}
                y2={`${kingCoords.y}%`}
              />
            </g>
          );
        })}
      </svg>

      {/* Red pulse on king square */}
      <div
        className="king-check-pulse-2d"
        style={{
          width: '12.5%',
          height: '12.5%',
          left: `${kingCoords.x - 6.25}%`,
          top: `${kingCoords.y - 6.25}%`
        }}
      />
    </div>
  );
}
