import struct

class DummyModel:
    """Fallback if PyTorch is not installed."""
    def __init__(self):
        self.input_dim = 768
        self.hidden1 = 256
        self.hidden2 = 32
        self.output_dim = 1
        
    def get_weights(self):
        # 768*256 + 256 biases
        # 256*32 + 32 biases
        # 32*1 + 1 biases
        w1 = [0.0] * (self.input_dim * self.hidden1)
        b1 = [0.0] * self.hidden1
        w2 = [0.0] * (self.hidden1 * self.hidden2)
        b2 = [0.0] * self.hidden2
        w3 = [0.0] * (self.hidden2 * self.output_dim)
        b3 = [0.0] * self.output_dim
        return w1, b1, w2, b2, w3, b3

try:
    import torch
    import torch.nn as nn
    
    class NnueModel(nn.Module):
        def __init__(self):
            super(NnueModel, self).__init__()
            self.fc1 = nn.Linear(768, 256)
            self.fc2 = nn.Linear(256, 32)
            self.fc3 = nn.Linear(32, 1)
            
        def forward(self, x):
            x = torch.relu(self.fc1(x))
            x = torch.relu(self.fc2(x))
            x = self.fc3(x)
            return x
            
        def get_weights(self):
            w1 = self.fc1.weight.data.view(-1).tolist()
            b1 = self.fc1.bias.data.tolist()
            w2 = self.fc2.weight.data.view(-1).tolist()
            b2 = self.fc2.bias.data.tolist()
            w3 = self.fc3.weight.data.view(-1).tolist()
            b3 = self.fc3.bias.data.tolist()
            return w1, b1, w2, b2, w3, b3
except ImportError:
    NnueModel = DummyModel
