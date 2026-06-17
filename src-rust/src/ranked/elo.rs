pub fn calculate_elo_change(
    white_rating: i32,
    black_rating: i32,
    result: &str, // "white_win" | "black_win" | "draw" | "abandoned"
) -> (i32, i32, i32, i32) {
    // (new_white, new_black, delta_white, delta_black)
    let score_white = match result {
        "white_win" => 1.0,
        "black_win" => 0.0,
        "draw" => 0.5,
        "abandoned" => 0.5, // treated as draw
        _ => 0.5,
    };

    let expected_white = 1.0 / (1.0 + 10.0f64.powf((black_rating - white_rating) as f64 / 400.0));
    let expected_black = 1.0 / (1.0 + 10.0f64.powf((white_rating - black_rating) as f64 / 400.0));

    let k = 32.0;
    let new_white_raw = white_rating as f64 + k * (score_white - expected_white);
    let new_black_raw = black_rating as f64 + k * (1.0 - score_white - expected_black);

    let mut new_white = new_white_raw.round() as i32;
    let mut new_black = new_black_raw.round() as i32;

    if new_white < 100 {
        new_white = 100;
    }
    if new_black < 100 {
        new_black = 100;
    }

    let delta_white = new_white - white_rating;
    let delta_black = new_black - black_rating;

    (new_white, new_black, delta_white, delta_black)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_equal_rating_win() {
        let (new_w, new_b, delta_w, delta_b) = calculate_elo_change(1200, 1200, "white_win");
        assert_eq!(delta_w, 16);
        assert_eq!(delta_b, -16);
        assert_eq!(new_w, 1216);
        assert_eq!(new_b, 1184);
    }

    #[test]
    fn test_equal_rating_draw() {
        let (new_w, new_b, delta_w, delta_b) = calculate_elo_change(1200, 1200, "draw");
        assert_eq!(delta_w, 0);
        assert_eq!(delta_b, 0);
        assert_eq!(new_w, 1200);
        assert_eq!(new_b, 1200);
    }

    #[test]
    fn test_underdog_win() {
        let (_new_w, _new_b, delta_w, delta_b) = calculate_elo_change(1000, 1400, "white_win");
        assert!(delta_w > 16, "Delta white was {}", delta_w);
        assert!(delta_b < -16, "Delta black was {}", delta_b);
    }

    #[test]
    fn test_favorite_win() {
        let (_new_w, _new_b, delta_w, delta_b) = calculate_elo_change(1400, 1000, "white_win");
        assert!(delta_w < 16, "Delta white was {}", delta_w);
        assert!(delta_b > -16, "Delta black was {}", delta_b);
    }

    #[test]
    fn test_rating_floor_respected() {
        let (new_w, _new_b, delta_w, _delta_b) = calculate_elo_change(100, 1500, "black_win");
        assert_eq!(new_w, 100);
        assert_eq!(delta_w, 0);
    }
}
