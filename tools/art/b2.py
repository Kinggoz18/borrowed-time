"""Footprint-aware sprite for building models: unit coordinates (0..1) always span the building's own U x U claim."""
import numpy as np
from iso2 import *
from pixlib import STEP_X, STEP_Y


class B2(S2):
    def __init__(self, U=1, hmax=96, seed=1, span=1.15):
        self.U = U
        self.span = span
        w = int(U * 96 * self.span) + 24
        h = int(hmax) + U * 48 + 8
        super().__init__(w, h, w // 2, h - 6, seed)
        self.hs = 1 + 0.4 * (U - 1)        # height scale for big claims

    def P(self, a, b, z=0.0):
        U, k = self.U, self.span
        c = 1 - U / 2
        return super().P(c + (a - 0.5) * U * k, c + (b - 0.5) * U * k, z)

    def _ellipse(self, ac, bc, rho):
        return super()._ellipse(ac, bc, rho * self.U * self.span)

    def Z(self, z):
        return z * self.hs

    def anchor(self):
        return self.w // 2, self.h - 6

    def wu(self, px):
        """a length of `px` screen pixels along a wall, in unit coordinates"""
        return px / (STEP_X * self.span * self.U)

    def bays(self, a0, a1, pitch=16):
        n = max(1, int((a1 - a0) / self.wu(pitch)))
        step = (a1 - a0) / n
        return [a0 + step * (i + 0.5) for i in range(n)]
