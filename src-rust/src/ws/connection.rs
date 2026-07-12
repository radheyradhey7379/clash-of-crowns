use crate::rooms::room_errors::RoomError;
use crate::rooms::room_state::{RoomState, RoomStatus};
use crate::state::AppState;
use crate::ws::protocol::{ClientMessage, ServerMessage};
use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use shakmaty::Position;
use std::sync::Arc;
use tokio::sync::mpsc;

fn log_security_event(
    event_type: &str,
    severity: &str,
    user_id: Option<&str>,
    room_id: Option<&str>,
    match_id: Option<&str>,
    session_id: Option<&str>,
    payload_summary: &str,
) {
    let node_url =
        std::env::var("NODE_SERVER_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    let host_port = if node_url.contains("localhost:") {
        node_url
            .split("localhost:")
            .nth(1)
            .map(|p| format!("127.0.0.1:{}", p))
            .unwrap_or_else(|| "127.0.0.1:3000".to_string())
    } else if node_url.contains("127.0.0.1:") {
        node_url
            .split("127.0.0.1:")
            .nth(1)
            .map(|p| format!("127.0.0.1:{}", p))
            .unwrap_or_else(|| "127.0.0.1:3000".to_string())
    } else {
        "127.0.0.1:3000".to_string()
    };

    let body = serde_json::json!({
        "eventType": event_type,
        "severity": severity,
        "userId": user_id,
        "roomId": room_id,
        "matchId": match_id,
        "sessionId": session_id,
        "payloadSummary": payload_summary,
    });

    let payload = serde_json::to_string(&body).unwrap();
    let request = format!(
        "POST /api/security/event HTTP/1.1\r\n\
         Host: {}\r\n\
         Content-Type: application/json\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\r\n\
         {}",
        host_port,
        payload.len(),
        payload
    );

    tokio::spawn(async move {
        use tokio::io::AsyncWriteExt;
        use tokio::net::TcpStream;
        if let Ok(mut stream) = TcpStream::connect(host_port).await {
            let _ = stream.write_all(request.as_bytes()).await;
        }
    });
}

