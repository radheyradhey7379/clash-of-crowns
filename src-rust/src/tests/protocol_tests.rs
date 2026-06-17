#[cfg(test)]
mod tests {
    use crate::auth::token::verify_token_dev_or_firebase_later;
    use crate::ranked::ranked_result::finalize_ranked_match;
    use crate::rooms::room_errors::RoomError;
    use crate::rooms::room_manager::RoomManager;
    use crate::rooms::room_state::{RoomMode, RoomStatus};

    #[test]
    fn test_protocol_version_mismatch() {
        let res = verify_token_dev_or_firebase_later(Some("uid123"), None, Some("0.9.0"));
        assert!(matches!(
            res,
            Err(RoomError::ProtocolVersionMismatch { .. })
        ));

        let res_ok = verify_token_dev_or_firebase_later(Some("uid123"), None, Some("1.0.0"));
        assert!(res_ok.is_ok());
    }

    #[test]
    fn test_room_lifecycle_create_waiting() {
        let manager = RoomManager::new();
        let room = manager.create_room(
            None,
            RoomMode::Friend,
            "host_123".to_string(),
            "Host Player".to_string(),
            1200,
        );

        assert_eq!(room.status, RoomStatus::Waiting);
        assert!(room.white.is_some());
        assert!(room.black.is_none());
        assert_eq!(room.white.unwrap().uid, "host_123");
    }

    #[test]
    fn test_room_lifecycle_join_ready() {
        let manager = RoomManager::new();
        let _room = manager.create_room(
            Some("room_abc".to_string()),
            RoomMode::Friend,
            "host_123".to_string(),
            "Host Player".to_string(),
            1200,
        );

        let joined = manager
            .join_room("room_abc", "guest_456", "Guest Player", 1200)
            .unwrap();
        assert_eq!(joined.status, RoomStatus::Ready);
        assert!(joined.black.is_some());
        assert_eq!(joined.black.unwrap().uid, "guest_456");
    }

    #[test]
    fn test_room_lifecycle_both_ready_active() {
        let manager = RoomManager::new();
        let _ = manager.create_room(
            Some("room_abc".to_string()),
            RoomMode::Friend,
            "host_123".to_string(),
            "Host Player".to_string(),
            1200,
        );
        let _ = manager
            .join_room("room_abc", "guest_456", "Guest Player", 1200)
            .unwrap();

        // Host ready
        let room_host_ready = manager.player_ready("room_abc", "host_123").unwrap();
        assert_eq!(room_host_ready.status, RoomStatus::Ready);

        // Guest ready -> active
        let room_both_ready = manager.player_ready("room_abc", "guest_456").unwrap();
        assert_eq!(room_both_ready.status, RoomStatus::Active);
    }

