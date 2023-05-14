import { Cursor, IDBComparable } from "../../pubutil"
import { EntryEntity } from "./entry"

export interface EntriesView<CE, CD> {
	iterate: () => Cursor<EntryEntity<CE, CD>>
	getData: (id: string) => Promise<EntryEntity<CE, CD> | null>
	getAccess: (id: string) => Promise<EntryAccess<CE, CD> | null>
}

export interface MutableEntriesView<CE, CD> extends EntriesView<CE, CD> {
	addCard: (cardData: CD, engineData: CE) => Promise<void>
}

export interface EngineEntriesView<CE, CD> extends EntriesView<CE, CD> {
	getTopmostQueueEntry: (queues: IDBComparable[]) => Promise<string | null>
	getQueueLength: (queue: IDBComparable) => Promise<number>
}

export interface EntryAccess<CE, CD> {
	readonly id: string

	updateEngineData: (engineData: CE) => Promise<void>
	updateCardData: (cardData: CD) => Promise<void>
	getData: () => Promise<EntryEntity<CE, CD> | null>
	delete: () => Promise<void>
}
