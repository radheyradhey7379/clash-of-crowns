import { AICharacter } from '../../../types/aiProgression';

export interface CupParticipant {
  id: string;
  name: string;
  isPlayer: boolean;
  characterId?: string; // For AI
}

export interface CupMatch {
  matchIndex: number; // 0, 1, 2
  whiteId: string;
  blackId: string;
  result: 'white_win' | 'black_win' | 'draw' | 'pending';
  isSimulated: boolean;
}

export interface CupRoundRobinState {
  cupId: 1 | 2 | 3;
  participants: CupParticipant[]; // [player, ai1, ai2]
  matches: [CupMatch, CupMatch, CupMatch];
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
  ai2: AICharacter
): CupRoundRobinState {
  const participants: CupParticipant[] = [
    { id: playerId, name: playerName, isPlayer: true },
    { id: ai1.id, name: ai1.name, isPlayer: false, characterId: ai1.id },
    { id: ai2.id, name: ai2.name, isPlayer: false, characterId: ai2.id }
  ];

  const matches = generateSchedule(participants);

  return {
    cupId,
    participants,
    matches: [matches[0], matches[1], matches[2]] as [CupMatch, CupMatch, CupMatch],
    pointsTable: {
      [playerId]: 0,
      [ai1.id]: 0,
      [ai2.id]: 0
    },
    currentMatchIndex: 0,
    status: 'in_progress',
    winnerId: null
  };
}

export function generateSchedule(participants: CupParticipant[]): CupMatch[] {
  const p = participants;
  return [
    { matchIndex: 0, whiteId: p[0].id, blackId: p[1].id, result: 'pending', isSimulated: false },
    { matchIndex: 1, whiteId: p[0].id, blackId: p[2].id, result: 'pending', isSimulated: false },
    { matchIndex: 2, whiteId: p[1].id, blackId: p[2].id, result: 'pending', isSimulated: true }
  ];
}

export function recordMatchResult(
  state: CupRoundRobinState,
  matchIndex: number,
  result: 'white_win' | 'black_win' | 'draw'
): CupRoundRobinState {
  const nextState = { ...state };
  nextState.matches = [...state.matches] as [CupMatch, CupMatch, CupMatch];
  nextState.matches[matchIndex] = { ...nextState.matches[matchIndex], result };
  nextState.pointsTable = { ...state.pointsTable };

  const match = nextState.matches[matchIndex];
  if (result === 'white_win') {
    nextState.pointsTable[match.whiteId] += 3;
  } else if (result === 'black_win') {
    nextState.pointsTable[match.blackId] += 3;
  } else if (result === 'draw') {
    nextState.pointsTable[match.whiteId] += 1;
    nextState.pointsTable[match.blackId] += 1;
  }

  if (isCupComplete(nextState)) {
    nextState.status = 'completed';
    nextState.winnerId = determineWinner(nextState);
  } else {
    nextState.currentMatchIndex = matchIndex + 1;
  }

  return nextState;
}

export function isCupComplete(state: CupRoundRobinState): boolean {
  return state.matches.every(m => m.result !== 'pending');
}

export function determineWinner(state: CupRoundRobinState): string | null {
  if (!isCupComplete(state)) return null;

  const p1 = state.participants[0].id; // Player
  const p2 = state.participants[1].id;
  const p3 = state.participants[2].id;

  const pts1 = state.pointsTable[p1];
  const pts2 = state.pointsTable[p2];
  const pts3 = state.pointsTable[p3];

  let maxPts = Math.max(pts1, pts2, pts3);
  const winners = [p1, p2, p3].filter(p => state.pointsTable[p] === maxPts);

  if (winners.length === 1) {
    return winners[0];
  }

  // Tiebreak: Head-to-head
  if (winners.length === 2) {
    const w1 = winners[0];
    const w2 = winners[1];
    
    // Find their match
    const h2hMatch = state.matches.find(m => 
      (m.whiteId === w1 && m.blackId === w2) || (m.whiteId === w2 && m.blackId === w1)
    );
    
    if (h2hMatch) {
      if (h2hMatch.result === 'white_win' && h2hMatch.whiteId === w1) return w1;
      if (h2hMatch.result === 'white_win' && h2hMatch.whiteId === w2) return w2;
      if (h2hMatch.result === 'black_win' && h2hMatch.blackId === w1) return w1;
      if (h2hMatch.result === 'black_win' && h2hMatch.blackId === w2) return w2;
    }
  }

  // If still tied (e.g. 3-way tie or drawn H2H), Player advantage
  if (winners.includes(p1)) return p1;
  
  return winners[0];
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
        profile_b_id: ai2.id,
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
