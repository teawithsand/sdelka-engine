import { Cursor, IDBComparable } from "../../pubutil"
import { EntryEntity } from "./entry"

export interface EntriesView<CE, CD> {
	iterate: () => Cursor<EntryEntity<CE, CD>>
	getData: (id: string) => Promise<EntryEntity<CE, CD> | null>
	getAccess: (id: string) => Promise<EntryAccess<CE, CD> | null>
}

export interface MutableEntriesView<CE, CD> extends EntriesView<CE, CD> {
	addCard: (cardData: CD) => Promise<EntryEntity<CE, CD>>
}

export interface EngineEntriesView<CE, CD> extends EntriesView<CE, CD> {
	getTopmostQueueEntry: (queues: IDBComparable[]) => Promise<string | null>
	getQueueLengthInRange: (
		queue: IDBComparable,
		start: IDBComparable,
		end: IDBComparable,
		startIncl: boolean,
		endIncl: boolean
	) => Promise<number>
}

export interface EntryAccess<CE, CD> {
	readonly entryId: string

	getData: () => Promise<EntryEntity<CE, CD> | null>

	updateEngineData: (engineData: CE) => Promise<void>
	updateCardData: (cardData: CD) => Promise<void>
	delete: () => Promise<void>
}
