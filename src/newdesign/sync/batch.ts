export type BatchCard<C> = {
    /**
     * Local card in synchronization batch. null if it was not present there.
     */
    localCard: C | null,
    
    /**
     * Remote card downloaded from server. null if it was not present there.
     */
    remoteCard: C | null
}

export enum BatchType {
    CARDS = 1,
    STATE = 2
}

export type BatchData<C, S> = {
    type: BatchType.CARDS
    cards: BatchCard<C>[]
} | {
    type: BatchType.STATE,
    state: S
}

/**
 * Small database, which is persistent. It stores data of single synchronization batch.
 * 
 * It must be empty before next synchronization batch starts.
 * 
 * It was created in order to make SyncDB not grow more complex. Instead some complexity can be easily moved here, 
 * making master DB component less complex.
 */
export interface SyncBatchDB<C, S> {
    setBatchData: (data: BatchData<C, S> | null) => Promise<void>
    getBatchData: () => Promise<BatchData<C, S> | null>
}