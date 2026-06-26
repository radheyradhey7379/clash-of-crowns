import struct

def export_to_nnue(model, out_path):
    w1, b1, w2, b2, w3, b3 = model.get_weights()
    
    # Checksum can just be a dummy value for v1 mock
    checksum = 0xDEADBEEF
    
    with open(out_path, "wb") as f:
        # Header
        f.write(struct.pack("<I", 1)) # Version
        f.write(struct.pack("<I", 768)) # Input
        f.write(struct.pack("<I", 256)) # Hidden 1
        f.write(struct.pack("<I", 32))  # Hidden 2
        f.write(struct.pack("<I", 1))   # Output
        f.write(struct.pack("<I", checksum))
        
        # We just write out all floats in little-endian
        for val in w1: f.write(struct.pack("<f", val))
        for val in b1: f.write(struct.pack("<f", val))
        for val in w2: f.write(struct.pack("<f", val))
        for val in b2: f.write(struct.pack("<f", val))
        for val in w3: f.write(struct.pack("<f", val))
        for val in b3: f.write(struct.pack("<f", val))
        
    print(f"Exported NNUE weights to {out_path}")
