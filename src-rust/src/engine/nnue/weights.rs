#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum WeightsStatus {
    Trained,
    Placeholder,
    FallbackHce,
}

impl WeightsStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            WeightsStatus::Trained => "trained",
            WeightsStatus::Placeholder => "placeholder",
            WeightsStatus::FallbackHce => "fallback_hce",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum WeightsSource {
    File,
    Placeholder,
}

impl WeightsSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            WeightsSource::File => "file",
            WeightsSource::Placeholder => "placeholder",
        }
    }
}

pub struct NnueWeights {
    pub input_dim: usize,
    pub hidden1_dim: usize,
    pub hidden2_dim: usize,
    pub output_dim: usize,

    pub input_w: Vec<f32>,
    pub hidden1_b: Vec<f32>,
    pub hidden2_w: Vec<f32>,
    pub hidden2_b: Vec<f32>,
    pub output_w: Vec<f32>,
    pub output_b: f32,

    pub status: WeightsStatus,
    pub source: WeightsSource,
}

impl NnueWeights {
    pub fn empty() -> Self {
        Self {
            input_dim: 768,
            hidden1_dim: 256,
            hidden2_dim: 32,
            output_dim: 1,
            input_w: vec![],
            hidden1_b: vec![],
            hidden2_w: vec![],
            hidden2_b: vec![],
            output_w: vec![],
            output_b: 0.0,
            status: WeightsStatus::Placeholder,
            source: WeightsSource::Placeholder,
        }
    }

    pub fn load_from_bytes(bytes: &[u8]) -> Result<Self, &'static str> {
        if bytes.len() < 24 {
            return Err("File too small for header");
        }

        let version = u32::from_le_bytes(bytes[0..4].try_into().unwrap());
        let input_dim = u32::from_le_bytes(bytes[4..8].try_into().unwrap()) as usize;
        let hidden1_dim = u32::from_le_bytes(bytes[8..12].try_into().unwrap()) as usize;
        let hidden2_dim = u32::from_le_bytes(bytes[12..16].try_into().unwrap()) as usize;
        let output_dim = u32::from_le_bytes(bytes[16..20].try_into().unwrap()) as usize;
        let checksum = u32::from_le_bytes(bytes[20..24].try_into().unwrap());

        if version != 1 {
            return Err("Unsupported architecture version");
        }

        if input_dim != 768 || hidden1_dim != 256 || hidden2_dim != 32 || output_dim != 1 {
            return Err("Invalid tensor dimensions");
        }

        if checksum != 0xDEADBEEF {
            return Err("Checksum mismatch");
        }

        let expected_size = 24
            + (hidden1_dim * input_dim * 4)
            + (hidden1_dim * 4)
            + (hidden2_dim * hidden1_dim * 4)
            + (hidden2_dim * 4)
            + (output_dim * hidden2_dim * 4)
            + (output_dim * 4);

        if bytes.len() != expected_size {
            return Err("Invalid file length");
        }

        let mut offset = 24;

        let mut read_floats = |count: usize| -> Vec<f32> {
            let mut res = Vec::with_capacity(count);
            for _ in 0..count {
                res.push(f32::from_le_bytes(
                    bytes[offset..offset + 4].try_into().unwrap(),
                ));
                offset += 4;
            }
            res
        };

        let input_w = read_floats(hidden1_dim * input_dim);
        let hidden1_b = read_floats(hidden1_dim);
        let hidden2_w = read_floats(hidden2_dim * hidden1_dim);
        let hidden2_b = read_floats(hidden2_dim);
        let output_w = read_floats(output_dim * hidden2_dim);
        let output_b = read_floats(output_dim)[0];

        Ok(Self {
            input_dim,
            hidden1_dim,
            hidden2_dim,
            output_dim,
            input_w,
            hidden1_b,
            hidden2_w,
            hidden2_b,
            output_w,
            output_b,
            status: WeightsStatus::Trained,
            source: WeightsSource::File,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_valid_header() -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&768u32.to_le_bytes());
        bytes.extend_from_slice(&256u32.to_le_bytes());
        bytes.extend_from_slice(&32u32.to_le_bytes());
        bytes.extend_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&0xDEADBEEFu32.to_le_bytes());
        bytes
    }

    fn create_valid_file() -> Vec<u8> {
        let mut bytes = create_valid_header();
        let payload_size =
            (256 * 768 * 4) + (256 * 4) + (32 * 256 * 4) + (32 * 4) + (1 * 32 * 4) + (1 * 4);
        bytes.resize(bytes.len() + payload_size, 0);
        bytes
    }

    #[test]
    fn valid_weights_tensor_lengths() {
        let bytes = create_valid_file();
        let weights = NnueWeights::load_from_bytes(&bytes).unwrap();
        assert_eq!(weights.input_w.len(), 256 * 768);
        assert_eq!(weights.hidden1_b.len(), 256);
        assert_eq!(weights.hidden2_w.len(), 32 * 256);
        assert_eq!(weights.hidden2_b.len(), 32);
        assert_eq!(weights.output_w.len(), 32);
    }

    #[test]
    fn truncated_weights_rejected() {
        let mut bytes = create_valid_file();
        bytes.truncate(bytes.len() - 1);
        assert_eq!(NnueWeights::load_from_bytes(&bytes).is_err(), true);
    }

    #[test]
    fn extra_bytes_rejected() {
        let mut bytes = create_valid_file();
        bytes.push(0);
        assert_eq!(NnueWeights::load_from_bytes(&bytes).is_err(), true);
    }

    #[test]
    fn wrong_layer_shape_rejected() {
        let mut bytes = create_valid_header();
        // Modify hidden1_dim to 128
        bytes[8..12].copy_from_slice(&128u32.to_le_bytes());
        let payload_size =
            (128 * 768 * 4) + (128 * 4) + (32 * 128 * 4) + (32 * 4) + (1 * 32 * 4) + (1 * 4);
        bytes.resize(bytes.len() + payload_size, 0);
        // Will be rejected because hidden1_dim != 256
        assert_eq!(NnueWeights::load_from_bytes(&bytes).is_err(), true);
    }

    #[test]
    fn invalid_version_rejected() {
        let mut bytes = create_valid_file();
        bytes[0..4].copy_from_slice(&2u32.to_le_bytes());
        assert_eq!(NnueWeights::load_from_bytes(&bytes).is_err(), true);
    }

    #[test]
    fn valid_weights_status_trained() {
        let bytes = create_valid_file();
        let weights = NnueWeights::load_from_bytes(&bytes).unwrap();
        assert_eq!(weights.status, WeightsStatus::Trained);
    }
}
