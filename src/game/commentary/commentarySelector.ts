import { CommentaryContext, CommentaryReaction, CommentaryTrigger, CommentaryTone } from './commentaryTypes';
import { COMMENTARY_LINES } from './commentaryLines';
import { getMovePriority } from './moveReactionEngine';

export function getTonesForContext(context: CommentaryContext): CommentaryTone[] {
  // Correction 6: Friend Matches must stay neutral and event-based.
  if (context.roomMode === 'friend' || context.roomMode === 'online') {
    return ['neutral'];
  }

  const tier = context.tierId || '';
  if (tier === 'core' || tier === 'beginner') {
    return ['friendly', 'encouraging'];
  } else if (tier === 'learner' || tier === 'promotion_trial') {
    return ['funny', 'friendly'];
  } else if (tier === 'intermediate' || tier === 'hard') {
    return ['tactical', 'serious'];
  } else if (tier === 'master' || tier === 'grandmaster') {
    return ['boss', 'serious'];
  }

  return ['friendly', 'tactical']; // Default fallback
}

export function selectCommentaryLine(
  context: CommentaryContext,
  triggers: CommentaryTrigger[],
  lastLineText?: string
): CommentaryReaction | null {
  if (triggers.length === 0) return null;

  // 1. Sort triggers by priority (highest first)
  const sortedTriggers = [...triggers].sort((a, b) => getMovePriority(b) - getMovePriority(a));

  // 2. Determine tones to try based on character and match type
  const candidateTones = getTonesForContext(context);

  // 3. Find a trigger-tone combination that has lines
  for (const trigger of sortedTriggers) {
    // Friend match commentary stays neutral and event-based (Correction 6)
    if (context.roomMode === 'friend' || context.roomMode === 'online') {
      if (trigger === 'normal_move' || trigger === 'good_move' || trigger === 'blunder_warning') {
        continue; // Do not show normal/spam moves in Friend match
      }
    }

    for (const tone of candidateTones) {
      const toneLines = COMMENTARY_LINES[tone];
      if (!toneLines) continue;

      const lines = toneLines[trigger];
      if (lines && lines.length > 0) {
        // Filter out the last repeated line text if possible
        let availableLines = lines;
        if (lines.length > 1 && lastLineText) {
          availableLines = lines.filter(line => line !== lastLineText);
        }

        // Pick a random line
        const randomIdx = Math.floor(Math.random() * availableLines.length);
        const text = availableLines[randomIdx];

        return {
          id: `${tone}_${trigger}_${randomIdx}_${Date.now()}`,
          trigger,
          text,
          tone,
          priority: getMovePriority(trigger),
          durationMs: trigger === 'checkmate' ? 5000 : 3500
        };
      }
    }
  }

  return null;
}
