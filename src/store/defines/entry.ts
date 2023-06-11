export interface EntryEntity<E, C> {
	id: string
	engineData: E
	userData: C
}

export type DeletedEntryEntity = {
	id: string

	entryId: string
	entrySyncKey: string

	collectionId: string
	collectionSyncKey: string
}

export type HistoryEntryEntity<H> = {
	id: string

	entryId: string
	collectionId: string

	ordinalNumber: number

	data: H
}