import Dexie, { Table } from "dexie"

export type CardCollectionDBEntity = {
	id: string
	version: number
	metadata: any
}

export type CardCollectionEntryDBEntity = {
	id: string
	collectionId: string
	version: number

	data: any
}

export class IndexedDBCardSourceDB extends Dexie {
	public readonly cardCollections!: Table<CardCollectionDBEntity, string>
	public readonly cardCollectionEntries!: Table<
		CardCollectionEntryDBEntity,
		string
	>

	constructor(name: string) {
		super(name)
		this.version(1).stores({
			cardCollections: "id",
			cardCollectionEntries: "[collectionId+id], [collectionId+version]",
		})
	}
}