    #[test]
    fn test_move_validation_wrong_turn_rejected() {
        let manager = RoomManager::new();
        let _ = manager.create_room(
            Some("room_abc".to_string()),
            RoomMode::Friend,
            "host_123".to_string(),
            "Host Player".to_string(),
            1200,
        );
        let _ = manager
            .join_room("room_abc", "guest_456", "Guest Player", 1200)
            .unwrap();
        let _ = manager.player_ready("room_abc", "host_123").unwrap();
        let _ = manager.player_ready("room_abc", "guest_456").unwrap();

        // Guest (Black, 'b') tries to move first, but current_turn is White ('w')
        let res = manager.submit_move(
            "room_abc",
            "guest_456",
            1,
            "e7",
            "e5",
            None,
            "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        );
        assert_eq!(res, Err(RoomError::OutOfTurn));
    }

    #[test]
    fn test_move_validation_wrong_move_number_rejected() {
        let manager = RoomManager::new();
        let _ = manager.create_room(
            Some("room_abc".to_string()),
            RoomMode::Friend,
            "host_123".to_string(),
            "Host Player".to_string(),
            1200,
        );
        let _ = manager
            .join_room("room_abc", "guest_456", "Guest Player", 1200)
            .unwrap();
        let _ = manager.player_ready("room_abc", "host_123").unwrap();
        let _ = manager.player_ready("room_abc", "guest_456").unwrap();

        // Host submits move with move_number = 2 (expected 1)
        let res = manager.submit_move(
            "room_abc",
            "host_123",
            2,
            "e2",
            "e4",
            None,
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        );
        assert!(matches!(
            res,
            Err(RoomError::MoveNumberMismatch {
                expected: 1,
                got: 2
            })
        ));
    }

    #[test]
    fn test_move_validation_duplicate_move_rejected() {
        let manager = RoomManager::new();
        let _ = manager.create_room(
            Some("room_abc".to_string()),
            RoomMode::Friend,
            "host_123".to_string(),
            "Host Player".to_string(),
            1200,
        );
        let _ = manager
            .join_room("room_abc", "guest_456", "Guest Player", 1200)
            .unwrap();
        let _ = manager.player_ready("room_abc", "host_123").unwrap();
        let _ = manager.player_ready("room_abc", "guest_456").unwrap();

        // 1st move by Host (White)
        let r1 = manager
            .submit_move(
                "room_abc",
                "host_123",
                1,
                "e2",
                "e4",
                None,
                "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
            )
            .unwrap();
        assert_eq!(r1.move_count, 1);

        // Duplicate submit of move 1 by Host
        let res = manager.submit_move(
            "room_abc",
            "host_123",
            1,
            "e2",
            "e4",
            None,
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        );
        assert_eq!(res, Err(RoomError::DuplicateMoveNumber(1)));
    }

    #[test]
    fn test_move_validation_completed_room_rejects_moves() {
        let manager = RoomManager::new();
        let _ = manager.create_room(
            Some("room_abc".to_string()),
            RoomMode::Friend,
            "host_123".to_string(),
            "Host Player".to_string(),
            1200,
        );
        let _ = manager
            .join_room("room_abc", "guest_456", "Guest Player", 1200)
            .unwrap();
        let _ = manager.player_ready("room_abc", "host_123").unwrap();
        let _ = manager.player_ready("room_abc", "guest_456").unwrap();

        // Terminate the room
        let _ = manager
            .end_match("room_abc", RoomStatus::Completed)
            .unwrap();

        // Try to move
        let res = manager.submit_move(
            "room_abc",
            "host_123",
            1,
            "e2",
            "e4",
            None,
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        );
        assert_eq!(res, Err(RoomError::TerminalRoomState));
    }

    #[test]
    fn test_reconnect_same_uid_works() {
        let manager = RoomManager::new();
        let _ = manager.create_room(
            Some("room_abc".to_string()),
            RoomMode::Friend,
            "host_123".to_string(),
            "Host Player".to_string(),
            1200,
        );
        let _ = manager
            .join_room("room_abc", "guest_456", "Guest Player", 1200)
            .unwrap();

        // Disconnect host
        let disconnected = manager.mark_disconnected("room_abc", "host_123").unwrap();
        assert!(!disconnected.white.unwrap().connected);

        // Reconnect host
        let reconnected = manager.mark_reconnected("room_abc", "host_123").unwrap();
        assert!(reconnected.white.unwrap().connected);
    }

    // --- NEW RANKED ARENA TESTS ---

    #[test]
    fn test_friend_room_cannot_submit_ranked_result() {
        let manager = RoomManager::new();
        let _ = manager.create_room(
            Some("room_friend".to_string()),
            RoomMode::Friend,
            "host_123".to_string(),
            "Host Player".to_string(),
            1200,
        );
        let _ = manager
            .join_room("room_friend", "guest_456", "Guest Player", 1200)
            .unwrap();
        let _ = manager.player_ready("room_friend", "host_123").unwrap();
        let mut room = manager.player_ready("room_friend", "guest_456").unwrap();

        let res = finalize_ranked_match(&mut room, "host_123", "white_win", "checkmate");
        assert_eq!(res.unwrap_err(), "invalid_room_mode");
    }

    #[test]
    fn test_nonparticipant_result_rejected() {
        let manager = RoomManager::new();
        let _ = manager.create_room(
            Some("room_ranked".to_string()),
            RoomMode::RankedArena,
            "host_123".to_string(),
            "Host Player".to_string(),
            1200,
        );
        let _ = manager
            .join_room("room_ranked", "guest_456", "Guest Player", 1200)
            .unwrap();
        let _ = manager.player_ready("room_ranked", "host_123").unwrap();
        let mut room = manager.player_ready("room_ranked", "guest_456").unwrap();

        let res = finalize_ranked_match(&mut room, "intruder_999", "white_win", "checkmate");
        assert_eq!(res.unwrap_err(), "not_a_participant");
    }

    #[test]
    fn test_ranked_room_finalizes_once() {
        let manager = RoomManager::new();
        let _ = manager.create_room(
            Some("room_ranked".to_string()),
            RoomMode::RankedArena,
            "host_123".to_string(),
            "Host Player".to_string(),
            1200,
        );
        let _ = manager
            .join_room("room_ranked", "guest_456", "Guest Player", 1200)
            .unwrap();
        let _ = manager.player_ready("room_ranked", "host_123").unwrap();
        let mut room = manager.player_ready("room_ranked", "guest_456").unwrap();

        // Increment move count to be sane (>= 2) and set a valid checkmate FEN where White wins
        room.move_count = 2;
        room.fen = "r1bqkbnr/pppp1Qpp/2n5/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4".to_string();

        let res1 = finalize_ranked_match(&mut room, "host_123", "white_win", "checkmate");
        assert!(res1.is_ok());

        // Try second time
        let res2 = finalize_ranked_match(&mut room, "host_123", "white_win", "checkmate");
        assert_eq!(res2.unwrap_err(), "room_not_active");
    }

    #[test]
    fn test_suspicious_low_move_count_flagged() {
        let manager = RoomManager::new();
        let _ = manager.create_room(
            Some("room_ranked".to_string()),
            RoomMode::RankedArena,
            "host_123".to_string(),
            "Host Player".to_string(),
            1200,
        );
        let _ = manager
            .join_room("room_ranked", "guest_456", "Guest Player", 1200)
            .unwrap();
        let _ = manager.player_ready("room_ranked", "host_123").unwrap();
        let mut room = manager.player_ready("room_ranked", "guest_456").unwrap();

        // move count is 0, which is too low for checkmate
        let res = finalize_ranked_match(&mut room, "host_123", "white_win", "checkmate");
        assert_eq!(res.unwrap_err(), "suspicious_match_too_short");
    }
}
