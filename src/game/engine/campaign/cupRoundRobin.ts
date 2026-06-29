import { AICharacter } from '../../../types/aiProgression';

export interface CupParticipant {
  id: string;
  name: string;
  isPlayer: boolean;
  characterId?: string; // For AI
}

export interface CupMatch {
  matchIndex: number; // 0 to 5
  whiteId: string;
  blackId: string;
  result: 'white_win' | 'black_win' | 'draw' | 'pending';
  isSimulated: boolean;
}

export interface CupRoundRobinState {
  cupId: 1 | 2 | 3;
  participants: CupParticipant[]; // [player, ai1, ai2, ai3]
  matches: CupMatch[]; // 6 matches total
  pointsTable: Record<string, number>; // participantId -> points
  currentMatchIndex: number;
  status: 'in_progress' | 'completed';
  winnerId: string | null;
}

export function createCupRoundRobin(
  cupId: 1 | 2 | 3,
  playerId: string,
  playerName: string,
  ai1: AICharacter,
  ai2: AICharacter,
  ai3: AICharacter
): CupRoundRobinState {
  const participants: CupParticipant[] = [
    { id: playerId, name: playerName, isPlayer: true },
    { id: ai1.id, name: ai1.name, isPlayer: false, characterId: ai1.id },
    { id: ai2.id, name: ai2.name, isPlayer: false, characterId: ai2.id },
    { id: ai3.id, name: ai3.name, isPlayer: false, characterId: ai3.id }
  ];

  const matches = generateSchedule(participants);

  return {
    cupId,
    participants,
    matches,
    pointsTable: {
      [playerId]: 0,
      [ai1.id]: 0,
      [ai2.id]: 0,
      [ai3.id]: 0
    },
    currentMatchIndex: 0,
    status: 'in_progress',
    winnerId: null
  };
}

export function generateSchedule(participants: CupParticipant[]): CupMatch[] {
  const p = participants;
  // Alternating sides for player's matches:
  // Match 0: Player (White) vs AI 1 (Black)
  // Match 1: AI 2 (White) vs Player (Black)
  // Match 2: Player (White) vs AI 3 (Black)
  // AI-vs-AI matches:
  // Match 3: AI 1 vs AI 2
  // Match 4: AI 1 vs AI 3
  // Match 5: AI 2 vs AI 3
  return [
    { matchIndex: 0, whiteId: p[0].id, blackId: p[1].id, result: 'pending', isSimulated: false },
    { matchIndex: 1, whiteId: p[2].id, blackId: p[0].id, result: 'pending', isSimulated: false },
    { matchIndex: 2, whiteId: p[0].id, blackId: p[3].id, result: 'pending', isSimulated: false },
    { matchIndex: 3, whiteId: p[1].id, blackId: p[2].id, result: 'pending', isSimulated: true },
    { matchIndex: 4, whiteId: p[1].id, blackId: p[3].id, result: 'pending', isSimulated: true },
    { matchIndex: 5, whiteId: p[2].id, blackId: p[3].id, result: 'pending', isSimulated: true }
  ];
}

export function recordMatchResult(
  state: CupRoundRobinState,
  matchIndex: number,
  result: 'white_win' | 'black_win' | 'draw'
): CupRoundRobinState {
  const nextState = { ...state };
  nextState.matches = [...state.matches];
  nextState.matches[matchIndex] = { ...nextState.matches[matchIndex], result };
  nextState.pointsTable = { ...state.pointsTable };

  // Recalculate points for all completed matches
  // Reset pointsTable first
  for (const p of nextState.participants) {
    nextState.pointsTable[p.id] = 0;
  }

  for (const m of nextState.matches) {
    if (m.result === 'white_win') {
      nextState.pointsTable[m.whiteId] = (nextState.pointsTable[m.whiteId] || 0) + 3;
    } else if (m.result === 'black_win') {
      nextState.pointsTable[m.blackId] = (nextState.pointsTable[m.blackId] || 0) + 3;
    } else if (m.result === 'draw') {
      nextState.pointsTable[m.whiteId] = (nextState.pointsTable[m.whiteId] || 0) + 1;
      nextState.pointsTable[m.blackId] = (nextState.pointsTable[m.blackId] || 0) + 1;
    }
  }

  if (isCupComplete(nextState)) {
    nextState.status = 'completed';
    nextState.winnerId = determineWinner(nextState);
  } else {
    // Move to next pending non-simulated match index
    let nextIdx = matchIndex + 1;
    while (nextIdx < nextState.matches.length && nextState.matches[nextIdx].isSimulated) {
      nextIdx++;
    }
    nextState.currentMatchIndex = Math.min(5, nextIdx);
  }

  return nextState;
}

