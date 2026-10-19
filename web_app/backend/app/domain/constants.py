"""
ITU-T H.265 / HM-18.0 Domain Constants and Tables
"""

# HEVC 35 Intra Prediction Modes (0..34)
INTRA_PRED_MODES: dict[int, str] = {
    0: "Planar",
    1: "DC",
    2: "Diagonal Bottom-Left (45°)",
    3: "Angular 3",
    4: "Angular 4",
    5: "Angular 5",
    6: "Angular 6",
    7: "Angular 7",
    8: "Angular 8",
    9: "Angular 9",
    10: "Horizontal",
    11: "Angular 11",
    12: "Angular 12",
    13: "Angular 13",
    14: "Angular 14",
    15: "Angular 15",
    16: "Angular 16",
    17: "Angular 17",
    18: "Diagonal Top-Left (45°)",
    19: "Angular 19",
    20: "Angular 20",
    21: "Angular 21",
    22: "Angular 22",
    23: "Angular 23",
    24: "Angular 24",
    25: "Angular 25",
    26: "Vertical",
    27: "Angular 27",
    28: "Angular 28",
    29: "Angular 29",
    30: "Angular 30",
    31: "Angular 31",
    32: "Angular 32",
    33: "Angular 33",
    34: "Diagonal Top-Right (45°)",
}

# Intra Prediction Angle Table per H.265 Table 8-7
INTRA_PRED_ANGLE_TABLE: list[int] = [0, 2, 5, 9, 13, 17, 21, 26, 32]
