import Dexie, { Table } from "dexie"
import { Collection, DeletedEntry, Entry, HistoryEntry } from "./defines"

export class DB<
	CardEngineData,
	CardData,
	CollectionData,
	EngineCollectionData,
	EngineHistoryData
> extends Dexie {
	// Core tables
	public readonly entries!: Table<Entry<CardEngineData, CardData>>
	public readonly collections!: Table<
		Collection<CollectionData, EngineCollectionData>
	>

	// Support tables - synchronization & history
	public readonly deletedEntries!: Table<DeletedEntry>
	public readonly historyEntries!: Table<HistoryEntry<EngineHistoryData>>

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
