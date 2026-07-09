import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text, Sparkles, Float, Environment } from '@react-three/drei';
import * as THREE from 'three';
import CheckAttackOverlay3D from '../board/CheckAttackOverlay3D';

interface ChessBoard3DProps {
  board: any[][];
  onSquareClick: (square: string) => void;
  selectedSquare: string | null;
  validMoves: any[];
  lastMove: { from: string; to: string } | null;
  checkInfo: { king: string; checker: string } | null;
  checkVisual?: { isCheck: boolean; kingSquare: string | null; attackerSquares: string[] };
  chess: any;
  setBoard: (board: any) => void;
  setTurn: (turn: 'w' | 'b') => void;
  setLastMove: (move: any) => void;
  updateCheckInfo: () => void;
  checkGameOver: () => void;
  setSelectedSquare: (square: string | null) => void;
  setValidMoves: (moves: any[]) => void;
  showHints: boolean;
  onSelect?: () => void;
  selectedPieceSet: 'classic' | 'royal' | 'literature' | 'sports' | 'modern';
  boardTheme: 'classic' | 'wood' | 'marble' | 'neon';
  capturedPieces: { w: string[], b: string[] };
  isLocalVS?: boolean;
  turn?: 'w' | 'b';
  playerColor?: 'w' | 'b';
  lowGraphics?: boolean;
  isAIThinking?: boolean;
  onLoad?: () => void;
}

