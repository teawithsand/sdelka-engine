/**
 * Undoes whatever was the last change performed.
 */
export interface Undoer { 
    undo: () => Promise<void>
}