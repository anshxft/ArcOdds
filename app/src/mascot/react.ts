// Lets any page make Poring (the floating mascot) react. The mascot itself is lazy-loaded,
// so calls made before it mounts are simply dropped.
import type definition from './poring.avatar.json'

export type Mood = keyof typeof definition.animations

/** `ms`: how long to hold the mood before going back to idle. `say`: a short speech bubble. */
export interface Reaction {
  ms?: number
  say?: string
}

let handler: ((mood: Mood, reaction: Reaction) => void) | null = null

export function setMascotHandler(next: typeof handler) {
  handler = next
}

export function mascot(mood: Mood, reaction: Reaction = {}) {
  handler?.(mood, reaction)
}
