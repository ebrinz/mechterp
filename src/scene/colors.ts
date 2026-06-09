export const EMOTIONS = [
  'admiration','amusement','anger','annoyance','approval','caring','confusion',
  'curiosity','desire','disappointment','disapproval','disgust','embarrassment',
  'excitement','fear','gratitude','grief','joy','love','nervousness','optimism',
  'pride','realization','relief','remorse','sadness','surprise','neutral',
]

// Evenly spaced HSL hues -> hex, deterministic per index.
function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * c).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const TABLE: Record<string, string> = Object.fromEntries(
  EMOTIONS.map((e, i) => [e, hslToHex((360 * i) / EMOTIONS.length, 0.6, 0.55)]),
)

export function emotionColor(emotion: string): string {
  return TABLE[emotion] ?? '#888888'
}
