import Dexie, { Table } from "dexie"
import { Collection, DeletedEntry, Entry } from "./defines"

export class DB<CE, CD, SD> extends Dexie {

	// Core tables
	public readonly entries!: Table<Entry<CE, CD>>
	public readonly collections!: Table<Collection<SD>>

	// Support tables - synchronization
	public readonly deletedEntries!: Table<DeletedEntry>

	// Support tables - engine

	// TODO(teawithsand): a few more tables for features like history 

	constructor(name: string) {
		super(name)
		this.version(1).stores({
			entries: "id, collectionId, [collectionId+syncKey], [collectionId+queue+priority+desiredPresentationTs]",
			collections: "id, syncKey",
			deletedEntries: "id, entryKey, collectionKey, collectionId, entryId"
		})
	}
}
