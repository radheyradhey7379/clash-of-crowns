import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CheckAttackOverlay3DProps {
  squareSize: number;
  shouldFlip: boolean;
  attackerSquares: string[];
  kingSquare: string | null;
  isCheck: boolean;
  lowGraphics?: boolean;
}

export default function CheckAttackOverlay3D({
  squareSize,
  shouldFlip,
  attackerSquares,
  kingSquare,
  isCheck,
  lowGraphics = false
}: CheckAttackOverlay3DProps) {
  const lightRef = useRef<THREE.PointLight>(null);
  const auraRef = useRef<THREE.Mesh>(null);

  // Map square name to 3D board position
  const getPosition = (squareName: string): THREE.Vector3 => {
    const c = squareName.charCodeAt(0) - 97;
    const r = parseInt(squareName[1], 10) - 1;
    const displayC = shouldFlip ? 7 - c : c;
    const displayR = shouldFlip ? 7 - r : r;
    return new THREE.Vector3(
      -(displayC - 3.5) * squareSize,
      0.12,
      (displayR - 3.5) * squareSize
    );
  };

  const kingPos = useMemo(() => {
    if (!kingSquare) return new THREE.Vector3();
    return getPosition(kingSquare);
  }, [kingSquare, shouldFlip, squareSize]);

  // Generate beams data
  const beams = useMemo(() => {
    if (!isCheck || !kingSquare || attackerSquares.length === 0) return [];
    // Show max 2 attackers to avoid clutter
    const visibleAttackers = attackerSquares.slice(0, 2);
    return visibleAttackers.map((attSquare) => {
      const start = getPosition(attSquare);
      const end = kingPos.clone();
      
      // Shift up slightly to target piece bodies
      start.y += 0.8;
      end.y += 0.8;

      const direction = end.clone().sub(start);
      const length = direction.length();
      const midpoint = start.clone().add(end).multiplyScalar(0.5);

      const directionNormalized = direction.clone().normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(up, directionNormalized);

      return {
        id: attSquare,
        length,
        midpoint,
        quaternion
      };
    });
  }, [isCheck, kingSquare, attackerSquares, kingPos, shouldFlip, squareSize]);

  useFrame((state) => {
    if (lowGraphics) return;
    const t = state.clock.getElapsedTime();
    
    // Pulse point light intensity
    if (lightRef.current) {
      lightRef.current.intensity = 2.0 + Math.sin(t * 8) * 1.0;
    }

    // Pulse red aura size & opacity
    if (auraRef.current) {
      const scale = 1.0 + Math.sin(t * 8) * 0.12;
      auraRef.current.scale.set(scale, 1, scale);
      if (auraRef.current.material) {
        (auraRef.current.material as any).opacity = 0.35 + Math.sin(t * 8) * 0.15;
      }
    }
  });

  if (!isCheck || !kingSquare || attackerSquares.length === 0) return null;

  return (
    <group>
      {/* 3D Attack Beams */}
      {beams.map((beam) => (
        <group key={beam.id} position={beam.midpoint} quaternion={beam.quaternion}>
          {/* Outer Beam Glow */}
          <mesh>
            <cylinderGeometry args={[0.08, 0.08, beam.length, 16]} />
            <meshBasicMaterial
              color="#ff3300"
              transparent
              opacity={0.3}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* Inner Sharp Core */}
          <mesh>
            <cylinderGeometry args={[0.03, 0.03, beam.length, 16]} />
            <meshBasicMaterial
              color="#ff2200"
              transparent
              opacity={0.9}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}

      {/* Pulsing King Point Light */}
      {!lowGraphics && (
        <pointLight
          ref={lightRef}
          position={[kingPos.x, kingPos.y + 1.0, kingPos.z]}
          color="#ff0000"
          intensity={2.5}
          distance={5}
        />
      )}

      {/* Checked King Base Aura (Ring at the bottom of the King piece) */}
      <mesh
        ref={auraRef}
        position={[kingPos.x, kingPos.y + 0.05, kingPos.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.3, 0.5, 32]} />
        <meshBasicMaterial
          color="#ff0000"
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
