use crate::rooms::room_errors::RoomError;
use crate::rooms::room_state::{RoomState, RoomStatus};
use crate::state::AppState;
use crate::ws::protocol::{ClientMessage, ServerMessage};
use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use shakmaty::Position;
use std::sync::Arc;
use tokio::sync::mpsc;

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
    let mut authenticated_display_name: Option<String> = None;
    let mut authenticated_rating: Option<i32> = None;
    let mut active_room_id: Option<String> = None;
    let mut connection_id: Option<String> = None;

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
                        Ok(verified_uid) => {
                            authenticated_uid = Some(verified_uid.clone());
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
                move_number,
                from,
                to,
                promotion,
                fen_after,
                san,
                client_message_id,
            } => {
                match state.room_manager.submit_move(
                    &room_id,
                    uid,
                    move_number,
                    &from,
                    &to,
                    promotion.clone(),
                    &fen_after,
                ) {
                    Ok(mut room) => {
                        let next_fen = room.fen.clone();
                        let was_completed = room.status == RoomStatus::Completed;

                        // Echo move acceptance to sender
                        let accept_msg = ServerMessage::MoveAccepted {
                            room_id: room_id.clone(),
                            move_number,
                            fen_after: next_fen.clone(),
                            current_turn: room.current_turn.clone(),
                            client_message_id: client_message_id.clone(),
                        };
                        let _ = tx.send(Message::Text(serde_json::to_string(&accept_msg).unwrap()));

                        // Route move to opponent
                        let opponent_uid = if room.white.as_ref().map(|w| &w.uid) == Some(uid) {
                            room.black.as_ref().map(|b| &b.uid)
                        } else {
                            room.white.as_ref().map(|w| &w.uid)
                        };

                        if let Some(opp_uid) = opponent_uid {
                            let opp_msg = ServerMessage::OpponentMove {
                                room_id: room_id.clone(),
                                move_number,
                                from,
                                to,
                                promotion,
                                fen_after: next_fen.clone(),
                                san,
                            };
                            state.send_to_user(
                                opp_uid,
                                Message::Text(serde_json::to_string(&opp_msg).unwrap()),
                            );
                        }

                        if was_completed {
                            // Determine outcome and reasons
                            let setup: shakmaty::fen::Fen = next_fen.parse().unwrap();
                            let pos: shakmaty::Chess = setup
                                .into_position(shakmaty::CastlingMode::Standard)
                                .unwrap();
                            let is_checkmate = pos.is_checkmate();

                            let (result_str, reason_str) = if is_checkmate {
                                let res = if pos.turn() == shakmaty::Color::White {
                                    "black_win"
                                } else {
                                    "white_win"
                                };
                                (res, "checkmate")
                            } else {
                                (
                                    "draw",
                                    if pos.is_stalemate() {
                                        "stalemate"
                                    } else {
                                        "insufficient_material"
                                    },
                                )
                            };

                            if room.mode == crate::rooms::room_state::RoomMode::RankedArena {
                                // Finalize ranked ELO changes authoritatively
                                if let Some(mut r_mut) = state.room_manager.get_room_mut(&room_id) {
                                    if let Ok((ranked_res, ver_id, ver_hash, timestamp)) =
                                        crate::ranked::ranked_result::finalize_ranked_match(
                                            &mut r_mut, uid, result_str, reason_str,
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
                                            new_rating_white: r_mut
                                                .white
                                                .as_ref()
                                                .map(|w| w.rating)
                                                .unwrap_or(1200)
                                                + ranked_res.rating_delta_white,
                                            new_rating_black: r_mut
                                                .black
                                                .as_ref()
                                                .map(|b| b.rating)
                                                .unwrap_or(1200)
                                                + ranked_res.rating_delta_black,
                                            verification_hash: ver_hash,
                                        };
                                        let json = serde_json::to_string(&verified_msg).unwrap();
                                        let ws_msg = Message::Text(json);
                                        if let Some(ref w) = r_mut.white {
                                            state.send_to_user(&w.uid, ws_msg.clone());
                                        }
                                        if let Some(ref b) = r_mut.black {
                                            state.send_to_user(&b.uid, ws_msg.clone());
                                        }
                                        room = r_mut.clone();
                                    }
                                }
                            } else {
                                // Friend Match ended due to checkmate or draw
                                let winner_uid = if result_str == "white_win" {
                                    room.white.as_ref().map(|w| w.uid.clone())
                                } else if result_str == "black_win" {
                                    room.black.as_ref().map(|b| b.uid.clone())
                                } else {
                                    None
                                };

                                if let Ok(updated_room) = state
                                    .room_manager
                                    .end_match(&room_id, RoomStatus::Completed)
                                {
                                    let end_msg = ServerMessage::MatchEnded {
                                        room_id: room_id.clone(),
                                        result: result_str.to_string(),
                                        reason: reason_str.to_string(),
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
                                    room = updated_room;
                                }
                            }
                        }

                        broadcast_room_state(&state, &room);
                    }
                    Err(err) => {
                        let err_msg = ServerMessage::Error {
                            code: "move_rejected".to_string(),
                            message: err.to_string(),
                            client_message_id,
                        };
                        let _ = tx.send(Message::Text(serde_json::to_string(&err_msg).unwrap()));
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