pub async fn handle_connection(socket: WebSocket, state: Arc<AppState>) {
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Create channel for outbound messages to this client
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    // Spawn task to write outbound messages to the WebSocket
    let write_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    let mut authenticated_uid: Option<String> = None;
    let mut authenticated_session_id: Option<String> = None;
    let mut authenticated_display_name: Option<String> = None;
    let mut authenticated_rating: Option<i32> = None;
    let mut active_room_id: Option<String> = None;
    let mut connection_id: Option<String> = None;

    // Rate limiter trackers
    let mut last_move_time: u64 = 0;
    let mut invalid_move_count: u32 = 0;
    let mut last_invalid_time: u64 = 0;
    let mut heartbeat_count: u32 = 0;
    let mut last_heartbeat_time: u64 = 0;
    let mut join_count: u32 = 0;
    let mut last_join_time: u64 = 0;

    // Receive loop
    while let Some(result) = ws_receiver.next().await {
        let msg = match result {
            Ok(m) => m,
            Err(e) => {
                tracing::warn!("WebSocket error: {:?}", e);
                break;
            }
        };

        let text = match msg {
            Message::Text(t) => t,
            Message::Close(_) => {
                break;
            }
            _ => continue, // Ignore binary, ping/pong frames
        };

        // Parse ClientMessage
        let client_msg: ClientMessage = match serde_json::from_str(&text) {
            Ok(m) => m,
            Err(err) => {
                let err_msg = ServerMessage::Error {
                    code: "invalid_json".to_string(),
                    message: format!("Failed to parse message JSON: {}", err),
                    client_message_id: None,
                };
                let _ = tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                continue;
            }
        };

        // Enforce Authentication as first step
        if authenticated_uid.is_none() {
            match client_msg {
                ClientMessage::Auth {
                    uid,
                    display_name,
                    token,
                    protocol_version,
                    rating,
                } => {
                    match crate::auth::token::verify_token_dev_or_firebase_later(
                        Some(&uid),
                        token.as_deref(),
                        protocol_version.as_deref(),
                    ) {
                        Ok((verified_uid, session_id)) => {
                            authenticated_uid = Some(verified_uid.clone());
                            authenticated_session_id = Some(session_id);
                            authenticated_display_name = Some(display_name);
                            // NOTE: Frontend Auth rating is not a trusted production authority.
                            // In Phase 30, we accept it as a dev/local input. Production implementations
                            // should fetch this value securely from a backend database / Admin SDK / Firestore.
                            authenticated_rating = Some(rating.unwrap_or(1200));

                            // Register connection, replacing old connection if same UID connects
                            let conn_id = state.register_connection(&verified_uid, tx.clone());
                            connection_id = Some(conn_id);

                            let ok_msg = ServerMessage::AuthOk { uid: verified_uid };
                            let _ = tx.send(Message::Text(serde_json::to_string(&ok_msg).unwrap()));
                        }
                        Err(RoomError::ProtocolVersionMismatch { expected, got }) => {
                            let err_msg = ServerMessage::Error {
                                code: "protocol_version_mismatch".to_string(),
                                message: format!(
                                    "Expected protocol version {}, got {}",
                                    expected, got
                                ),
                                client_message_id: None,
                            };
                            let _ =
                                tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                            break; // Terminate connection
                        }
                        Err(err) => {
                            let err_msg = ServerMessage::Error {
                                code: "auth_failed".to_string(),
                                message: err.to_string(),
                                client_message_id: None,
                            };
                            let _ =
                                tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                            break; // Terminate connection
                        }
                    }
                }
                _ => {
                    let err_msg = ServerMessage::Error {
                        code: "auth_required".to_string(),
                        message: "Auth message must be the first message sent".to_string(),
                        client_message_id: None,
                    };
                    let _ = tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                    break; // Terminate connection
                }
            }
            continue;
        }

        // Process message for authenticated users
        let uid = authenticated_uid.as_ref().unwrap();
        let display_name = authenticated_display_name.as_ref().unwrap();

        match client_msg {
            ClientMessage::Auth { .. } => {
                let err_msg = ServerMessage::Error {
                    code: "already_authenticated".to_string(),
                    message: "You are already authenticated".to_string(),
                    client_message_id: None,
                };
                let _ = tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
            }
            ClientMessage::CreateRoom { room_id, mode } => {
                let room_mode = match mode.as_str() {
                    "ranked_arena" => crate::rooms::room_state::RoomMode::RankedArena,
                    _ => crate::rooms::room_state::RoomMode::Friend,
                };
                let rating = authenticated_rating.unwrap_or(1200);

                let mut room_joined = false;
                if room_mode == crate::rooms::room_state::RoomMode::RankedArena {
                    if let Some(waiting_id) = state.room_manager.find_waiting_ranked_room(uid) {
                        if let Ok(room) =
                            state
                                .room_manager
                                .join_room(&waiting_id, uid, display_name, rating)
                        {
                            active_room_id = Some(waiting_id.clone());
                            let joined_msg = ServerMessage::RoomJoined {
                                room_id: waiting_id.clone(),
                                color: "b".to_string(),
                            };
                            let _ =
                                tx.send(Message::Text(serde_json::to_string(&joined_msg).unwrap()));
                            broadcast_room_state(&state, &room);
                            room_joined = true;
                        }
                    }
                }

                if !room_joined {
                    let room = state.room_manager.create_room(
                        room_id,
                        room_mode,
                        uid.clone(),
                        display_name.clone(),
                        rating,
                    );
                    active_room_id = Some(room.room_id.clone());

                    let res = ServerMessage::RoomCreated {
                        room_id: room.room_id.clone(),
                    };
                    let _ = tx.send(Message::Text(serde_json::to_string(&res).unwrap()));
                    broadcast_room_state(&state, &room);
                }
            }
            ClientMessage::JoinRoom { room_id } => {
                let now = chrono::Utc::now().timestamp_millis() as u64;
                if now - last_join_time < 1000 {
                    join_count += 1;
                    if join_count > 3 {
                        log_security_event(
                            "rate_limit_hit",
                            "low",
                            Some(uid),
                            Some(&room_id),
                            None,
                            None,
                            "Join room request spam",
                        );
                        let err_msg = ServerMessage::Error {
                            code: "rate_limited".to_string(),
                            message: "Spamming room join too fast. Slow down.".to_string(),
                            client_message_id: None,
                        };
                        let _ = tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                        continue;
                    }
                } else {
                    join_count = 0;
                }
                last_join_time = now;

                let rating = authenticated_rating.unwrap_or(1200);
                match state
                    .room_manager
                    .join_room(&room_id, uid, display_name, rating)
                {
                    Ok(room) => {
                        active_room_id = Some(room_id.clone());

                        let color = if room.white.as_ref().map(|w| &w.uid) == Some(uid) {
                            "w"
                        } else {
                            "b"
                        };

                        let joined_msg = ServerMessage::RoomJoined {
                            room_id: room_id.clone(),
                            color: color.to_string(),
                        };
                        let _ = tx.send(Message::Text(serde_json::to_string(&joined_msg).unwrap()));
                        broadcast_room_state(&state, &room);
                    }
                    Err(err) => {
                        let err_msg = ServerMessage::Error {
                            code: "join_failed".to_string(),
                            message: err.to_string(),
                            client_message_id: None,
                        };
                        let _ = tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                    }
                }
            }
            ClientMessage::PlayerReady { room_id } => {
                match state.room_manager.player_ready(&room_id, uid) {
                    Ok(room) => {
                        broadcast_room_state(&state, &room);
                    }
                    Err(err) => {
                        let err_msg = ServerMessage::Error {
                            code: "ready_failed".to_string(),
                            message: err.to_string(),
                            client_message_id: None,
                        };
                        let _ = tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                    }
                }
            }
            ClientMessage::SubmitMove {
                room_id,
                match_id,
                player_id,
                session_id,
                move_uci,
                client_move_number,
                client_fen_before,
                timestamp: _,
            } => {
                let auth_session_id = authenticated_session_id.as_ref().unwrap();

                // 1. Forged UID Check
                if player_id != *uid {
                    log_security_event(
                        "forged_user_id",
                        "high",
                        Some(uid),
                        Some(&room_id),
                        Some(&match_id),
                        Some(&session_id),
                        &format!(
                            "Claimed player_id {} does not match token UID {}",
                            player_id, uid
                        ),
                    );
                    let err_msg = ServerMessage::Error {
                        code: "auth_failed".to_string(),
                        message: "Forged user ID rejected.".to_string(),
                        client_message_id: None,
                    };
                    let _ = tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                    continue;
                }

                // 2. Session ID Match Check
                if session_id != *auth_session_id {
                    log_security_event(
                        "invalid_session",
                        "high",
                        Some(uid),
                        Some(&room_id),
                        Some(&match_id),
                        Some(&session_id),
                        &format!(
                            "Claimed session_id {} does not match token session ID {}",
                            session_id, auth_session_id
                        ),
                    );
                    let err_msg = ServerMessage::Error {
                        code: "invalid_session_id".to_string(),
                        message: "Invalid session ID. Please log in again.".to_string(),
                        client_message_id: None,
                    };
                    let _ = tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                    continue;
                }

                // 3. Move Submission Rate Limiting
                let now_ms = chrono::Utc::now().timestamp_millis() as u64;
                if now_ms - last_move_time < 200 {
                    log_security_event(
                        "rate_limit_hit",
                        "low",
                        Some(uid),
                        Some(&room_id),
                        Some(&match_id),
                        Some(&session_id),
                        "Move submitted too quickly (< 200ms)",
                    );
                    let err_msg = ServerMessage::Error {
                        code: "rate_limited".to_string(),
                        message: "Spamming moves too fast.".to_string(),
                        client_message_id: None,
                    };
                    let _ = tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                    continue;
                }
                last_move_time = now_ms;

                // 4. Room Existence Check
                let room_opt = state.room_manager.get_room(&room_id);
                if room_opt.is_none() {
                    let err_msg = ServerMessage::Error {
                        code: "room_not_found".to_string(),
                        message: format!("Room {} not found", room_id),
                        client_message_id: None,
                    };
                    let _ = tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                    continue;
                }
                let room = room_opt.unwrap();

                // 5. Room Active & Player Presence Checks
                let is_white = room.white.as_ref().map(|w| w.uid == *uid).unwrap_or(false);
                let is_black = room.black.as_ref().map(|b| b.uid == *uid).unwrap_or(false);
                if !is_white && !is_black {
                    log_security_event(
                        "invalid_move_attempt",
                        "medium",
                        Some(uid),
                        Some(&room_id),
                        Some(&match_id),
                        Some(&session_id),
                        "User not registered in this match trying to submit move",
                    );
                    let err_msg = ServerMessage::Error {
                        code: "not_in_room".to_string(),
                        message: "You are not in this match.".to_string(),
                        client_message_id: None,
                    };
                    let _ = tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                    continue;
                }

                if room.status != RoomStatus::Active {
                    log_security_event(
                        "move_after_game_over",
                        "medium",
                        Some(uid),
                        Some(&room_id),
                        Some(&match_id),
                        Some(&session_id),
                        "Move submitted after game has already ended",
                    );
                    let err_msg = ServerMessage::Error {
                        code: "match_not_active".to_string(),
                        message: "Match is already over or inactive.".to_string(),
                        client_message_id: None,
                    };
                    let _ = tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                    continue;
                }

                // 6. Turn Color Validation
                let player_color = if is_white { "w" } else { "b" };
                if room.current_turn != player_color {
                    log_security_event(
                        "move_out_of_turn",
                        "medium",
                        Some(uid),
                        Some(&room_id),
                        Some(&match_id),
                        Some(&session_id),
                        "Attempted out-of-turn move",
                    );
                    let err_msg = ServerMessage::Error {
                        code: "out_of_turn".to_string(),
                        message: "It is not your turn.".to_string(),
                        client_message_id: None,
                    };
                    let _ = tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                    continue;
                }

                // 7. Move Number Validation
                if client_move_number != room.move_count + 1 {
                    log_security_event(
                        "invalid_move_attempt",
                        "medium",
                        Some(uid),
                        Some(&room_id),
                        Some(&match_id),
                        Some(&session_id),
                        &format!(
                            "Expected move {}, got {}",
                            room.move_count + 1,
                            client_move_number
                        ),
                    );
                    let err_msg = ServerMessage::Error {
                        code: "move_number_mismatch".to_string(),
                        message: "Move sequence mismatch.".to_string(),
                        client_message_id: None,
                    };
                    let _ = tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                    continue;
                }

                // 8. Client FEN Mismatch (Resync) Check
                if client_fen_before != room.fen {
                    log_security_event(
                        "fake_fen",
                        "medium",
                        Some(uid),
                        Some(&room_id),
                        Some(&match_id),
                        Some(&session_id),
                        &format!(
                            "FEN mismatch! Server: {}, Client: {}",
                            room.fen, client_fen_before
                        ),
                    );
                    let resync = ServerMessage::ResyncRequired {
                        official_fen: room.fen.clone(),
                        move_number: room.move_count,
                    };
                    let _ = tx.send(Message::Text(serde_json::to_string(&resync).unwrap()));
                    continue;
                }

                // 9. Parse and Validate Move via Shakmaty
                if move_uci.len() < 4 {
                    let err_msg = ServerMessage::Error {
                        code: "invalid_move".to_string(),
                        message: "Invalid move format.".to_string(),
                        client_message_id: None,
                    };
                    let _ = tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                    continue;
                }
                let from = &move_uci[0..2];
                let to = &move_uci[2..4];
                let promotion = if move_uci.len() >= 5 {
                    Some(move_uci[4..5].to_string())
                } else {
                    None
                };

                let validation = crate::chess::move_validator::validate_and_execute_move(
                    &room.fen,
                    from,
                    to,
                    promotion.as_deref(),
                );

                match validation {
                    Ok((next_fen, is_checkmate, is_stalemate, is_draw)) => {
                        // Apply move to server state
                        if let Some(mut r_mut) = state.room_manager.get_room_mut(&room_id) {
                            r_mut.fen = next_fen.clone();
                            r_mut.current_turn = if r_mut.current_turn == "w" {
                                "b".to_string()
                            } else {
                                "w".to_string()
                            };
                            r_mut.move_count = client_move_number;

                            if is_checkmate || is_stalemate || is_draw {
                                r_mut.status = RoomStatus::Completed;
                            }

                            r_mut.updated_at_ms = chrono::Utc::now().timestamp_millis();
                            let updated_room = r_mut.clone();
                            drop(r_mut); // Release lock

                            // Echo move accepted to sender
                            let accept_msg = ServerMessage::MoveAccepted {
                                room_id: room_id.clone(),
                                move_number: client_move_number,
                                fen_after: next_fen.clone(),
                                current_turn: updated_room.current_turn.clone(),
                                client_message_id: None,
                            };
                            let _ =
                                tx.send(Message::Text(serde_json::to_string(&accept_msg).unwrap()));

                            // Broadcast verified move to opponent
                            let opponent_uid = if is_white {
                                updated_room.black.as_ref().map(|b| &b.uid)
                            } else {
                                updated_room.white.as_ref().map(|w| &w.uid)
                            };

                            if let Some(opp_uid) = opponent_uid {
                                let opp_msg = ServerMessage::OpponentMove {
                                    room_id: room_id.clone(),
                                    move_number: client_move_number,
                                    from: from.to_string(),
                                    to: to.to_string(),
                                    promotion,
                                    fen_after: next_fen.clone(),
                                    san: None,
                                };
                                state.send_to_user(
                                    opp_uid,
                                    Message::Text(serde_json::to_string(&opp_msg).unwrap()),
                                );
                            }

                            // Finalize match on end state
                            if is_checkmate || is_stalemate || is_draw {
                                let result_str = if is_checkmate {
                                    if player_color == "w" {
                                        "white_win"
                                    } else {
                                        "black_win"
                                    }
                                } else {
                                    "draw"
                                };
                                let reason_str = if is_checkmate {
                                    "checkmate"
                                } else if is_stalemate {
                                    "stalemate"
                                } else {
                                    "insufficient_material"
                                };

                                if updated_room.mode
                                    == crate::rooms::room_state::RoomMode::RankedArena
                                {
                                    if let Some(mut r_mut2) =
                                        state.room_manager.get_room_mut(&room_id)
                                    {
                                        if let Ok((ranked_res, ver_id, ver_hash, timestamp)) =
                                            crate::ranked::ranked_result::finalize_ranked_match(
                                                &mut r_mut2,
                                                uid,
                                                result_str,
                                                reason_str,
                                            )
                                        {
                                            let verified_msg = ServerMessage::VerifiedResult {
                                                room_id: room_id.clone(),
                                                ranked_match_id: ver_id,
                                                white_uid: ranked_res.white_uid.clone(),
                                                black_uid: ranked_res.black_uid.clone(),
                                                result: ranked_res.result,
                                                reason: ranked_res.reason,
                                                move_count: ranked_res.move_count,
                                                timestamp,
                                                duration_ms: ranked_res.duration_ms,
                                                rating_delta_white: ranked_res.rating_delta_white,
                                                rating_delta_black: ranked_res.rating_delta_black,
                                                new_rating_white: r_mut2
                                                    .white
                                                    .as_ref()
                                                    .map(|w| w.rating)
                                                    .unwrap_or(1200)
                                                    + ranked_res.rating_delta_white,
                                                new_rating_black: r_mut2
                                                    .black
                                                    .as_ref()
                                                    .map(|b| b.rating)
                                                    .unwrap_or(1200)
                                                    + ranked_res.rating_delta_black,
                                                verification_hash: ver_hash,
                                            };
                                            let ws_msg = Message::Text(
                                                serde_json::to_string(&verified_msg).unwrap(),
                                            );
                                            if let Some(ref w) = r_mut2.white {
                                                state.send_to_user(&w.uid, ws_msg.clone());
                                            }
                                            if let Some(ref b) = r_mut2.black {
                                                state.send_to_user(&b.uid, ws_msg.clone());
                                            }
                                        }
                                    }
                                } else {
                                    let winner_uid = if result_str == "white_win" {
                                        updated_room.white.as_ref().map(|w| w.uid.clone())
                                    } else if result_str == "black_win" {
                                        updated_room.black.as_ref().map(|b| b.uid.clone())
                                    } else {
                                        None
                                    };

                                    if let Ok(updated_room2) = state
                                        .room_manager
                                        .end_match(&room_id, RoomStatus::Completed)
                                    {
                                        let end_msg = ServerMessage::MatchEnded {
                                            room_id: room_id.clone(),
                                            result: result_str.to_string(),
                                            reason: reason_str.to_string(),
                                            winner_uid,
                                        };
                                        let ws_msg =
                                            Message::Text(serde_json::to_string(&end_msg).unwrap());
                                        if let Some(ref w) = updated_room2.white {
                                            state.send_to_user(&w.uid, ws_msg.clone());
                                        }
                                        if let Some(ref b) = updated_room2.black {
                                            state.send_to_user(&b.uid, ws_msg.clone());
                                        }
                                    }
                                }
                            }
                            broadcast_room_state(&state, &updated_room);
                        }
                    }
                    Err(_) => {
                        // Illegal move rejected instantly. Do not mutate server board, do not broadcast.
                        let err_msg = ServerMessage::Error {
                            code: "invalid_move".to_string(),
                            message: "Invalid move. Move rejected.".to_string(),
                            client_message_id: None,
                        };
                        let _ = tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));

                        // Increment suspicious invalid move counter
                        let now = chrono::Utc::now().timestamp_millis() as u64;
                        if now - last_invalid_time > 30000 {
                            invalid_move_count = 0;
                        }
                        invalid_move_count += 1;
                        last_invalid_time = now;

                        if invalid_move_count >= 5 {
                            log_security_event(
                                "repeated_invalid_moves",
                                "critical",
                                Some(uid),
                                Some(&room_id),
                                Some(&match_id),
                                Some(&session_id),
                                &format!("Suspicious repeated illegal moves: UCI={} (5th attempt, kicking player)", move_uci),
                            );
                            // Disconnect/Kick
                            break;
                        } else if invalid_move_count >= 3 {
                            log_security_event(
                                "repeated_invalid_moves",
                                "medium",
                                Some(uid),
                                Some(&room_id),
                                Some(&match_id),
                                Some(&session_id),
                                &format!("Suspicious repeated illegal moves: UCI={} (3rd attempt warning)", move_uci),
                            );
                        } else {
                            log_security_event(
                                "invalid_move_attempt",
                                "low",
                                Some(uid),
                                Some(&room_id),
                                Some(&match_id),
                                Some(&session_id),
                                &format!("Illegal move rejected: UCI={}", move_uci),
                            );
                        }
                    }
                }
            }
            ClientMessage::OfferDraw { room_id } => {
                if let Ok(room) = state.room_manager.offer_draw(&room_id, uid) {
                    if room.status == RoomStatus::Active {
                        // Notify opponent
                        let opponent_uid = if room.white.as_ref().map(|w| &w.uid) == Some(uid) {
                            room.black.as_ref().map(|b| &b.uid)
                        } else {
                            room.white.as_ref().map(|w| &w.uid)
                        };

                        if let Some(opp_uid) = opponent_uid {
                            // Relay by sending room state update or custom warning
                            let draw_offer_notif = ServerMessage::Error {
                                code: "draw_offered".to_string(),
                                message: "Opponent has offered a draw.".to_string(),
                                client_message_id: None,
                            };
                            state.send_to_user(
                                opp_uid,
                                Message::Text(serde_json::to_string(&draw_offer_notif).unwrap()),
                            );
                        }
                    }
                }
            }
            ClientMessage::RespondDraw { room_id, accepted } => {
                if accepted {
                    if let Some(mut room) = state.room_manager.get_room_mut(&room_id) {
                        if room.mode == crate::rooms::room_state::RoomMode::RankedArena {
                            match crate::ranked::ranked_result::finalize_ranked_match(
                                &mut room,
                                uid,
                                "draw",
                                "draw_agreement",
                            ) {
                                Ok((ranked_res, ver_id, ver_hash, timestamp)) => {
                                    let verified_msg = ServerMessage::VerifiedResult {
                                        room_id: room_id.clone(),
                                        ranked_match_id: ver_id,
                                        white_uid: ranked_res.white_uid.clone(),
                                        black_uid: ranked_res.black_uid.clone(),
                                        result: ranked_res.result,
                                        reason: ranked_res.reason,
                                        move_count: ranked_res.move_count,
                                        timestamp,
                                        duration_ms: ranked_res.duration_ms,
                                        rating_delta_white: ranked_res.rating_delta_white,
                                        rating_delta_black: ranked_res.rating_delta_black,
                                        new_rating_white: room
                                            .white
                                            .as_ref()
                                            .map(|w| w.rating)
                                            .unwrap_or(1200)
                                            + ranked_res.rating_delta_white,
                                        new_rating_black: room
                                            .black
                                            .as_ref()
                                            .map(|b| b.rating)
                                            .unwrap_or(1200)
                                            + ranked_res.rating_delta_black,
                                        verification_hash: ver_hash,
                                    };

                                    let json = serde_json::to_string(&verified_msg).unwrap();
                                    let ws_msg = Message::Text(json);

                                    if let Some(ref w) = room.white {
                                        state.send_to_user(&w.uid, ws_msg.clone());
                                    }
                                    if let Some(ref b) = room.black {
                                        state.send_to_user(&b.uid, ws_msg.clone());
                                    }
                                    broadcast_room_state(&state, &room);
                                }
                                Err(err_str) => {
                                    let err_msg = ServerMessage::ResultError {
                                        room_id: room_id.clone(),
                                        code: err_str.clone(),
                                        message: format!("Verification failed: {}", err_str),
                                    };
                                    let _ = tx.send(Message::Text(
                                        serde_json::to_string(&err_msg).unwrap(),
                                    ));
                                }
                            }
                        } else {
                            if let Ok(updated_room) = state
                                .room_manager
                                .end_match(&room_id, RoomStatus::Completed)
                            {
                                let end_msg = ServerMessage::MatchEnded {
                                    room_id: room_id.clone(),
                                    result: "draw".to_string(),
                                    reason: "draw_accepted".to_string(),
                                    winner_uid: None,
                                };
                                let json = serde_json::to_string(&end_msg).unwrap();
                                let ws_msg = Message::Text(json);
                                if let Some(ref w) = updated_room.white {
                                    state.send_to_user(&w.uid, ws_msg.clone());
                                }
                                if let Some(ref b) = updated_room.black {
                                    state.send_to_user(&b.uid, ws_msg.clone());
                                }
                                broadcast_room_state(&state, &updated_room);
                            }
                        }
                    }
                } else {
                    // Send rejection error to opponent
                    if let Some(room) = state.room_manager.get_room(&room_id) {
                        let opponent_uid = if room.white.as_ref().map(|w| &w.uid) == Some(uid) {
                            room.black.as_ref().map(|b| &b.uid)
                        } else {
                            room.white.as_ref().map(|w| &w.uid)
                        };
                        if let Some(opp_uid) = opponent_uid {
                            let draw_declined = ServerMessage::Error {
                                code: "draw_declined".to_string(),
                                message: "Draw offer declined by opponent.".to_string(),
                                client_message_id: None,
                            };
                            state.send_to_user(
                                opp_uid,
                                Message::Text(serde_json::to_string(&draw_declined).unwrap()),
                            );
                        }
                    }
                }
            }
            ClientMessage::Resign { room_id } => {
                if let Some(mut room) = state.room_manager.get_room_mut(&room_id) {
                    if room.mode == crate::rooms::room_state::RoomMode::RankedArena {
                        let result_str = if room.white.as_ref().map(|w| &w.uid) == Some(uid) {
                            "black_win"
                        } else {
                            "white_win"
                        };
                        match crate::ranked::ranked_result::finalize_ranked_match(
                            &mut room, uid, result_str, "resign",
                        ) {
                            Ok((ranked_res, ver_id, ver_hash, timestamp)) => {
                                let verified_msg = ServerMessage::VerifiedResult {
                                    room_id: room_id.clone(),
                                    ranked_match_id: ver_id,
                                    white_uid: ranked_res.white_uid.clone(),
                                    black_uid: ranked_res.black_uid.clone(),
                                    result: ranked_res.result,
                                    reason: ranked_res.reason,
                                    move_count: ranked_res.move_count,
                                    timestamp,
                                    duration_ms: ranked_res.duration_ms,
                                    rating_delta_white: ranked_res.rating_delta_white,
                                    rating_delta_black: ranked_res.rating_delta_black,
                                    new_rating_white: room
                                        .white
                                        .as_ref()
                                        .map(|w| w.rating)
                                        .unwrap_or(1200)
                                        + ranked_res.rating_delta_white,
                                    new_rating_black: room
                                        .black
                                        .as_ref()
                                        .map(|b| b.rating)
                                        .unwrap_or(1200)
                                        + ranked_res.rating_delta_black,
                                    verification_hash: ver_hash,
                                };

                                let json = serde_json::to_string(&verified_msg).unwrap();
                                let ws_msg = Message::Text(json);

                                if let Some(ref w) = room.white {
                                    state.send_to_user(&w.uid, ws_msg.clone());
                                }
                                if let Some(ref b) = room.black {
                                    state.send_to_user(&b.uid, ws_msg.clone());
                                }
                                broadcast_room_state(&state, &room);
                            }
                            Err(err_str) => {
                                let err_msg = ServerMessage::ResultError {
                                    room_id: room_id.clone(),
                                    code: err_str.clone(),
                                    message: format!("Verification failed: {}", err_str),
                                };
                                let _ = tx
                                    .send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                            }
                        }
                    } else {
                        let winner_uid = if room.white.as_ref().map(|w| &w.uid) == Some(uid) {
                            room.black.as_ref().map(|b| b.uid.clone())
                        } else {
                            room.white.as_ref().map(|w| w.uid.clone())
                        };

                        if let Ok(updated_room) = state
                            .room_manager
                            .end_match(&room_id, RoomStatus::Completed)
                        {
                            let end_msg = ServerMessage::MatchEnded {
                                room_id: room_id.clone(),
                                result: "resign".to_string(),
                                reason: "player_resigned".to_string(),
                                winner_uid,
                            };
                            let json = serde_json::to_string(&end_msg).unwrap();
                            let ws_msg = Message::Text(json);
                            if let Some(ref w) = updated_room.white {
                                state.send_to_user(&w.uid, ws_msg.clone());
                            }
                            if let Some(ref b) = updated_room.black {
                                state.send_to_user(&b.uid, ws_msg.clone());
                            }
                            broadcast_room_state(&state, &updated_room);
                        }
                    }
                }
            }
            ClientMessage::SubmitResult {
                room_id,
                result,
                reason,
            } => {
                if let Some(mut room) = state.room_manager.get_room_mut(&room_id) {
                    match crate::ranked::ranked_result::finalize_ranked_match(
                        &mut room, uid, &result, &reason,
                    ) {
                        Ok((ranked_res, ver_id, ver_hash, timestamp)) => {
                            let verified_msg = ServerMessage::VerifiedResult {
                                room_id: room_id.clone(),
                                ranked_match_id: ver_id,
                                white_uid: ranked_res.white_uid.clone(),
                                black_uid: ranked_res.black_uid.clone(),
                                result: ranked_res.result,
                                reason: ranked_res.reason,
                                move_count: ranked_res.move_count,
                                timestamp,
                                duration_ms: ranked_res.duration_ms,
                                rating_delta_white: ranked_res.rating_delta_white,
                                rating_delta_black: ranked_res.rating_delta_black,
                                new_rating_white: room
                                    .white
                                    .as_ref()
                                    .map(|w| w.rating)
                                    .unwrap_or(1200)
                                    + ranked_res.rating_delta_white,
                                new_rating_black: room
                                    .black
                                    .as_ref()
                                    .map(|b| b.rating)
                                    .unwrap_or(1200)
                                    + ranked_res.rating_delta_black,
                                verification_hash: ver_hash,
                            };

                            let json = serde_json::to_string(&verified_msg).unwrap();
                            let ws_msg = Message::Text(json);

                            if let Some(ref w) = room.white {
                                state.send_to_user(&w.uid, ws_msg.clone());
                            }
                            if let Some(ref b) = room.black {
                                state.send_to_user(&b.uid, ws_msg.clone());
                            }
                            broadcast_room_state(&state, &room);
                        }
                        Err(err_str) => {
                            let err_msg = ServerMessage::ResultError {
                                room_id: room_id.clone(),
                                code: err_str.clone(),
                                message: format!("Verification failed: {}", err_str),
                            };
                            let _ =
                                tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                        }
                    }
                } else {
                    let err_msg = ServerMessage::ResultError {
                        room_id: room_id.clone(),
                        code: "room_not_found".to_string(),
                        message: "Room not found".to_string(),
                    };
                    let _ = tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
                }
            }
            ClientMessage::Heartbeat { room_id } => {
                let now = chrono::Utc::now().timestamp_millis();

                // Heartbeat spam rate limiting
                let now_u64 = now as u64;
                if now_u64 - last_heartbeat_time < 500 {
                    heartbeat_count += 1;
                    if heartbeat_count > 10 {
                        log_security_event(
                            "websocket_flood",
                            "high",
                            Some(uid),
                            room_id.as_deref(),
                            None,
                            None,
                            "Disconnecting user due to heartbeat flooding",
                        );
                        break; // disconnect!
                    }
                } else {
                    heartbeat_count = 0;
                }
                last_heartbeat_time = now_u64;

                // Handle re-connection presence updates
                if let Some(room) = crate::presence::heartbeat::handle_client_heartbeat(
                    &state.room_manager,
                    room_id.as_deref(),
                    uid,
                ) {
                    // Inform opponent of reconnection
                    let opponent_uid = if room.white.as_ref().map(|w| &w.uid) == Some(uid) {
                        room.black.as_ref().map(|b| &b.uid)
                    } else {
                        room.white.as_ref().map(|w| &w.uid)
                    };
                    if let Some(opp_uid) = opponent_uid {
                        let reconn_msg = ServerMessage::OpponentReconnected {
                            room_id: room.room_id.clone(),
                        };
                        state.send_to_user(
                            opp_uid,
                            Message::Text(serde_json::to_string(&reconn_msg).unwrap()),
                        );
                    }
                    broadcast_room_state(&state, &room);
                }

                let pong = ServerMessage::Pong { server_time: now };
                let _ = tx.send(Message::Text(serde_json::to_string(&pong).unwrap()));
            }
        }
    }

    // Clean up on disconnect
    if let Some(ref uid) = authenticated_uid {
        if let Some(ref conn_id) = connection_id {
            // Remove connection only if it hasn't been replaced by a newer connection
            if state.remove_connection(uid, conn_id) {
                if let Some(ref room_id) = active_room_id {
                    if let Some(room) = state.room_manager.mark_disconnected(room_id, uid) {
                        // Send OpponentDisconnected event to the other player
                        let opponent_uid = if room.white.as_ref().map(|w| &w.uid) == Some(uid) {
                            room.black.as_ref().map(|b| &b.uid)
                        } else {
                            room.white.as_ref().map(|w| &w.uid)
                        };

                        if let Some(opp_uid) = opponent_uid {
                            let opp_disconn = ServerMessage::OpponentDisconnected {
                                room_id: room_id.clone(),
                                reconnect_seconds: 60,
                            };
                            state.send_to_user(
                                opp_uid,
                                Message::Text(serde_json::to_string(&opp_disconn).unwrap()),
                            );
                        }
                        broadcast_room_state(&state, &room);
                    }
                }
            }
        }
    }

    // Stop write loop task
    write_task.abort();
}

fn broadcast_room_state(state: &AppState, room: &RoomState) {
    let msg = ServerMessage::RoomState {
        room_id: room.room_id.clone(),
        mode: match room.mode {
            crate::rooms::room_state::RoomMode::Friend => "friend".to_string(),
            crate::rooms::room_state::RoomMode::RankedArena => "ranked_arena".to_string(),
        },
        status: format!("{:?}", room.status).to_lowercase(),
        fen: room.fen.clone(),
        current_turn: room.current_turn.clone(),
        move_count: room.move_count,
        white_uid: room.white.as_ref().map(|w| w.uid.clone()),
        black_uid: room.black.as_ref().map(|b| b.uid.clone()),
        ranked_match_id: room.ranked_match_id.clone(),
        result_submitted: room.result_submitted,
        result_verified: room.result_verified,
    };

    let json = serde_json::to_string(&msg).unwrap();
    let ws_msg = Message::Text(json);

    if let Some(ref w) = room.white {
        state.send_to_user(&w.uid, ws_msg.clone());
    }
    if let Some(ref b) = room.black {
        state.send_to_user(&b.uid, ws_msg.clone());
    }
}
