use std::env;
use std::fs;

use super::weights::{NnueWeights, WeightsSource, WeightsStatus};

pub struct NnueModel {
    pub weights: NnueWeights,
}

impl NnueModel {
    pub fn load() -> Self {
        // Safe fallback logic: never panic on missing weights.
        if let Ok(path) = env::var("NNUE_WEIGHTS_PATH") {
            if let Ok(bytes) = fs::read(&path) {
                match NnueWeights::load_from_bytes(&bytes) {
                    Ok(weights) => return Self { weights },
                    Err(e) => {
                        println!("[Engine] Failed to load NNUE file: {}", e);
                    }
                }
            } else {
                // If the path was the expected production path but it doesn't exist,
                // fall back to the packaged model in the container image.
                if path == "/etc/secrets/best_model.nnue" {
                    if let Ok(bytes) = fs::read("/app/best_model.nnue") {
                        if let Ok(weights) = NnueWeights::load_from_bytes(&bytes) {
                            println!("[Engine] Successfully loaded NNUE file from /app/best_model.nnue fallback");
                            return Self { weights };
                        }
                    }
                }
            }
        }

        Self {
            weights: NnueWeights::empty(),
        }
    }

    /// Performs the full forward pass on the given feature vector (768).
    /// If weights are not trained, returns None.
    pub fn forward(&self, features: &[f32]) -> Option<i32> {
        if self.weights.status != WeightsStatus::Trained {
            return None;
        }

        let input_dim = self.weights.input_dim;
        let hidden1_dim = self.weights.hidden1_dim;
        let hidden2_dim = self.weights.hidden2_dim;
        let output_dim = self.weights.output_dim;

        debug_assert_eq!(features.len(), input_dim);
        debug_assert_eq!(output_dim, 1);

        // Layer 1: Input (768) -> Hidden 1 (256)
        let mut hidden1 = vec![0.0; hidden1_dim];
        for i in 0..hidden1_dim {
            let mut sum = self.weights.hidden1_b[i];
            for j in 0..input_dim {
                // Optimization: skip 0 features (since features are mostly 0s and 1s)
                if features[j] > 0.0 {
                    sum += features[j] * self.weights.input_w[i * input_dim + j];
                }
            }
            // ReLU activation
            hidden1[i] = sum.max(0.0);
        }

        // Layer 2: Hidden 1 (256) -> Hidden 2 (32)
        let mut hidden2 = vec![0.0; hidden2_dim];
        for i in 0..hidden2_dim {
            let mut sum = self.weights.hidden2_b[i];
            for j in 0..hidden1_dim {
                sum += hidden1[j] * self.weights.hidden2_w[i * hidden1_dim + j];
            }
            // ReLU activation
            hidden2[i] = sum.max(0.0);
        }

        // Layer 3: Hidden 2 (32) -> Output (1)
        let mut sum = self.weights.output_b;
        for j in 0..hidden2_dim {
            sum += hidden2[j] * self.weights.output_w[j];
        }

        // Output is not activated
        let eval = sum;

        // Handle potential NaNs safely
        if eval.is_nan() || eval.is_infinite() {
            return None;
        }

        // Return strictly as an integer centipawn
        Some(eval.round() as i32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::nnue::weights::WeightsStatus;

    #[test]
    fn forward_pass_runs_with_mock_weights() {
        let mut model = NnueModel {
            weights: NnueWeights::empty(),
        };
        // Mock weights structure so it looks trained
        model.weights.status = WeightsStatus::Trained;
        model.weights.input_dim = 768;
        model.weights.hidden1_dim = 256;
        model.weights.hidden2_dim = 32;
        model.weights.output_dim = 1;

        model.weights.input_w = vec![0.0; 256 * 768];
        model.weights.hidden1_b = vec![0.0; 256];
        model.weights.hidden2_w = vec![0.0; 32 * 256];
        model.weights.hidden2_b = vec![0.0; 32];
        model.weights.output_w = vec![0.0; 32];
        model.weights.output_b = 0.0;

        let features = vec![0.0; 768];
        assert_eq!(model.forward(&features), Some(0));
    }

    #[test]
    fn zero_weights_returns_bias() {
        let mut model = NnueModel {
            weights: NnueWeights::empty(),
        };
        model.weights.status = WeightsStatus::Trained;
        model.weights.input_w = vec![0.0; 256 * 768];
        model.weights.hidden1_b = vec![0.0; 256];
        model.weights.hidden2_w = vec![0.0; 32 * 256];
        model.weights.hidden2_b = vec![0.0; 32];
        model.weights.output_w = vec![0.0; 32];
        model.weights.output_b = 15.0; // The output bias should pass straight through

        let features = vec![0.0; 768];
        assert_eq!(model.forward(&features), Some(15));
    }

    #[test]
    fn forward_pass_deterministic() {
        let mut model = NnueModel {
            weights: NnueWeights::empty(),
        };
        model.weights.status = WeightsStatus::Trained;
        model.weights.input_w = vec![0.1; 256 * 768];
        model.weights.hidden1_b = vec![0.2; 256];
        model.weights.hidden2_w = vec![0.3; 32 * 256];
        model.weights.hidden2_b = vec![0.4; 32];
        model.weights.output_w = vec![0.5; 32];
        model.weights.output_b = 0.6;

        let mut features = vec![0.0; 768];
        features[10] = 1.0;
        features[20] = 1.0;

        let result1 = model.forward(&features);
        let result2 = model.forward(&features);
        assert_eq!(result1, result2);
    }
}
