import { IDBComparable } from "../../pubutil"

export type EntryEngineDerivedDataExtractor<T> = (
	data: T
) => EntryEngineDerivedData

export interface EntryEngineDerivedData {
	queue: IDBComparable
	queuePriority: IDBComparable
	
	isOutOfSync: boolean
}

export type EntryCardDerivedDataExtractor<T> = (
	data: T
) => EntryCardDerivedData

export interface EntryCardDerivedData {
	syncKey: string
	tags: string[]

	isOutOfSync: boolean
}

export type Entry<E, C> = {
	// embedded fields
	engineData: E
	cardData: C

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
	cardData: C
}

export type DeletedEntry = {
	id: string

	cardId: string
	entryKey: string

	collectionId: string
	collectionKey: string
}
export type DeletedEntryEntity = DeletedEntry