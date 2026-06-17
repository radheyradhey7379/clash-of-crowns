import { CommentaryTone, CommentaryTrigger } from './commentaryTypes';

export const COMMENTARY_LINES: Record<CommentaryTone, Partial<Record<CommentaryTrigger, string[]>>> = {
  friendly: {
    match_start: [
      "Let's have a great game!",
      "Good luck! May the best player win.",
      "Ready for a friendly duel? Make your first move!"
    ],
    normal_move: [
      "A solid move. Building your defense nicely.",
      "Nice move. Let's see how I respond.",
      "Interesting square selection. Keep going!"
    ],
    capture: [
      "Nice capture! Every piece counts.",
      "You took my piece! Fair play.",
      "A clean trade. The game heats up!"
    ],
    check: [
      "Check! A good attacking idea.",
      "King under pressure! Nice check.",
      "I need to defend my King now."
    ],
    checkmate: [
      "Checkmate! Brilliant game, congratulations!",
      "Wow, mate! You played amazingly.",
      "Outstanding play! That checkmate was beautiful."
    ],
    castle: [
      "Safety first! Safe castling.",
      "A wise move, your King is safe now."
    ],
    promotion: [
      "Pawn promotion! A new Queen is born.",
      "Incredible! That pawn worked hard for promotion."
    ],
    good_move: [
      "Nice move! Pressure build ho raha hai.",
      "A clever idea. You are playing well!",
      "That move makes things interesting."
    ],
    blunder_warning: [
      "Oh, that might have been a slip! Be careful.",
      "Are you sure about that move?",
      "Hmm, looks like a tiny mistake."
    ],
    endgame_pressure: [
      "Only a few pieces left. Stay focused!",
      "Endgame is here. Let's finish strong!"
    ]
  },
  encouraging: {
    match_start: [
      "Believe in your moves, you can do this!",
      "Let's play! Every game is a learning step."
    ],
    normal_move: [
      "Step by step. Consistent play leads to victory.",
      "Good square choice. Development is key."
    ],
    capture: [
      "Excellent capture! Keep that momentum.",
      "Great trade! You've got this."
    ],
    check: [
      "Keep pushing! King is in check.",
      "Fantastic check, keep finding those attacks."
    ],
    checkmate: [
      "You got the mate! Brilliant victory!",
      "Fantastic! Your efforts paid off."
    ],
    castle: [
      "Great castling. Now your king is secure.",
      "Perfect defensive setup."
    ],
    promotion: [
      "Yes! A new queen! Incredible work.",
      "Promotion! That's how we do it."
    ],
    good_move: [
      "Amazing move! You have great vision.",
      "Perfect positioning! Keep it up."
    ],
    blunder_warning: [
      "Don't worry about mistakes. Stay calm and refocus.",
      "It's just one slip, you can still fight back!",
      "Take your time on the next moves."
    ],
    endgame_pressure: [
      "You've fought well. Let's bring this home!",
      "The finish line is near. Keep your focus."
    ]
  },
  funny: {
    match_start: [
      "Let's play, but please don't take all my pieces!",
      "Brace yourself! My pawns are highly motivated today."
    ],
    normal_move: [
      "Hmm, moving forward. Solid as a rock.",
      "A mysterious move. Are you tricking me?",
      "No turning back now!"
    ],
    capture: [
      "Oho, piece gaya picnic pe!",
      "Nom nom, thanks for the trade!",
      "My piece was tired anyway."
    ],
    check: [
      "Alert! King is sweating!",
      "Check! Who called the guards?",
      "Whoa, watch the king!"
    ],
    checkmate: [
      "Boom! Checkmate. That was quick!",
      "Game over! Who ordered the defeat?",
      "Rest in peace, my king."
    ],
    castle: [
      "King went to hide in his castle!",
      "Tucked away safe and sound."
    ],
    promotion: [
      "My pawn went shopping and bought a crown!",
      "Behold the new royalty!"
    ],
    good_move: [
      "Oho, grandmaster moves only!",
      "Did you see that on the internet?",
      "Wow, my processor is warming up."
    ],
    blunder_warning: [
      "Oops! Free gift for me?",
      "Was that a ghost move?",
      "My eyes or was that a blunder?"
    ],
    endgame_pressure: [
      "It's getting lonely on the board.",
      "Survival of the fittest!"
    ]
  },
  tactical: {
    match_start: [
      "Match start. Let's see your opening preparation.",
      "Ready. Time to test our positional understanding."
    ],
    normal_move: [
      "Positionally sound. Maintaining tension.",
      "Developing pieces toward active squares.",
      "A quiet move. Preparing the next phase."
    ],
    capture: [
      "Good capture. Opponent ki structure weak ho rahi hai.",
      "Material trade completed. Positional balance changes.",
      "Target eliminated. Pawn structure modified."
    ],
    check: [
      "Check. Forcing a response.",
      "King is checked. Tempo gained.",
      "Deflection check. Interesting."
    ],
    checkmate: [
      "Checkmate. Positional choke completed.",
      "Tactical execution successful. Good game."
    ],
    castle: [
      "Castling complete. Connecting the rooks.",
      "King safety secured. Shift to offensive."
    ],
    promotion: [
      "Promotion achieved. Endgame advantage established.",
      "Pawn reached the 8th rank. Decisive threat."
    ],
    good_move: [
      "High quality move. Controlling key squares.",
      "Excellent coordinate control. Strong move."
    ],
    blunder_warning: [
      "Inaccuracy detected. Weakness created in your structure.",
      "That square lacks sufficient protection.",
      "Tactical vulnerability exposed."
    ],
    endgame_pressure: [
      "Endgame reached. King activity is paramount.",
      "Precision is critical in this minor piece ending."
    ]
  },
  serious: {
    match_start: [
      "The game begins. Let your moves speak.",
      "Concentrate. A mistake will cost you."
    ],
    normal_move: [
      "You advance. I observe.",
      "A standard maneuver.",
      "The layout slowly changes."
    ],
    capture: [
      "Capture. The board grows emptier.",
      "Piece removed. The struggle continues.",
      "Material claimed. Back to defense."
    ],
    check: [
      "King is checked. Resolve the threat.",
      "Direct attack. King must move."
    ],
    checkmate: [
      "Checkmate. The king falls.",
      "The game is concluded."
    ],
    castle: [
      "Castling. King secured."
    ],
    promotion: [
      "Promotion. A major piece joins the fight."
    ],
    good_move: [
      "A precise choice. Hard to counter.",
      "A calculated strike. Well done."
    ],
    blunder_warning: [
      "A severe error. You have compromised your position.",
      "A costly mistake.",
      "Unfortunate move."
    ],
    endgame_pressure: [
      "The final stand. Every step is final.",
      "Only the strongest minds will survive the endgame."
    ]
  },
  boss: {
    match_start: [
      "You dare challenge the crown? Step forward.",
      "Let us see if your skills match your confidence."
    ],
    normal_move: [
      "The crown notices your attack.",
      "A simple move. It will not save you.",
      "I anticipate your every step."
    ],
    capture: [
      "Piece taken. Your defense is crumbling.",
      "A minor sacrifice. You are losing ground."
    ],
    check: [
      "Check. The crown commands attention.",
      "Kneel before the check."
    ],
    checkmate: [
      "Checkmate. The crown remains supreme.",
      "You fought, but the throne belongs to me."
    ],
    castle: [
      "I retreat only to strike harder."
    ],
    promotion: [
      "A new crown rises. But it is not mine."
    ],
    good_move: [
      "Impressionable. Yet, the outcome is set.",
      "A worthy attempt. But futile in the end."
    ],
    blunder_warning: [
      "Folly. You throw away your chances.",
      "A tragic blunder. The crown will show no mercy."
    ],
    endgame_pressure: [
      "Your pieces dwindle. Your time is running out.",
      "The endgame belongs to the throne."
    ]
  },
  neutral: {
    match_start: [
      "Match started. Good luck to both players!",
      "The duel begins. Make your moves."
    ],
    capture: [
      "Capture made. Material is taken.",
      "A piece is captured.",
      "Exchange completed."
    ],
    check: [
      "Check! The King is under attack.",
      "King in check. Defense is required."
    ],
    checkmate: [
      "Checkmate! The match is over.",
      "Checkmate. Magnificent match!"
    ],
    castle: [
      "Castling completed.",
      "King castled and rooks connected."
    ],
    promotion: [
      "Pawn promoted!",
      "Promotion! A new piece enters the board."
    ],
    endgame_pressure: [
      "Endgame phase. Material is scarce.",
      "Entering the final stages of the match."
    ],
    good_move: [],
    blunder_warning: [],
    normal_move: [],
    match_win: [
      "White wins! Excellent performance.",
      "Checkmate! White claims the victory."
    ],
    match_loss: [
      "Black wins! Outstanding gameplay.",
      "Checkmate! Black claims the victory."
    ],
    match_draw: [
      "The match ends in a draw.",
      "Draw declared. Well played by both sides."
    ]
  }
};
