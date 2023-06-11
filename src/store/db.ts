import Dexie, { Table } from "dexie"
import { IDBComparable } from "../pubutil"

export type DBHistoryEntry<H> = {
	id: string

	entryId: string
	collectionId: string

	ordinalNumber: number

	data: H
}

export type DBDeletedEntry = {
	id: string

	entryId: string
	entrySyncKey: string

	collectionId: string
	collectionSyncKey: string
}

export type DBEntry<E, C> = {
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


export type DBCollection<CLD, ESD> = {
	// embedded
	collectionData: CLD
	engineData: ESD | null

	// own
	id: string

	// sync
	syncKey: string
}

// Quick note here: DB is sort of internal component, so it's OK for it to have so many generic types.
// It should be ok for now.

export class DB<
	CardEngineData,
	CardData,
	CollectionData,
	EngineCollectionData,
	EngineHistoryData
> extends Dexie {
	// Core tables
	public readonly entries!: Table<DBEntry<CardEngineData, CardData>>
	public readonly collections!: Table<
		DBCollection<CollectionData, EngineCollectionData>
	>

	// Support tables - synchronization & history
	public readonly deletedEntries!: Table<DBDeletedEntry>
	public readonly historyEntries!: Table<DBHistoryEntry<EngineHistoryData>>

	// Support tables - engine

	// TODO(teawithsand): a few more tables for features like history

	constructor(name: string) {
		super(name)
		this.version(1).stores({
			entries:
				"id, collectionId, [collectionId+id], [collectionId+syncKey], [collectionId+queue+queuePriority]",
			collections: "id, syncKey",
			deletedEntries:
				"id, entryKey, collectionKey, collectionId, entryId",
			historyEntries:
				"id, collectionId, [collectionId+entryId], [collectionId+ordinalNumber]",
		})
	}
}
