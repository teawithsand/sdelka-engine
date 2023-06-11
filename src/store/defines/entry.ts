import { UserEntryData } from "../../card"
import { EngineEntryData } from "../../engine"

export interface EntryEntity {
	id: string
	engineData: EngineEntryData
	userData: UserEntryData
}

export type DeletedEntryEntity = {
	id: string

	entryId: string
	entrySyncKey: string

	collectionId: string
	collectionSyncKey: string
}

/*
export type HistoryEntryEntity<H> = {
	id: string

	entryId: string
	collectionId: string

	ordinalNumber: number

	data: H
}
*/