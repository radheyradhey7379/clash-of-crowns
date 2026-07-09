export function determineMatchOutcome(
  gameOverStr: string | null,
  playerColor: 'w' | 'b' | null,
  isLocalVS: boolean
): 'win' | 'loss' | 'draw' {
  if (!gameOverStr) return 'draw';

  const lower = gameOverStr.toLowerCase();
  
  // Stalemates and draws
  if (
    lower.includes('draw') ||
    lower.includes('stalemate') ||
    lower.includes('insufficient') ||
    lower.includes('repetition') ||
    lower.includes('fifty')
  ) {
    return 'draw';
  }

  if (isLocalVS) {
    return 'win'; // Local pass-and-play defaults to general victory screen
  }

  // Explicit strings from multiplayer or other game over triggers
  if (lower.includes('you won')) {
    return 'win';
  }
  if (lower.includes('opponent won') || lower.includes('defeat')) {
    return 'loss';
  }

  // Checkmate or resignation
  if (lower.includes('victory') || lower.includes('checkmate') || lower.includes('resign')) {
    // If it explicitly starts with "victory" or "defeat" (from resignation/multiplayer)
    if (lower.startsWith('victory')) {
      return 'win';
    }
    if (lower.startsWith('defeat')) {
      return 'loss';
    }

    // Otherwise, check color winner prefix (e.g. "WHITE VICTORY", "BLACK VICTORY")
    const isWhiteWinner = lower.includes('white');
    const isBlackWinner = lower.includes('black');

    if (isWhiteWinner) {
      return playerColor === 'w' ? 'win' : 'loss';
    }
    if (isBlackWinner) {
      return playerColor === 'b' ? 'win' : 'loss';
    }
  }

  return 'loss';
}
