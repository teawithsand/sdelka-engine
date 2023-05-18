import { Cursor, IDBComparable } from "../../pubutil"
import { EntryEntity } from "./entry"

export interface EntriesView<CE, CD> {
	iterate: () => Cursor<EntryEntity<CE, CD>>
	getData: (id: string) => Promise<EntryEntity<CE, CD> | null>
	getAccess: (id: string) => Promise<EntryAccess<CE, CD> | null>
}

export interface MutableEntriesView<CE, CD> extends EntriesView<CE, CD> {
	addCard: (cardData: CD) => Promise<void>
}

export interface EngineEntriesView<CE, CD> extends EntriesView<CE, CD> {
	getTopmostQueueEntry: (queues: IDBComparable[]) => Promise<string | null>
	getQueueLength: (queue: IDBComparable) => Promise<number>
	getQueueLengthUntil: (queue: IDBComparable, element: IDBComparable) => Promise<number>
	getQueueLengthAfter: (queue: IDBComparable, element: IDBComparable) => Promise<number>
}

export interface EntryAccess<CE, CD> {
	readonly id: string

	getData: () => Promise<EntryEntity<CE, CD> | null>

	updateEngineData: (engineData: CE) => Promise<void>
	updateCardData: (cardData: CD) => Promise<void>
	delete: () => Promise<void>
}
