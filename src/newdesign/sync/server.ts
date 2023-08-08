import { ID } from "../../util";

/**
 * Handler, which handles single specific synchronization.
 */
export interface ServerSyncHandler<C> {
    getOutOfSyncCardCount: () => Promise<number>
    getOutOfSyncCardsIds: (offset: number, limit: number) => Promise<ID[]>

    getCardCount: () => Promise<number>
    getCardIds: (offset: number, limit: number) => Promise<ID[]>
    getCards: (ids: ID[]) => Promise<(C | null)[]>
    setCards: (cards: C[]) => Promise<void>

    /**
     * Cleans up all marked as deleted cards by actually deleting them.
     */
    deleteMarkedAsDeleted: () => Promise<void>

    /**
     * Finalizes this handler.
     */
    close: () => Promise<void>
}

export interface ServerSynchronizerAdapter<C, H>  {
    createSyncHandler: (headers: H) => Promise<ServerSyncHandler<C>>
}