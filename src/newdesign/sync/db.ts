import { Cursor, ID } from "../../util"

// Redesign write command for syncDB, rather than use generic type, since write commands for SyncDB are simple and generic,
// they use simple ID-based key-value writes.
//
// Also sync protocol, besides merger, is subject to few external modifications in general, so it does not has
// to be as open as engine or db types.

export enum SyncDBWriteCommandType {
    WRITE_CARD = 1,
    WRITE_STATE = 2,
    DELETE_DELETED_CARDS = 3,
}

export type SyncDBWriteCommand<C, S> = {
    type: SyncDBWriteCommandType.WRITE_CARD,
    card: C,
} | {
    type: SyncDBWriteCommandType.WRITE_STATE,
    state: S,
} | {
    type: SyncDBWriteCommandType.DELETE_DELETED_CARDS,
}

/**
 * Database as understood by synchronization protocol.
 */
export interface SyncDB<C, S> {
    /**
     * Executes a sequence of write commands atomically.
     */
    executeWriteCommands: (commands: SyncDBWriteCommand<C, S>[]) => Promise<void>

    /**
     * Loads state stored in SyncDB.
     */
    loadState: () => Promise<S>

    /**
     * Loads cards with specified ids.
     */
    loadCards: (id: ID[]) => Promise<(C | null)[]>

    /**
     * Loads all cards, which are considered to be not-in-sync.
     */
    loadNotInSync: () => Promise<Cursor<C>>
}