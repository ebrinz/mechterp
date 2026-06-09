export interface Token { index: number; text: string; masked: boolean }

// v1 simplification: splits on whitespace to yield legible word tokens.
// The model's subword tokenizer (e.g. BPE) could replace this later if
// masking needs to match subword units exactly.
export function toTokens(text: string): Token[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w, i) => ({ index: i, text: w, masked: false }))
}

export function maskedSentence(tokens: Token[]): string {
  return tokens.filter((t) => !t.masked).map((t) => t.text).join(' ')
}