export default function ChessBoard3D({
  board,
  onSquareClick,
  selectedSquare,
  validMoves,
  lastMove,
  checkInfo,
  checkVisual,
  chess,
  setBoard,
  setTurn,
  setLastMove,
  updateCheckInfo,
  checkGameOver,
  setSelectedSquare,
  setValidMoves,
  showHints,
  onSelect,
  selectedPieceSet,
  boardTheme,
  capturedPieces,
  isLocalVS,
  turn,
  playerColor,
  lowGraphics,
  isAIThinking,
  onLoad
}: ChessBoard3DProps) {
  const squareSize = 1.05;

  useEffect(() => {
    if (onLoad) {
      onLoad();
    }
  }, []);

  // Determine if we should flip the board view (swap sides)
  const shouldFlip = playerColor === 'b';

  console.log("[3D_ORIENTATION]", {
    playerColor,
    turn,
    isLocalVS,
    shouldFlip
  });

  interface ActivePiece {
    id: string;
    type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
    color: 'w' | 'b';
    square: string;
  }

  const [activePieces, setActivePieces] = React.useState<ActivePiece[]>([]);

  const initializePieces = (boardArray: any[][]) => {
    const counts: { [key: string]: number } = {};
    const pieces: ActivePiece[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = boardArray[r][c];
        if (cell) {
          const squareName = String.fromCharCode(97 + c) + (8 - r);
          const key = `${cell.color}-${cell.type}`;
          counts[key] = (counts[key] || 0) + 1;
          pieces.push({
            id: `${key}-${counts[key]}`,
            type: cell.type,
            color: cell.color,
            square: squareName
          });
        }
      }
    }
    return pieces;
  };

  useEffect(() => {
    const newOccupied: { square: string; type: string; color: string }[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = board[r][c];
        if (cell) {
          newOccupied.push({
            square: String.fromCharCode(97 + c) + (8 - r),
            type: cell.type,
            color: cell.color
          });
        }
      }
    }

    const historyLength = chess?.getHistory ? chess.getHistory().length : 0;
    if (activePieces.length === 0 || historyLength === 0) {
      const initial = initializePieces(board);
      setActivePieces(initial);
      return;
    }

    const updatedPieces: ActivePiece[] = [];
    const availablePieces = [...activePieces];

    // First pass: Match exact square + type + color
    const unmatchedOccupied: typeof newOccupied = [];
    for (const item of newOccupied) {
      const idx = availablePieces.findIndex(p => p.square === item.square && p.type === item.type && p.color === item.color);
      if (idx !== -1) {
        updatedPieces.push(availablePieces[idx]);
        availablePieces.splice(idx, 1);
      } else {
        unmatchedOccupied.push(item);
      }
    }

    // Second pass: Match moves
    const finalUnmatchedOccupied: typeof unmatchedOccupied = [];
    for (const item of unmatchedOccupied) {
      let idx = availablePieces.findIndex(p => p.type === item.type && p.color === item.color);
      
      if (idx === -1 && item.type !== 'p') {
        idx = availablePieces.findIndex(p => p.type === 'p' && p.color === item.color);
      }

      if (idx !== -1) {
        const piece = availablePieces[idx];
        updatedPieces.push({
          ...piece,
          type: item.type as any,
          square: item.square
        });
        availablePieces.splice(idx, 1);
      } else {
        finalUnmatchedOccupied.push(item);
      }
    }

    // Fallback pass: create new pieces if mismatch
    if (finalUnmatchedOccupied.length > 0) {
      const counts: { [key: string]: number } = {};
      for (const p of activePieces) {
        const prefix = p.id.split('-').slice(0, 2).join('-');
        const idx = parseInt(p.id.split('-')[2], 10);
        counts[prefix] = Math.max(counts[prefix] || 0, idx);
      }

      for (const item of finalUnmatchedOccupied) {
        const key = `${item.color}-${item.type}`;
        counts[key] = (counts[key] || 0) + 1;
        updatedPieces.push({
          id: `${key}-${counts[key]}`,
          type: item.type as any,
          color: item.color as any,
          square: item.square
        });
      }
    }

    updatedPieces.sort((a, b) => a.id.localeCompare(b.id));
    setActivePieces(updatedPieces);
  }, [board]);

  const getPiece3DPosition = (squareName: string): [number, number, number] => {
    const c = squareName.charCodeAt(0) - 97;
    const r = parseInt(squareName[1], 10) - 1;
    const displayC = shouldFlip ? 7 - c : c;
    const displayR = shouldFlip ? 7 - r : r;
    return [
      -(displayC - 3.5) * squareSize,
      0.12,
      (displayR - 3.5) * squareSize
    ];
  };

  // Theme Colors
  const themeColors = {
    classic: { dark: "#0d2666", light: "#f2f2ff", frame: "#cccccc" },
    wood: { dark: "#3d2b1f", light: "#d2b48c", frame: "#5c3314" },
    marble: { dark: "#1a1a1a", light: "#ffffff", frame: "#444444" },
    neon: { dark: "#000033", light: "#00ffff", frame: "#000066" }
  };

  const currentTheme = themeColors[boardTheme] || themeColors.classic;
  
  const handlePointerDown = (squareName: string, piece: any) => {
    onSquareClick(squareName);
  };

  return (
    <group position={[0, 1.62, 0]}>
      {/* Captured Pieces Display */}
      <CapturedPieces pieces={capturedPieces.w} side="left" squareSize={squareSize} color="w" pieceSet={selectedPieceSet} />
      <CapturedPieces pieces={capturedPieces.b} side="right" squareSize={squareSize} color="b" pieceSet={selectedPieceSet} />
      {/* Check Attack Overlay 3D */}
      {checkVisual && (
        <CheckAttackOverlay3D
          squareSize={squareSize}
          shouldFlip={shouldFlip}
          attackerSquares={checkVisual.attackerSquares}
          kingSquare={checkVisual.kingSquare}
          isCheck={checkVisual.isCheck}
          lowGraphics={lowGraphics}
        />
      )}

      {/* Board Frame */}
      <mesh position={[0, -0.05, 0]} receiveShadow onPointerDown={(e) => e.stopPropagation()}>
        <boxGeometry args={[squareSize * 8.6, 0.3, squareSize * 8.6]} />
        <meshStandardMaterial color={currentTheme.frame} roughness={0.1} metalness={0.8} />
      </mesh>
      
      {/* Squares */}
      {Array.from({ length: 8 }).map((_, r) => (
        Array.from({ length: 8 }).map((_, c) => {
          // If flipped, we swap the physical position of squares
          const displayR = shouldFlip ? 7 - r : r;
          const displayC = shouldFlip ? 7 - c : c;
          
          const squareName = String.fromCharCode(97 + c) + (r + 1);
          const isLight = (r + c) % 2 !== 0;
          const isSelected = selectedSquare === squareName;
          const isValidMove = validMoves.some((m: any) => m.to === squareName);
          const isCapture = isValidMove && board[7-r][c] !== null;
          const isLastMove = lastMove && (lastMove.from === squareName || lastMove.to === squareName);
          const piece = board[7-r][c];

          return (
            <group 
              key={squareName} 
              position={[-(displayC - 3.5) * squareSize, 0.04, (displayR - 3.5) * squareSize]}
              onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(squareName, piece); }}
            >
              <mesh receiveShadow>
                <boxGeometry args={[squareSize * 0.98, 0.2, squareSize * 0.98]} />
                <meshStandardMaterial 
                  color={isLight ? currentTheme.light : currentTheme.dark} 
                  roughness={boardTheme === 'wood' ? 0.8 : 0.1}
                  metalness={boardTheme === 'neon' ? 0.5 : 0.2}
                  emissive={boardTheme === 'neon' ? (isLight ? "#00ffff" : "#0000ff") : "#000"}
                  emissiveIntensity={boardTheme === 'neon' ? 0.2 : 0}
                />
              </mesh>

              {/* Highlights */}
              {isSelected && (
                <mesh position={[0, 0.15, 0]}>
                  <boxGeometry args={[squareSize * 0.98, 0.02, squareSize * 0.98]} />
                  <meshStandardMaterial color="#ffdf00" transparent opacity={0.8} emissive="#ffdf00" emissiveIntensity={1} />
                </mesh>
              )}
              {showHints && (
                <>
                  {isCapture ? (
                    <mesh position={[0, 0.15, 0]}>
                      <boxGeometry args={[squareSize * 0.96, 0.02, squareSize * 0.96]} />
                      <meshStandardMaterial color="#eb2626" transparent opacity={0.8} emissive="#eb2626" emissiveIntensity={1} />
                    </mesh>
                  ) : isValidMove ? (
                    <group>
                      <mesh position={[0, 0.15, 0]}>
                        <boxGeometry args={[squareSize * 0.96, 0.02, squareSize * 0.96]} />
                        <meshStandardMaterial color="#26e040" transparent opacity={0.7} emissive="#26e040" emissiveIntensity={1} />
                      </mesh>
                      <mesh position={[0, 0.18, 0]}>
                        <cylinderGeometry args={[0.11, 0.11, 0.03, 16]} />
                        <meshStandardMaterial color="#4dff66" transparent opacity={0.9} emissive="#4dff66" emissiveIntensity={1} />
                      </mesh>
                    </group>
                  ) : null}
                </>
              )}
              {isLastMove ? (
                <mesh position={[0, 0.145, 0]}>
                  <boxGeometry args={[squareSize * 0.97, 0.015, squareSize * 0.97]} />
                  <meshStandardMaterial color="#000000" transparent opacity={0.6} emissive="#0a0a20" emissiveIntensity={0.5} />
                </mesh>
              ) : null}

            </group>
          );
        })
      ))}

      {/* Active Pieces (flat list for smooth, flicker-free movement lerping) */}
      {activePieces.map((p) => (
        <Piece 
          key={p.id}
          type={p.type} 
          color={p.color} 
          position={getPiece3DPosition(p.square)} 
          pieceSet={selectedPieceSet}
          lowGraphics={lowGraphics}
          isAIThinking={isAIThinking}
          onPointerDown={() => handlePointerDown(p.square, p)}
        />
      ))}

      {/* Labels */}
      {"ABCDEFGH".split("").map((l, i) => (
        <Text
          key={l}
          position={[(i - 3.5) * squareSize, 0.08, -squareSize * 4.6]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.22}
          color="#b38c40"
        >
          {shouldFlip ? "HGFEDCBA"[i] : l}
        </Text>
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <Text
          key={i}
          position={[-squareSize * 4.6, 0.08, (i - 3.5) * squareSize]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.22}
          color="#b38c40"
        >
          {shouldFlip ? 8 - i : i + 1}
        </Text>
      ))}

      {/* Holographic Turn Indicator (Brilliant Idea) */}
      <Float speed={isAIThinking ? 0 : 2} rotationIntensity={isAIThinking ? 0 : 0.5} floatIntensity={isAIThinking ? 0 : 0.5}>
        <group position={[0, 6, 0]}>
          <Text
            position={[0, 0, 0]}
            fontSize={0.6}
            color={chess.getTurn() === 'w' ? "#ffffff" : "#444444"}
            anchorX="center"
            anchorY="middle"
          >
            {chess.getTurn() === 'w' ? "WHITE'S TURN" : "BLACK'S TURN"}
            <meshStandardMaterial 
              emissive={chess.getTurn() === 'w' ? "#ffffff" : "#444444"} 
              emissiveIntensity={2} 
              transparent 
              opacity={0.8}
            />
          </Text>
          {!lowGraphics && !isAIThinking && <Sparkles count={20} scale={[4, 1, 4]} size={2} speed={0.5} color="#ffbd52" />}
        </group>
      </Float>
    </group>
  );
}

