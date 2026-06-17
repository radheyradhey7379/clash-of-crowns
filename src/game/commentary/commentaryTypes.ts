export type CommentaryTrigger =
  | 'normal_move'
  | 'capture'
  | 'check'
  | 'checkmate'
  | 'castle'
  | 'promotion'
  | 'blunder_warning'
  | 'good_move'
  | 'endgame_pressure'
  | 'opponent_threat'
  | 'ai_thinking'
  | 'match_start'
  | 'match_win'
  | 'match_loss'
  | 'match_draw';

export type CommentaryTone =
  | 'friendly'
  | 'funny'
  | 'serious'
  | 'tactical'
  | 'boss'
  | 'encouraging'
  | 'neutral';

export interface CommentaryContext {
  roomMode: 'comp' | 'friend' | 'offline' | 'online';
  playerColor: 'w' | 'b';
  currentTurn: 'w' | 'b';
  moveNumber: number;
  san?: string;
  from?: string;
  to?: string;
  piece?: string;
  capturedPiece?: string;
  isCapture?: boolean;
  isCheck?: boolean;
  isCheckmate?: boolean;
  isCastle?: boolean;
  isPromotion?: boolean;
  isEndgame?: boolean;
  characterId?: string;
  tierId?: string;
  // Heuristics
  lastEval?: number;
  currEval?: number;
  totalPieces?: number;
}

export interface CommentaryReaction {
  id: string;
  trigger: CommentaryTrigger;
  text: string;
  tone: CommentaryTone;
  priority: number;
  durationMs: number;
}
