import { IDBComparable } from "../../pubutil"

export type Entry<E, C> = {
	// embedded fields
	engineData: E
	userData: C

	// misc fields
	id: string

	// collection/search fields
	collectionId: string
	tags: string[]

	// for engine lookups
	queue: IDBComparable
	queuePriority: IDBComparable

	// sync fields
	syncKey: string

	isEngineDataOutOfSync: boolean
	isCardDataOutOfSync: boolean
}

export interface EntryEntity<E, C> {
	id: string
	engineData: E
	userData: C
}

export type DeletedEntry = {
	id: string

	entryId: string
	entrySyncKey: string

	collectionId: string
	collectionSyncKey: string
}
export type DeletedEntryEntity = DeletedEntry

export type HistoryEntry<H> = {
	id: string
	
	entryId: string
	collectionId: string

	ordinalNumber: number

	data: H
}

export type HistoryEntryEntity<E> = HistoryEntry<E>