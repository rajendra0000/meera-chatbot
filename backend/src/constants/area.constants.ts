// ─────────────────────────────────────────────────────────────────────────────
// Area extraction constants
// ─────────────────────────────────────────────────────────────────────────────

export const VALID_AREAS = ["<100", "100-300", "300+", "Not captured"] as const;

/**
 * Keyword → area label mapping.
 * Longer phrases are checked before shorter ones to avoid substring conflicts.
 */
export const AREA_HINTS: Record<string, string> = {
  "bohot bada":    "300+",
  "drawing room":  "100-300",
  "living room":   "100-300",
  "single wall":   "<100",
  "ek kamra":      "100-300",
  "ek wall":       "<100",
  "farmhouse":     "300+",
  "bungalow":      "300+",
  "showroom":      "300+",
  "duplex":        "300+",
  "commercial":    "300+",
  "washroom":      "<100",
  "balcony":       "<100",
  "bathroom":      "<100",
  "bedroom":       "100-300",
  "not too big":   "100-300",
  "not too small": "100-300",
  "moderate size": "100-300",
  "average size":  "100-300",
  "average":       "100-300",
  "chhoti":        "<100",
  "chhota":        "<100",
  "dining":        "100-300",
  "normal":        "100-300",
  "meduim":        "100-300",
  "medim":         "100-300",
  "medium":        "100-300",
  "office":        "300+",
  "chota":         "<100",
  "pooja":         "<100",
  "lobby":         "300+",
  "small":         "<100",
  "villa":         "300+",
  "large":         "300+",
  "hall":          "300+",
  "tiny":          "<100",
  "bada":          "300+",
  "<100":          "<100",
  "100-300":       "100-300",
  "300+":          "300+"
};

/**
 * Midpoints used for estimated order value calculation.
 */
export const AREA_MIDPOINTS: Record<string, number> = {
  "<100":         75,
  "100-300":      200,
  "300+":         400,
  "Not captured": 150,
  "Not specified": 150
};
