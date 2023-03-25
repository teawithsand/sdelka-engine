import { throwExpression } from "@teawithsand/tws-stl"
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
	advance = async (n: number) => {
		await this.access.initialize()

		if (!isFinite(n) || n < 0 || Math.round(n) !== n)
			throw new Error(
				`Invalid value to advance by was provided; got ${n}`
			)

		let usedStartElementHack = false

		// Well, this could be solved in more elegant way
		// but this will do
		// this way we ensure that lastLoadedVersion is not like
		// [/null id/, /1st element/, /2nd element/, ...]
		// but more like
		// [/1st element/, /2nd element/, ...]
		// with index-based pointer eq to 0 always pointing to 1st element
		if (n > 0 && this.data.lastLoadedVersion === null) {
			const res = await this.next()
			if (!res) return 0
			usedStartElementHack = true
			n--
		}

		if (n === 0) return usedStartElementHack ? 1 : 0

		const startSearchVersion =
			this.data.lastLoadedVersion ??
			throwExpression(
				new Error("Start search version may not be null here")
			)

		const queryIndex = (i: number) => {
			return (
				this.access.db.cardCollectionEntries
					.where("[collectionId+version]")
					.between(
						[this.access.collectionId, startSearchVersion],
						[this.access.collectionId, MAX_IDB_KEY],
						true,
						true
					)
					.offset(i)
					.first() ?? null
			)
		}

		let start = 0
		let end = n

		// Using binary search makes assumption about versions more mild
		// then we do not require versions to incrementally grow by one
		// this is required, since we can remove cards
		while (start < end) {
			// Find the mid index
			const mid = Math.floor((start + end) / 2)

			const entry = await queryIndex(mid)

			if (!entry) end = mid
			else start = mid + 1
		}

		let entry = null
		for (;;) {
			if (start < 0) break
			entry = await queryIndex(start)
			if (!entry) {
				start--
			} else {
				break
			}
		}
		if (entry) {
			this.data.currentId = entry.id
			this.data.lastLoadedVersion = entry.version
		}

		return start + (usedStartElementHack ? 1 : 0)
	}

	left = async () => {
		await this.access.initialize()

		const lastLoadedVersion = this.data.lastLoadedVersion ?? MIN_IDB_KEY
		return await this.access.db.cardCollectionEntries
			.where("[collectionId+version]")
			.between(
				[this.access.collectionId, lastLoadedVersion],
				[this.access.collectionId, MAX_IDB_KEY],
				false,
				true
			)
			.count()
	}

	clone = () => {
		return new IndexedDBCardSourceCursor<T>(
			{ ...this.data },
			this.source,
			this.access
		) as this
	}

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

	private getNextVersion = async () => {
		return await this.db.transaction(
			"rw?",
			[this.db.cardCollectionEntries],
			async () => {
				const entry = await this.db.cardCollectionEntries
					.where("[collectionId+version]")
					.between(
						[this.collectionId, MIN_IDB_KEY],
						[this.collectionId, MAX_IDB_KEY]
					)
					.last()

				if (!entry) return -(2 ** 31)
				return entry.version + 1
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
			[this.db.cardCollectionEntries],
			async () => {
				const version = await this.getNextVersion()
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