const DEFAULT_PIECE_POSITION: [number, number, number] = [0, 0.03, 0];

const Piece = React.memo(function Piece({ type, color, position, pieceSet, scale = 1, lowGraphics, isAIThinking, onPointerDown }: any) {
  const isWhite = color === 'w';
  const groupRef = useRef<THREE.Group>(null);
  const appearanceScaleRef = useRef(lowGraphics ? 1 : 0);
  
  const targetPos = useRef<THREE.Vector3>(new THREE.Vector3(position[0], position[1], position[2]));
  const isFirstRender = useRef(true);

  useEffect(() => {
    targetPos.current.set(position[0], position[1], position[2]);
    if (isFirstRender.current && groupRef.current) {
      groupRef.current.position.copy(targetPos.current);
      isFirstRender.current = false;
    }
  }, [position]);

  // Colors based on set
  let col = isWhite ? "#ffffff" : "#2a2a2a";
  let emissive = isWhite ? "#333333" : "#555555";
  let metalness = 0.6;
  let roughness = 0.2;
  let pieceScale = 1;

  switch (pieceSet) {
    case 'royal':
      if (!isWhite) {
        col = "#0d1a4d"; // Midnight Blue
        emissive = "#050a20";
        metalness = 0.8;
        roughness = 0.1;
      } else {
        col = "#ffffff";
        emissive = "#444444";
        metalness = 0.7;
        roughness = 0.1;
      }
      break;
    case 'literature':
      col = isWhite ? "#f5e6d3" : "#2c1e1e"; // Parchment vs Ink
      emissive = isWhite ? "#221100" : "#000000";
      metalness = 0.1;
      roughness = 0.9;
      pieceScale = 0.9;
      break;
    case 'sports':
      col = isWhite ? "#ffffff" : "#eb2626"; // White vs Team Red
      emissive = isWhite ? "#444444" : "#440000";
      metalness = 0.3;
      roughness = 0.5;
      pieceScale = 1.1;
      break;
    case 'modern':
      col = isWhite ? "#00ffff" : "#ff00ff"; // Cyan vs Magenta
      emissive = isWhite ? "#00ffff" : "#ff00ff";
      metalness = 0.9;
      roughness = 0.05;
      break;
  }
  
  // Appearance & Lerp animation
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.position.lerp(targetPos.current, Math.min(1, delta * 12));
    }
    if (lowGraphics || isAIThinking) return; // Skip useFrame animations to save cycles!
    if (appearanceScaleRef.current < 1) {
      appearanceScaleRef.current = Math.min(1, appearanceScaleRef.current + delta * 3);
      if (groupRef.current) {
        groupRef.current.scale.setScalar(appearanceScaleRef.current * scale * pieceScale);
      }
    }
  });

  // Set scale instantly for lowGraphics on mount
  useEffect(() => {
    if (lowGraphics && groupRef.current) {
      groupRef.current.scale.setScalar(scale * pieceScale);
    }
  }, [lowGraphics, scale, pieceScale]);

  const material = (
    <meshStandardMaterial 
      color={col} 
      roughness={lowGraphics ? 0.9 : roughness} 
      metalness={lowGraphics ? 0.1 : metalness} 
      emissive={lowGraphics ? "#000000" : emissive}
      emissiveIntensity={lowGraphics ? 0 : (pieceSet === 'modern' ? 0.5 : 0.1)}
    />
  );

  const renderPiece = () => {
    switch (type) {
      case 'p': return <PawnModel material={material} lowGraphics={lowGraphics} />;
      case 'r': return <RookModel material={material} lowGraphics={lowGraphics} />;
      case 'n': return <KnightModel material={material} lowGraphics={lowGraphics} />;
      case 'b': return <BishopModel material={material} lowGraphics={lowGraphics} />;
      case 'q': return <QueenModel material={material} lowGraphics={lowGraphics} />;
      case 'k': return <KingModel material={material} lowGraphics={lowGraphics} />;
      default: return null;
    }
  };

  return (
    <group ref={groupRef} position={position} onPointerDown={(e) => { e.stopPropagation(); if (onPointerDown) onPointerDown(); }}>
      <group position={[0, 0.1, 0]} scale={[0.22, 0.22, 0.22]}>
        {renderPiece()}
      </group>
    </group>
  );
});