export function isCupComplete(state: CupRoundRobinState): boolean {
  return state.matches.every(m => m.result !== 'pending');
}

export function calculateSonnebornBerger(state: CupRoundRobinState): Record<string, number> {
  const sb: Record<string, number> = {};
  for (const p of state.participants) {
    sb[p.id] = 0;
  }

  for (const match of state.matches) {
    if (match.result === 'pending') continue;
    const w = match.whiteId;
    const b = match.blackId;
    const w_pts = state.pointsTable[w] || 0;
    const b_pts = state.pointsTable[b] || 0;

    if (match.result === 'white_win') {
      sb[w] += b_pts; // Winner gets opponent's full points
    } else if (match.result === 'black_win') {
      sb[b] += w_pts; // Winner gets opponent's full points
    } else if (match.result === 'draw') {
      sb[w] += b_pts * 0.5; // Draw gets half of opponent's points
      sb[b] += w_pts * 0.5;
    }
  }
  return sb;
}

export function determineWinner(state: CupRoundRobinState): string | null {
  if (!isCupComplete(state)) return null;

  const sbScores = calculateSonnebornBerger(state);
  
  // Sort participants by:
  // 1. Points descending
  // 2. Sonneborn-Berger score descending
  // 3. Head-to-head winner
  // 4. Player priority fallback
  const sorted = [...state.participants].sort((pA, pB) => {
    const ptsA = state.pointsTable[pA.id] || 0;
    const ptsB = state.pointsTable[pB.id] || 0;
    if (ptsA !== ptsB) return ptsB - ptsA;

    const sbA = sbScores[pA.id] || 0;
    const sbB = sbScores[pB.id] || 0;
    if (sbA !== sbB) return sbB - sbA;

    // Head-to-head tiebreak
    const h2h = state.matches.find(m =>
      (m.whiteId === pA.id && m.blackId === pB.id) || (m.whiteId === pB.id && m.blackId === pA.id)
    );
    if (h2h && h2h.result !== 'pending') {
      if (h2h.result === 'white_win') {
        return h2h.whiteId === pB.id ? 1 : -1;
      } else if (h2h.result === 'black_win') {
        return h2h.blackId === pB.id ? 1 : -1;
      }
    }

    // Player wins if still tied
    if (pA.isPlayer) return -1;
    if (pB.isPlayer) return 1;

    return 0;
  });

  return sorted[0]?.id || null;
}

export async function simulateAiVsAiMatch(
  ai1: AICharacter,
  ai2: AICharacter
): Promise<'white_win' | 'black_win' | 'draw'> {
  try {
    const RUST_URL = import.meta.env.VITE_RUST_ENGINE_URL || 'http://localhost:3001';
    const response = await fetch(`${RUST_URL}/engine/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_a_id: ai1.id,
        profile_a_engine: ai1.engine,
        profile_a_depth: ai1.depth,
        profile_a_noise: ai1.errorNoiseCp,
        profile_b_id: ai2.id,
        profile_b_engine: ai2.engine,
        profile_b_depth: ai2.depth,
        profile_b_noise: ai2.errorNoiseCp,
        max_moves: 200
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.result as 'white_win' | 'black_win' | 'draw';
    }
  } catch (err) {
    console.warn("AI simulation failed, falling back to random result", err);
  }
  
  // Fallback if simulation fails
  const rnd = Math.random();
  if (rnd < 0.4) return 'white_win';
  if (rnd < 0.8) return 'black_win';
  return 'draw';
}
