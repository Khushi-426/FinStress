"""
ft_transformer.py — FT-Transformer for tabular data.

Architecture from "Revisiting Deep Learning Models for Tabular Data"
(Gorishniy et al., 2021). Implements:
  - Numeric feature tokenisation (linear projection per feature)
  - [CLS] token prepended
  - Transformer encoder stack
  - MLP head for regression (stress score 0-100)

No external rtdl dependency — pure PyTorch so it works anywhere.
"""
import math
import torch
import torch.nn as nn
import torch.nn.functional as F


class NumericalEmbedding(nn.Module):
    """Per-feature linear projection: x_i → d_token-dim vector."""
    def __init__(self, n_features: int, d_token: int):
        super().__init__()
        self.weight = nn.Parameter(torch.empty(n_features, d_token))
        self.bias   = nn.Parameter(torch.zeros(n_features, d_token))
        nn.init.kaiming_uniform_(self.weight, a=math.sqrt(5))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, F)  → (B, F, d_token)
        return x.unsqueeze(-1) * self.weight + self.bias


class MultiheadAttention(nn.Module):
    def __init__(self, d_token: int, n_heads: int, dropout: float = 0.0):
        super().__init__()
        assert d_token % n_heads == 0
        self.n_heads = n_heads
        self.d_head  = d_token // n_heads
        self.W_q = nn.Linear(d_token, d_token)
        self.W_k = nn.Linear(d_token, d_token)
        self.W_v = nn.Linear(d_token, d_token)
        self.W_o = nn.Linear(d_token, d_token)
        self.drop = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, S, D = x.shape
        H, Dh   = self.n_heads, self.d_head

        def split(t): return t.view(B, S, H, Dh).transpose(1, 2)

        Q, K, V = split(self.W_q(x)), split(self.W_k(x)), split(self.W_v(x))
        scale   = math.sqrt(Dh)
        attn    = self.drop(F.softmax(Q @ K.transpose(-2, -1) / scale, dim=-1))
        out     = (attn @ V).transpose(1, 2).reshape(B, S, D)
        return self.W_o(out)


class TransformerBlock(nn.Module):
    def __init__(self, d_token: int, n_heads: int, ffn_factor: float = 4/3, dropout: float = 0.1):
        super().__init__()
        d_ffn = int(d_token * ffn_factor)
        self.norm1 = nn.LayerNorm(d_token)
        self.norm2 = nn.LayerNorm(d_token)
        self.attn  = MultiheadAttention(d_token, n_heads, dropout)
        self.ffn   = nn.Sequential(
            nn.Linear(d_token, d_ffn),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_ffn, d_token),
            nn.Dropout(dropout),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.attn(self.norm1(x))
        x = x + self.ffn(self.norm2(x))
        return x


class FTTransformer(nn.Module):
    """
    FT-Transformer for tabular regression.

    Args:
        n_features:  number of numeric input features
        d_token:     embedding dimension per feature token
        n_heads:     attention heads
        n_layers:    transformer blocks
        dropout:     dropout probability
        ffn_factor:  FFN hidden size = d_token * ffn_factor
    """
    def __init__(
        self,
        n_features: int = 24,
        d_token:    int = 192,
        n_heads:    int = 8,
        n_layers:   int = 3,
        dropout:    float = 0.1,
        ffn_factor: float = 4/3,
    ):
        super().__init__()
        self.embedding = NumericalEmbedding(n_features, d_token)
        self.cls_token = nn.Parameter(torch.zeros(1, 1, d_token))
        self.layers    = nn.ModuleList([
            TransformerBlock(d_token, n_heads, ffn_factor, dropout)
            for _ in range(n_layers)
        ])
        self.norm = nn.LayerNorm(d_token)
        self.head = nn.Sequential(
            nn.Linear(d_token, d_token // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(d_token // 2, 1),
            nn.Sigmoid(),   # output in [0, 1]; multiply by 100 for stress score
        )
        self._init_weights()

    def _init_weights(self):
        nn.init.trunc_normal_(self.cls_token, std=0.02)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: (B, n_features) → stress_score: (B,) in [0, 100]"""
        tokens = self.embedding(x)                           # (B, F, D)
        cls    = self.cls_token.expand(x.size(0), -1, -1)   # (B, 1, D)
        tokens = torch.cat([cls, tokens], dim=1)             # (B, F+1, D)
        for layer in self.layers:
            tokens = layer(tokens)
        cls_out = self.norm(tokens[:, 0])                    # (B, D) — CLS token
        return self.head(cls_out).squeeze(-1) * 100          # (B,) in [0,100]


def build_model(n_features: int = 24, **kwargs) -> FTTransformer:
    return FTTransformer(n_features=n_features, **kwargs)