function PawnModel({ material, lowGraphics }: { material: any, lowGraphics?: boolean }) {
  const points = React.useMemo(() => [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.7, 0),
    new THREE.Vector2(0.65, 0.15),
    new THREE.Vector2(0.55, 0.3),
    new THREE.Vector2(0.5, 0.4),
    new THREE.Vector2(0.3, 0.6),
    new THREE.Vector2(0.25, 1.4),
    new THREE.Vector2(0.4, 1.5),
    new THREE.Vector2(0.45, 1.7),
    new THREE.Vector2(0.35, 1.9),
    new THREE.Vector2(0, 2.0)
  ], []);

  const segments = lowGraphics ? 12 : 32;
  const sphereSegments = lowGraphics ? 8 : 24;

  return (
    <group>
      <mesh castShadow={!lowGraphics}>
        <latheGeometry args={[points, segments]} />
        {material}
      </mesh>
      <mesh position={[0, 2.1, 0]} castShadow={!lowGraphics}>
        <sphereGeometry args={[0.4, sphereSegments, sphereSegments]} />
        {material}
      </mesh>
    </group>
  );
}

function RookModel({ material, lowGraphics }: { material: any, lowGraphics?: boolean }) {
  const points = React.useMemo(() => [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.85, 0),
    new THREE.Vector2(0.8, 0.2),
    new THREE.Vector2(0.65, 0.4),
    new THREE.Vector2(0.6, 0.5),
    new THREE.Vector2(0.5, 0.7),
    new THREE.Vector2(0.45, 2.2),
    new THREE.Vector2(0.65, 2.4),
    new THREE.Vector2(0.75, 2.8),
    new THREE.Vector2(0, 2.8)
  ], []);

  const segments = lowGraphics ? 12 : 32;

  return (
    <group>
      <mesh castShadow={!lowGraphics}>
        <latheGeometry args={[points, segments]} />
        {material}
      </mesh>
      {/* Battlements */}
      {!lowGraphics && Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * 2 * Math.PI;
        return (
          <mesh 
            key={i} 
            position={[0.65 * Math.cos(angle), 3.0, 0.65 * Math.sin(angle)]}
            rotation={[0, -angle, 0]}
            castShadow
          >
            <boxGeometry args={[0.3, 0.5, 0.25]} />
            {material}
          </mesh>
        );
      })}
    </group>
  );
}

