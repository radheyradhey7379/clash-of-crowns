import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { getCheckAttackers } from '../chess-logic';

describe('Check Attackers Detection Helper', () => {
  it('check_attackers_detect_rook_check', () => {
    // Rook checks white king at e1 from e8
    const chess = new Chess('4k3/8/8/8/8/8/8/4K2r w - - 0 1');
    const res = getCheckAttackers(chess, 'w');
    expect(res.kingSquare).toBe('e1');
    expect(res.attackers).toContain('h1');
  });

  it('check_attackers_detect_bishop_check', () => {
    // Bishop checks white king at e1 from b4
    const chess = new Chess('4k3/8/8/8/1b6/8/8/4K3 w - - 0 1');
    const res = getCheckAttackers(chess, 'w');
    expect(res.kingSquare).toBe('e1');
    expect(res.attackers).toContain('b4');
  });

  it('check_attackers_detect_queen_check', () => {
    // Queen checks white king at e1 from e8, black king is on a8
    const chess = new Chess('k3q3/8/8/8/8/8/8/4K3 w - - 0 1');
    const res = getCheckAttackers(chess, 'w');
    expect(res.kingSquare).toBe('e1');
    expect(res.attackers).toContain('e8');
  });

  it('check_attackers_detect_knight_check', () => {
    // Knight checks white king at e1 from c2
    const chess = new Chess('4k3/8/8/8/8/8/2n5/4K3 w - - 0 1');
    const res = getCheckAttackers(chess, 'w');
    expect(res.kingSquare).toBe('e1');
    expect(res.attackers).toContain('c2');
  });

  it('check_attackers_detect_pawn_check', () => {
    // Pawn checks white king at e1 from d2
    const chess = new Chess('4k3/8/8/8/8/8/3p4/4K3 w - - 0 1');
    const res = getCheckAttackers(chess, 'w');
    expect(res.kingSquare).toBe('e1');
    expect(res.attackers).toContain('d2');
  });

  it('check_attackers_detect_discovered_check', () => {
    // Discovered check: Bishop on c4 checks black king on g8 when white knight moves away
    // Here we set up a direct line where bishop is checking the king
    const chess = new Chess('6k1/8/8/8/2B5/8/8/4K3 b - - 0 1');
    const res = getCheckAttackers(chess, 'b');
    expect(res.kingSquare).toBe('g8');
    expect(res.attackers).toContain('c4');
  });

  it('check_attackers_empty_when_not_check', () => {
    // Standard starting position
    const chess = new Chess();
    const res = getCheckAttackers(chess, 'w');
    expect(res.attackers.length).toBe(0);
  });

  it('check_attackers_blocked_line_not_counted', () => {
    // Rook on e8, but blocked by white pawn on e4 -> no check on e1, black king is on a8
    const chess = new Chess('k3r3/8/8/8/4P3/8/8/4K3 w - - 0 1');
    const res = getCheckAttackers(chess, 'w');
    expect(res.attackers.length).toBe(0);
  });
});
