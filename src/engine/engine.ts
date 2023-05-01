import { Cursor } from "../pubutil"
import { SyncRequest } from "../util/sync"

/**
 * Engine, which like SM2 engine uses key/value+features DB to run whole learning process.
 * 
 * Such databases are easy to synchronize between devices and synchronization is the main purpose of existence
 * of this interface.
 */
export interface CardDataBasedEngineManagement<T> {
	getCardData: (id: string) => Promise<T | null>
	setCardData: (id: string, data: T) => Promise<void>
    hasCardData: (id: string) => Promise<boolean>

	getEntriesForSyncRequest: (req: SyncRequest) => Cursor<T>
}

/**
 * Engine, which has cards manually deleted/added to it.
 */
export interface EngineCardManagement {
    hasCard: (id: string) => Promise<boolean>
	addCard: (id: string) => Promise<void>
	deleteCard: (id: string) => Promise<void>
}

/**
 * Abstract type representing any engine.
 *
 * TODO(teawithsand): replace parameter T with string
 */
export interface Engine<T, A, S> {
	getCurrentCard: () => Promise<T | null>
	answer: (answer: A) => Promise<void>
	getStats: () => Promise<S>
}
