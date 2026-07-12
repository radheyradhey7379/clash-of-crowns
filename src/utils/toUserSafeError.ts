/**
 * src/utils/toUserSafeError.ts
 * Centralized user-safe error sanitizer for Clash of Crowns.
 * Prevents leakage of internal technical details, stack traces,
 * database paths, network endpoints, or engine debugging telemetry.
 */

export interface SafeErrorResult {
  message: string;
  internalDetails?: string; // Only populated/logged in dev/test environment
}

export function toUserSafeError(error: any, context?: string): SafeErrorResult {
  const isDevOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));

  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const lowerMsg = rawMessage.toLowerCase();

  // Initialize a generic fallback message
  let safeMessage = "Something went wrong. Please restart the match.";

  // 1. Context-based Routing (Highest Precedence)
  if (context === 'billing' || context === 'purchase') {
    if (lowerMsg.includes('cancel') || lowerMsg.includes('user_canceled')) {
      safeMessage = "Purchase cancelled.";
    } else if (lowerMsg.includes('pending')) {
      safeMessage = "Purchase pending. Please wait.";
    } else if (lowerMsg.includes('restore') || lowerMsg.includes('activepurchases')) {
      safeMessage = "Restore failed. Please try again.";
    } else if (lowerMsg.includes('verify') || lowerMsg.includes('verification') || lowerMsg.includes('token')) {
      safeMessage = "Purchase verification failed. Please try again.";
    } else if (lowerMsg.includes('premium')) {
      safeMessage = "Premium required.";
    } else {
      safeMessage = "Purchase verification failed. Please try again.";
    }
  } else if (context === 'auth') {
    safeMessage = "Session expired. Please sign in again.";
  } else if (context === 'deleteData') {
    safeMessage = "This feature is currently unavailable.";
  } else if (context === 'leaderboard') {
    safeMessage = "This feature is currently unavailable.";
  } else if (context === 'network' || context === 'database') {
    safeMessage = "Connection issue. Please try again.";
  } else if (context === 'engine' || context === 'wasm') {
    if (lowerMsg.includes('timeout') || lowerMsg.includes('too long')) {
      safeMessage = "Engine is taking too long. Retrying move.";
    } else if (lowerMsg.includes('rejected') || lowerMsg.includes('invalid') || lowerMsg.includes('legal')) {
      safeMessage = "Move rejected. Please resync.";
    } else if (lowerMsg.includes('load') || lowerMsg.includes('instantiate') || lowerMsg.includes('compile')) {
      safeMessage = "Unable to load. Please retry.";
    } else if (lowerMsg.includes('analysis') || lowerMsg.includes('stockfish')) {
      safeMessage = "Analysis unavailable. Please try again.";
    } else {
      safeMessage = "Unable to load. Please retry.";
    }
  }
  // 2. Keyword-based Routing (Fallback when context is not specified or did not match context branch)
  else {
    if (lowerMsg.includes('purchase') || lowerMsg.includes('billing') || lowerMsg.includes('receipt') || lowerMsg.includes('gpa.')) {
      if (lowerMsg.includes('cancel') || lowerMsg.includes('user_canceled')) {
        safeMessage = "Purchase cancelled.";
      } else if (lowerMsg.includes('pending')) {
        safeMessage = "Purchase pending. Please wait.";
      } else if (lowerMsg.includes('verify') || lowerMsg.includes('verification') || lowerMsg.includes('token')) {
        safeMessage = "Purchase verification failed. Please try again.";
      } else if (lowerMsg.includes('restore') || lowerMsg.includes('activepurchases')) {
        safeMessage = "Restore failed. Please try again.";
      } else if (lowerMsg.includes('premium')) {
        safeMessage = "Premium required.";
      } else {
        safeMessage = "Purchase verification failed. Please try again.";
      }
    } else if (lowerMsg.includes('auth') || lowerMsg.includes('login') || lowerMsg.includes('unauthorized') || lowerMsg.includes('unauthenticated') || lowerMsg.includes('sign-in') || lowerMsg.includes('sessionexpired') || lowerMsg.includes('session lock')) {
      safeMessage = "Session expired. Please sign in again.";
    } else if (lowerMsg.includes('firebase') || lowerMsg.includes('firestore') || lowerMsg.includes('websocket') || lowerMsg.includes('connection') || lowerMsg.includes('network') || lowerMsg.includes('reconnect') || lowerMsg.includes('rtt') || lowerMsg.includes('latency') || lowerMsg.includes('fetch') || lowerMsg.includes('endpoint')) {
      safeMessage = "Connection issue. Please try again.";
    } else if (lowerMsg.includes('wasm') || lowerMsg.includes('webassembly') || lowerMsg.includes('panic') || lowerMsg.includes('rust') || lowerMsg.includes('load') || lowerMsg.includes('worker') || lowerMsg.includes('analysis') || lowerMsg.includes('stockfish') || lowerMsg.includes('engine')) {
      if (lowerMsg.includes('timeout') || lowerMsg.includes('too long')) {
        safeMessage = "Engine is taking too long. Retrying move.";
      } else if (lowerMsg.includes('rejected') || lowerMsg.includes('invalid') || lowerMsg.includes('legal')) {
        safeMessage = "Move rejected. Please resync.";
      } else if (lowerMsg.includes('load') || lowerMsg.includes('instantiate') || lowerMsg.includes('compile')) {
        safeMessage = "Unable to load. Please retry.";
      } else if (lowerMsg.includes('analysis') || lowerMsg.includes('stockfish')) {
        safeMessage = "Analysis unavailable. Please try again.";
      } else {
        safeMessage = "Unable to load. Please retry.";
      }
    } else if (lowerMsg.includes('delete')) {
      safeMessage = "This feature is currently unavailable.";
    } else if (lowerMsg.includes('leaderboard')) {
      safeMessage = "This feature is currently unavailable.";
    }
  }

  // Final validation sweep: make sure NO sensitive words are leaked in safeMessage
  const sensitiveWords = [
    'rtt', 'latency', 'debug', 'internal', 'stack', 'trace', 'firebase', 'firestore', 'websocket',
    'endpoint', 'token', 'bearer', 'panic', 'rust', 'wasm', 'evaluator', 'randomerror', 'errornoise',
    'alphabeta', 'quiescence', 'nodesvisited', 'apikey', 'secret', 'env', 'uid', 'collection', 'path',
    'document', 'unauthorized', ' GPA.'
  ];

  for (const word of sensitiveWords) {
    if (safeMessage.toLowerCase().includes(word)) {
      safeMessage = "Something went wrong. Please restart the match.";
      break;
    }
  }

  // Developer logging
  if (isDevOrTest) {
    console.warn(`[toUserSafeError] Sanitized raw error in context "${context}":`, error);
  }

  return {
    message: safeMessage,
    internalDetails: isDevOrTest ? rawMessage : undefined
  };
}
