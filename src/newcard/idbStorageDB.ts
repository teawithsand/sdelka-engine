import Dexie, { Table } from "dexie"
import { NDTSC } from "../util/sync"

export type StoredCard<T> = {
	id: string
	collectionId: string
	tags: string[]

	/**
	 * Priority used to added this card to data store.
	 */
	priority: number

	/**
	 * NDTSC, which determines when card was added or when it was last modified.
	 */
	ndtsc: NDTSC

	data: T
}

export type StoredCardCollection<T> = {
	id: string

	cardModifyNdtsc: NDTSC

	data: T
}

export class IndexedDBCardStorageDB<T, C> extends Dexie {
	public readonly cards!: Table<StoredCard<C>>
	public readonly collections!: Table<StoredCardCollection<T>>

	constructor(name: string) {
		super(name)
		this.version(1).stores({
			cards: "[collectionId+id], id, [collectionId+*tags], [collectionId+ndtsc]",
			collections: "id",
		})
	}
}
