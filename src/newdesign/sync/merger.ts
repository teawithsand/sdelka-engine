export type CardMergingResult<C> = {
    card: C,
}

export interface CardMerger<C> {
    /**
     * Returns true if cards are equal.
     * Returns false otherwise.
     */
    compareCards: (lhsCard: C, rhsCard: C) => boolean

    /**
     * Merges two cards returning a new one, which should be stored both locally and on server.
     */
    mergeCards: (localCard: C, remoteCard: C) => CardMergingResult<C>
}

export type StateMergingResult<S> = {
    state: S,
}


export interface StateMerger<S> {
    mergeStates: (localState: S, remoteState: S) => StateMergingResult<S>
}