use shakmaty::{Chess, Move, Position, Role};

pub fn score_move(pos: &Chess, m: &Move) -> i32 {
    let mut score = 0;

    // 1. Promotions
    if let Some(promoted_role) = m.promotion() {
        score += 8000;
        score += piece_value(promoted_role);
    }

    // 2. Captures (MVV-LVA)
    if let Some(victim_role) = m.capture() {
        let victim_val = piece_value(victim_role);
        let attacker_val = piece_value(m.role());
        score += 10000 + (victim_val * 10) - attacker_val;
    }

    // 3. Checks and Checkmates
    // We clone the position and test. This is slightly expensive but crucial for good ordering.
    let mut child_pos = pos.clone();
    child_pos.play_unchecked(m);

    if child_pos.is_checkmate() {
        score += 30000; // Checkmates are the highest priority
    } else if child_pos.is_check() {
        score += 5000; // Checks are also high priority
    }

    score
}

fn piece_value(role: Role) -> i32 {
    match role {
        Role::Pawn => 1,
        Role::Knight => 3,
        Role::Bishop => 3,
        Role::Rook => 5,
        Role::Queen => 9,
        Role::King => 100,
    }
}