function KnightModel({ material, lowGraphics }: { material: any, lowGraphics?: boolean }) {
  const basePoints = React.useMemo(() => [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.9, 0),
    new THREE.Vector2(0.85, 0.2),
    new THREE.Vector2(0.7, 0.4),
    new THREE.Vector2(0.65, 0.5),
    new THREE.Vector2(0.55, 0.7),
    new THREE.Vector2(0.45, 1.3),
    new THREE.Vector2(0, 1.4)
  ], []);

  const segments = lowGraphics ? 12 : 32;
  const detailedSegments = lowGraphics ? 8 : 24;

  return (
    <group>
      <mesh castShadow={!lowGraphics}>
        <latheGeometry args={[basePoints, segments]} />
        {material}
      </mesh>
      {/* Neck - Curved */}
      <mesh position={[0, 2.0, 0]} rotation={[0, 0, 0.1]} castShadow={!lowGraphics}>
        <cylinderGeometry args={[0.35, 0.45, 1.5, lowGraphics ? 8 : 16]} />
        {material}
      </mesh>
      {/* Head - Detailed Horse Shape */}
      <group position={[0.2, 2.8, 0]} rotation={[0, 0, -0.4]}>
        {/* Main Head / Skull */}
        <mesh scale={[0.6, 0.4, 0.35]} castShadow={!lowGraphics}>
          <sphereGeometry args={[1, detailedSegments, detailedSegments]} />
          {material}
        </mesh>
        {/* Snout - Longer and tapered */}
        <mesh position={[0.6, -0.2, 0]} rotation={[0, 0, 0.3]} castShadow={!lowGraphics}>
          <cylinderGeometry args={[0.18, 0.25, 0.8, lowGraphics ? 8 : 16]} />
          {material}
        </mesh>
        {/* Mouth line */}
        {!lowGraphics && (
          <mesh position={[0.9, -0.35, 0]} castShadow>
            <boxGeometry args={[0.2, 0.05, 0.2]} />
            <meshStandardMaterial color="#000" opacity={0.3} transparent />
          </mesh>
        )}
        {/* Mane - Flowing down */}
        <mesh position={[-0.4, -0.3, 0]} castShadow={!lowGraphics}>
          <boxGeometry args={[0.2, 1.6, 0.15]} />
          {material}
        </mesh>
        {/* Ears - Pointed */}
        <mesh position={[-0.1, 0.5, 0.12]} rotation={[0, 0, 0.3]} castShadow={!lowGraphics}>
          <coneGeometry args={[0.07, 0.3, lowGraphics ? 8 : 16]} />
          {material}
        </mesh>
        <mesh position={[-0.1, 0.5, -0.12]} rotation={[0, 0, 0.3]} castShadow={!lowGraphics}>
          <coneGeometry args={[0.07, 0.3, lowGraphics ? 8 : 16]} />
          {material}
        </mesh>
        {/* Eyes - Skip on low graphics */}
        {!lowGraphics && (
          <>
            <mesh position={[0.3, 0.1, 0.25]} castShadow>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color="#000" />
            </mesh>
            <mesh position={[0.3, 0.1, -0.25]} castShadow>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color="#000" />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
}

function BishopModel({ material, lowGraphics }: { material: any, lowGraphics?: boolean }) {
  const points = React.useMemo(() => [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.85, 0),
    new THREE.Vector2(0.8, 0.2),
    new THREE.Vector2(0.65, 0.4),
    new THREE.Vector2(0.6, 0.5),
    new THREE.Vector2(0.5, 0.7),
    new THREE.Vector2(0.35, 2.0),
    new THREE.Vector2(0.5, 2.2),
    new THREE.Vector2(0.55, 2.5),
    new THREE.Vector2(0.45, 2.7),
    new THREE.Vector2(0.6, 3.6),
    new THREE.Vector2(0.45, 4.0),
    new THREE.Vector2(0.15, 4.2),
    new THREE.Vector2(0, 4.3)
  ], []);

  const segments = lowGraphics ? 12 : 32;

  return (
    <group>
      <mesh castShadow={!lowGraphics}>
        <latheGeometry args={[points, segments]} />
        {material}
      </mesh>
      <mesh position={[0, 4.4, 0]} castShadow={!lowGraphics}>
        <sphereGeometry args={[0.12, lowGraphics ? 8 : 16, lowGraphics ? 8 : 16]} />
        {material}
      </mesh>
    </group>
  );
}

function QueenModel({ material, lowGraphics }: { material: any, lowGraphics?: boolean }) {
  const points = React.useMemo(() => [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.9, 0),
    new THREE.Vector2(0.85, 0.2),
    new THREE.Vector2(0.7, 0.4),
    new THREE.Vector2(0.65, 0.5),
    new THREE.Vector2(0.55, 0.7),
    new THREE.Vector2(0.4, 2.2),
    new THREE.Vector2(0.55, 2.4),
    new THREE.Vector2(0.6, 2.6),
    new THREE.Vector2(0.5, 2.8),
    new THREE.Vector2(0.7, 3.8),
    new THREE.Vector2(0.8, 4.2),
    new THREE.Vector2(0, 4.3)
  ], []);

  const segments = lowGraphics ? 12 : 32;

  return (
    <group>
      <mesh castShadow={!lowGraphics}>
        <latheGeometry args={[points, segments]} />
        {material}
      </mesh>
      {/* Coronet */}
      <group position={[0, 4.4, 0]}>
        <mesh castShadow={!lowGraphics}>
          <sphereGeometry args={[0.18, lowGraphics ? 12 : 24, lowGraphics ? 12 : 24]} />
          {material}
        </mesh>
        {!lowGraphics && Array.from({ length: 10 }).map((_, i) => {
          const angle = (i / 10) * 2 * Math.PI;
          return (
            <mesh 
              key={i} 
              position={[0.25 * Math.cos(angle), 0.15, 0.25 * Math.sin(angle)]}
              castShadow
            >
              <sphereGeometry args={[0.06, 8, 8]} />
              {material}
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function KingModel({ material, lowGraphics }: { material: any, lowGraphics?: boolean }) {
  const points = React.useMemo(() => [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.95, 0),
    new THREE.Vector2(0.9, 0.2),
    new THREE.Vector2(0.75, 0.4),
    new THREE.Vector2(0.7, 0.5),
    new THREE.Vector2(0.6, 0.7),
    new THREE.Vector2(0.45, 2.4),
    new THREE.Vector2(0.6, 2.6),
    new THREE.Vector2(0.65, 2.8),
    new THREE.Vector2(0.55, 3.0),
    new THREE.Vector2(0.75, 4.0),
    new THREE.Vector2(0.85, 4.4),
    new THREE.Vector2(0, 4.5)
  ], []);

  const segments = lowGraphics ? 12 : 32;

  return (
    <group>
      <mesh castShadow={!lowGraphics}>
        <latheGeometry args={[points, segments]} />
        {material}
      </mesh>
      {/* Crown Top */}
      <mesh position={[0, 4.6, 0]} castShadow={!lowGraphics}>
        <sphereGeometry args={[0.22, lowGraphics ? 12 : 24, lowGraphics ? 12 : 24]} />
        {material}
      </mesh>
      {/* Cross */}
      <group position={[0, 5.1, 0]}>
        <mesh castShadow={!lowGraphics}>
          <boxGeometry args={[0.12, 0.7, 0.12]} />
          {material}
        </mesh>
        <mesh position={[0, 0.15, 0]} castShadow={!lowGraphics}>
          <boxGeometry args={[0.45, 0.12, 0.12]} />
          {material}
        </mesh>
      </group>
    </group>
  );
}



export function CameraGuard() {
  const { camera } = useThree();
  
  useFrame(() => {
    // Keep camera inside the room
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -19, 19);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -19, 19);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, 1.5, 15);
  });

  return null;
}

export function Room() {
  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[40, 0.2, 40]} />
        <meshStandardMaterial color="#2a1a10" roughness={0.8} metalness={0.2} />
      </mesh>
      
      {/* Rug */}
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[22, 0.02, 18]} />
        <meshStandardMaterial color="#4d1a14" roughness={1} />
      </mesh>

      {/* Walls - Lighter for visibility */}
      {/* Back Wall */}
      <mesh position={[0, 8, -20]}>
        <boxGeometry args={[40, 16, 0.5]} />
        <meshStandardMaterial color="#3d2b1f" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Front Wall (behind camera) */}
      <mesh position={[0, 8, 20]}>
        <boxGeometry args={[40, 16, 0.5]} />
        <meshStandardMaterial color="#3d2b1f" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Left Wall */}
      <mesh position={[-20, 8, 0]}>
        <boxGeometry args={[0.5, 16, 40]} />
        <meshStandardMaterial color="#36261a" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Right Wall */}
      <mesh position={[20, 8, 0]}>
        <boxGeometry args={[0.5, 16, 40]} />
        <meshStandardMaterial color="#36261a" roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, 16, 0]}>
        <boxGeometry args={[40, 0.5, 40]} />
        <meshStandardMaterial color="#2a1a10" roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Decorative Pillars in corners */}
      {[[-19, -19], [19, -19], [-19, 19], [19, 19]].map(([x, z], i) => (
        <mesh key={i} position={[x, 8, z]} castShadow receiveShadow>
          <cylinderGeometry args={[0.8, 1, 16, 8]} />
          <meshStandardMaterial color="#4a2c14" roughness={0.3} metalness={0.4} />
        </mesh>
      ))}

      {/* Table for the Chessboard */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[18, 0.2, 14]} />
          <meshStandardMaterial color="#5c3314" roughness={0.2} metalness={0.3} />
        </mesh>
        {/* Table Legs */}
        {[[-8.5, -6.5], [8.5, -6.5], [-8.5, 6.5], [8.5, 6.5]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.75, z]} castShadow>
            <boxGeometry args={[0.4, 1.5, 0.4]} />
            <meshStandardMaterial color="#331c0a" />
          </mesh>
        ))}
      </group>

      {/* Vintage Art Piece (Shield and Swords) */}
      <group position={[0, 9, -19.7]}>
        {/* Shield */}
        <mesh castShadow>
          <boxGeometry args={[4, 5, 0.2]} />
          <meshStandardMaterial color="#8b4513" roughness={0.4} metalness={0.6} />
        </mesh>
        {/* Shield Border */}
        <mesh position={[0, 0, 0.05]}>
          <boxGeometry args={[4.2, 5.2, 0.1]} />
          <meshStandardMaterial color="#d4af37" metalness={1} roughness={0.2} />
        </mesh>
        {/* Crossed Swords */}
        <group rotation={[0, 0, Math.PI / 4]}>
          <mesh position={[0, 0, 0.15]}>
            <boxGeometry args={[0.1, 7, 0.05]} />
            <meshStandardMaterial color="#c0c0c0" metalness={1} roughness={0.1} />
          </mesh>
        </group>
        <group rotation={[0, 0, -Math.PI / 4]}>
          <mesh position={[0, 0, 0.15]}>
            <boxGeometry args={[0.1, 7, 0.05]} />
            <meshStandardMaterial color="#c0c0c0" metalness={1} roughness={0.1} />
          </mesh>
        </group>
      </group>

      {/* Side Wall Banners */}
      {[-19.7, 19.7].map((x) => (
        <group key={x} position={[x, 10, 0]} rotation={[0, x > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
          <mesh castShadow>
            <boxGeometry args={[6, 10, 0.1]} />
            <meshStandardMaterial color="#4d1a14" roughness={0.9} />
          </mesh>
          {/* Banner Gold Trim */}
          <mesh position={[0, 0, 0.06]}>
            <boxGeometry args={[6.2, 0.2, 0.05]} />
            <meshStandardMaterial color="#d4af37" metalness={1} />
          </mesh>
          <mesh position={[0, -5, 0.06]}>
            <boxGeometry args={[6.2, 0.5, 0.05]} />
            <meshStandardMaterial color="#d4af37" metalness={1} />
          </mesh>
        </group>
      ))}

      {/* Corner Lights - Increased Intensity */}
      {[[-18, 14, -18], [18, 14, -18], [-18, 14, 18], [18, 14, 18]].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <mesh>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial emissive="#ffbd52" emissiveIntensity={2} color="#fff" />
          </mesh>
          <pointLight intensity={3} distance={50} color="#ffbd52" />
        </group>
      ))}

      {/* Additional Light for Black Side */}
      <pointLight position={[0, 12, 12]} intensity={4} color="#fff" />
      <pointLight position={[0, 12, -12]} intensity={3} color="#fff" />
      <pointLight position={[15, 10, 0]} intensity={2} color="#fff" />
      <pointLight position={[-15, 10, 0]} intensity={2} color="#fff" />
      <ambientLight intensity={0.4} />
    </group>
  );
}

