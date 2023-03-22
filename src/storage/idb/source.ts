import { MAX_IDB_KEY, MIN_IDB_KEY } from "../../pubutil"
import { AppendDeleteCardSource, CardSource, CardSourceCursor } from "../source"
import { IDBStorageDB } from "./db"

interface Access {
	readonly collectionId: string
	readonly db: IDBStorageDB<any, any>
	readonly initialize: () => Promise<void>
}

interface IDBCursorData {
	lastLoadedVersion: number | null
	currentId: string | null
}

class IndexedDBCardSourceCursor<T extends { readonly id: string }>
	implements CardSourceCursor
{
	constructor(
		public data: IDBCursorData,
		public readonly source: IndexedDBCardSource<T>,
		private readonly access: Access
	) {}

	get currentId(): string | null {
		return this.data.currentId
	}

	refresh = async (): Promise<void> => {
		await this.access.initialize()

		const { currentId } = this.data
		if (currentId === null) return

		const res = await this.access.db.cardCollectionEntries
			.where("[collectionId+id]")
			.equals([this.access.collectionId, currentId])
			.first()

		if (!res) {
			this.data.currentId = null
		}
	}

	next = async (): Promise<boolean> => {
		await this.access.initialize()
		const lastLoadedVersion = this.data.lastLoadedVersion

		if (lastLoadedVersion !== null) {
			const value = await this.access.db.cardCollectionEntries
				.where("[collectionId+version]")
				.between(
					[this.access.collectionId, lastLoadedVersion],
					[this.access.collectionId, MAX_IDB_KEY],
					false,
					true
				)
				.first()
			if (!value) return false

			if (value.version <= lastLoadedVersion)
				throw new Error(`No version increment`)

			this.data.currentId = value.id
			this.data.lastLoadedVersion = value.version

			return true
		} else {
			const value = await this.access.db.cardCollectionEntries
				.where("[collectionId+version]")
				.between(
					[this.access.collectionId, MIN_IDB_KEY],
					[this.access.collectionId, MAX_IDB_KEY],
					true,
					true
				)
				.first()

			if (!value) {
				return false
			}

			this.data.currentId = value.id
			this.data.lastLoadedVersion = value.version
			return true
		}
	}
}

export class IndexedDBCardSource<T extends { readonly id: string }>
	implements CardSource<T>, AppendDeleteCardSource<T>
{
	private isInitialized = false
	constructor(
		private readonly db: IDBStorageDB<any, any>,
		public readonly collectionId: string
	) {}

	private initialize = async () => {
		if (this.isInitialized) return

		this.isInitialized = true
	}

	private getAndIncrementVersionCounter = async () => {
		return await this.db.transaction(
			"rw?",
			[this.db.cardCollections],
			async () => {
				let collection = await this.db.cardCollections
					.where("id")
					.equals(this.collectionId)
					.first()
				if (!collection) {
					collection = {
						id: this.collectionId,
						name: `Card collection ${this.collectionId}`,
						version: -(2 ** 31),
					}
				}

				const version = collection.version

				collection.version++
				await this.db.cardCollections.put(collection)

				return version
			}
		)
	}

	private makeAccess = (): Access => {
		const self = this

		return {
			initialize: self.initialize,
			collectionId: self.collectionId,
			get db() {
				return self.db
			},
		}
	}

	getCard = async (cardId: string): Promise<T | null> => {
		await this.initialize()

		const res = await this.db.cardCollectionEntries
			.where("[collectionId+id]")
			.equals([this.collectionId, cardId])
			.first()

		if (!res) return null

		return res.data as T
	}

	newCursor = (): CardSourceCursor => {
		return new IndexedDBCardSourceCursor(
			{
				currentId: null,
				lastLoadedVersion: null,
			},
			this,
			this.makeAccess()
		)
	}

	serializeCursor = (cursor: CardSourceCursor) => {
		if (
			!(cursor instanceof IndexedDBCardSourceCursor) ||
			cursor.source !== this
		) {
			throw new Error(
				`Invalid cursor provided. It belongs to other store.`
			)
		}

		return {
			version: 0,
			data: cursor.data,
		}
	}

	deserializeCursor = (data: any): CardSourceCursor => {
		const { version } = data
		if (version !== 0) throw new Error(`Invalid version`)

		return new IndexedDBCardSourceCursor(data.data, this, this.makeAccess())
	}

	append = async (data: T): Promise<void> => {
		await this.initialize()

		await this.db.transaction(
			"rw",
			[this.db.cardCollections, this.db.cardCollectionEntries],
			async () => {
				const version = await this.getAndIncrementVersionCounter()
				await this.db.cardCollectionEntries.put({
					version: version,
					collectionId: this.collectionId,
					id: data.id,
					data,
				})
			}
		)
	}

	delete = async (id: string): Promise<void> => {
		await this.db.cardCollectionEntries
			.where("[collectionId+id]")
			.equals([this.collectionId, id])
			.delete()
	}
}
