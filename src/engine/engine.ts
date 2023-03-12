/**
 * Abstract type representing any engine.
 */
export interface Engine<C, A, S> {
    getCurrentCard: () => Promise<C | null>
    answer: (answer: A) => Promise<void>
    getStats: () => Promise<S>
}