function CapturedPieces({ pieces, side, squareSize, color, pieceSet }: { pieces: string[], side: 'left' | 'right', squareSize: number, color: 'w' | 'b', pieceSet: string }) {
  const rackWidth = squareSize * 1.6;
  const rackHeight = 0.2;
  const rackLength = squareSize * 8.6;
  
  return (
    <group position={[side === 'left' ? -squareSize * 5.8 : squareSize * 5.8, -0.05, 0]}>
      {/* Rack Base */}
      <mesh receiveShadow>
        <boxGeometry args={[rackWidth, rackHeight, rackLength]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.8} />
      </mesh>
      
      {/* Rack Side Rails (the "gap" look) */}
      <mesh position={[rackWidth * 0.48, rackHeight * 0.8, 0]}>
        <boxGeometry args={[0.08, 0.2, rackLength]} />
        <meshStandardMaterial color="#333" roughness={0.1} metalness={0.9} />
      </mesh>
      <mesh position={[-rackWidth * 0.48, rackHeight * 0.8, 0]}>
        <boxGeometry args={[0.08, 0.2, rackLength]} />
        <meshStandardMaterial color="#333" roughness={0.1} metalness={0.9} />
      </mesh>

      {/* Pieces in the rack */}
      {pieces.map((type, i) => {
        const row = Math.floor(i / 2);
        const col = i % 2;
        // Arrange pieces in a grid within the rack
        const xPos = (col - 0.5) * squareSize * 0.7;
        const zPos = (row - 3.5) * squareSize * 0.9;
        
        return (
          <group key={i} position={[xPos, rackHeight / 2, zPos]}>
            <Piece type={type} color={color} position={[0, 0, 0]} pieceSet={pieceSet as any} scale={0.55} />
          </group>
        );
      })}
    </group>
  );
}
