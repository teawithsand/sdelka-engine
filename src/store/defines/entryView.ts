import { UserEntryData } from "../../card"
import { EngineEntryData } from "../../engine"
import { Cursor, IDBComparable } from "../../util"
import { EntryEntity } from "./entry"

export interface EntriesView {
	iterate: () => Cursor<EntryEntity>
	getData: (id: string) => Promise<EntryEntity | null>
	getAccess: (id: string) => Promise<EntryAccess | null>
}

export interface MutableEntriesView extends EntriesView {
	addCard: (userData: UserEntryData) => Promise<EntryEntity>
}

export interface EngineEntriesView extends EntriesView {
	getTopmostQueueEntry: (queues: IDBComparable[]) => Promise<string | null>
	getQueueLengthInRange: (
		queue: IDBComparable,
		start: IDBComparable,
		end: IDBComparable,
		startIncl: boolean,
		endIncl: boolean
	) => Promise<number>
}

export interface EntryAccess {
	readonly entryId: string

	getData: () => Promise<EntryEntity | null>

	updateEngineData: (engineData: EngineEntryData) => Promise<void>
	updateUserData: (userData: UserEntryData) => Promise<void>
	delete: () => Promise<void>
}
