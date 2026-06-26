# NNUE Binary Format (Clash of Crowns)

This document specifies the exact binary layout for the NNUE weights (`.nnue`) used by the Clash of Crowns Rust engine.

## Header (24 Bytes)
The binary file begins with a 24-byte header containing strictly little-endian `u32` (unsigned 32-bit integer) fields. No magic bytes or strings are prepended before these fields.

| Offset | Size | Type | Name | Expected Value | Description |
|---|---|---|---|---|---|
| 0x00 | 4 bytes | `u32` | `version` | `1` | Architecture version |
| 0x04 | 4 bytes | `u32` | `input_dim` | `768` | Number of input features |
| 0x08 | 4 bytes | `u32` | `hidden1_dim` | `256` | Number of neurons in hidden layer 1 |
| 0x0C | 4 bytes | `u32` | `hidden2_dim` | `32` | Number of neurons in hidden layer 2 |
| 0x10 | 4 bytes | `u32` | `output_dim` | `1` | Number of output neurons (evaluation) |
| 0x14 | 4 bytes | `u32` | `checksum` | `0xDEADBEEF` | Dummy checksum for version 1 validation |

## Data Type
All weights and biases are stored sequentially as IEEE 754 32-bit floating point numbers (`f32`), encoded in little-endian byte order. 
Each value takes exactly 4 bytes.

## Tensor Layout & Order
Tensors are flattened in C-contiguous (row-major) order, exactly matching PyTorch's `weight.data.view(-1).tolist()`. 

For a linear layer `nn.Linear(in_features, out_features)`, PyTorch stores the weights as `[out_features, in_features]`. Thus, the flattened array contains all `in_features` weights connecting to the first output neuron, followed by all `in_features` weights for the second output neuron, and so on.

The payload immediately follows the 24-byte header in the following strict order:

| Index | Name | Shape | Elements | Bytes |
|---|---|---|---|---|
| 1 | `input_to_hidden1` weights | `[256, 768]` | 196,608 | 786,432 |
| 2 | `hidden1_bias` | `[256]` | 256 | 1,024 |
| 3 | `hidden1_to_hidden2` weights | `[32, 256]` | 8,192 | 32,768 |
| 4 | `hidden2_bias` | `[32]` | 32 | 128 |
| 5 | `hidden2_to_output` weights | `[1, 32]` | 32 | 128 |
| 6 | `output_bias` | `[1]` | 1 | 4 |

## Exact File Size
Total size: `24 (header) + 786,432 + 1,024 + 32,768 + 128 + 128 + 4` = **820,508 bytes**.
The engine must strictly reject any file that is not exactly 820,508 bytes in length.

## Fallback Behavior
If the backend encounters any of the following during loading, it must safely fallback to the structural placeholder without panicking:
- File not found or inaccessible.
- File size is not exactly 820,508 bytes (truncated or extra bytes).
- Header parsing fails.
- Dimensionality mismatches (`input_dim != 768`, etc.).
- Version unsupported (`version != 1`).
- Checksum mismatch (`checksum != 0xDEADBEEF`).
