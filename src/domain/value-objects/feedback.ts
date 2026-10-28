export type Feedback = 'up' | 'down';

/** Pressing the active thumb again clears it. */
export function toggleFeedback(current: Feedback | null, pressed: Feedback): Feedback | null {
  return current === pressed ? null : pressed;
}
