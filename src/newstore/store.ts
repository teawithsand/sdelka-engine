import {
	AsyncCursor,
	Cursor,
	IDBComparable,
	MAX_IDB_KEY,
	MIN_IDB_KEY,
	idbComparator,
} from "../pubutil"
import { generateUUID } from "../util/stl"
import { DB } from "./db"
import {
	CardCollectionsStore,
	Collection,
	CollectionEntity,
	CollectionOperators,
	EngineEntriesView,
	EntriesView,
	Entry,
	EntryAccess,
	EntryEntity,
	EntryOperators,
	MutableEntriesView,
} from "./defines"

export class DBCardCollectionsStore<CE, CD, SD>
	implements CardCollectionsStore<CE, CD, SD>
{
	constructor(
		private readonly db: DB<CE, CD, SD>,
		private readonly operators: EntryOperators<CE, CD>,
		private readonly collectionOperators: CollectionOperators<SD>
	) {}

	transaction = <R>(cb: () => Promise<R>): Promise<R> => {
		return this.db.transaction(
			"rw",
			[this.db.entries, this.db.collections, this.db.deletedEntries],
			async () => await cb()
		)
	}

	getCollections = async (): Promise<CollectionEntity<SD>[]> => {
		return (await this.db.collections.toArray()).map((e) => ({
			id: e.id,
			data: e.data,
		}))
	}

	createCollection = async (data: SD): Promise<CollectionEntity<SD>> => {
		const extracted = this.collectionOperators.collectionDataExtractor(data)

		const collection: Collection<SD> = {
			id: generateUUID(),
			data: data,
			isOutOfSync: extracted.isOutOfSync,
			syncKey: extracted.syncKey,
		}

		await this.db.collections.put(collection)

		return {
			id: collection.id,
			data,
		}
	}

	updateCollection = async (id: string, data: SD): Promise<void> => {
		const extracted = this.collectionOperators.collectionDataExtractor(data)

		const collection: Collection<SD> = {
			id: id,
			data: data,
			isOutOfSync: extracted.isOutOfSync,
			syncKey: extracted.syncKey,
		}
		await this.db.transaction("rw", [this.db.collections], async () => {
			const prev = await this.db.collections.get(id)
			if (!prev) {
				throw new Error(`Collection with id ${id} does not exist`)
			}
			await this.db.collections.put(collection)
		})
	}

	deleteCollection = async (id: string): Promise<void> => {
		await this.db.transaction(
			"rw",
			[this.db.entries, this.db.collections],
			async () => {
				await this.db.collections.delete(id)
				await this.db.entries.where("collectionId").equals(id).delete()
			}
		)
	}

	getCollectionEntriesView = (
		id: string
	): MutableEntriesView<CE, CD> & EngineEntriesView<CE, CD> => {
		return new DBCollectionEntriesView(this.db, this.operators, id)
	}
	// for now use bypass - just use cursor and filter on is-in-sync param manually
	getCollectionSyncEntriesView = (id: string): EntriesView<CE, CD> => {
		throw new Error("NIY")
	}
}

export class DBEntryAccess<CE, CD> implements EntryAccess<CE, CD> {
	constructor(
		private readonly db: DB<CE, CD, any>,
		private readonly operators: EntryOperators<CE, CD>,
		public readonly id: string
	) {}

	updateEngineData = async (engineData: CE): Promise<void> => {
		this.db.transaction("rw", [this.db.entries], async () => {
			const data = await this.db.entries.get(this.id)
			if (!data) throw new Error(`Entry with id ${this.id} was deleted`)

			const extracted = this.operators.engineDataExtractor(engineData)
			const newData: typeof data = {
				...data,

				engineData,

				queue: extracted.queue,
				queuePriority: extracted.queuePriority,

				isEngineDataOutOfSync: extracted.isOutOfSync,
			}

			await this.db.entries.put(newData)
		})
	}

	updateCardData = async (cardData: CD): Promise<void> => {
		this.db.transaction("rw", [this.db.entries], async () => {
			const data = await this.db.entries.get(this.id)
			if (!data) throw new Error(`Entry with id ${this.id} was deleted`)

			const extracted = this.operators.cardDataExtractor(cardData)
			const newData: typeof data = {
				...data,

				cardData,

				syncKey: extracted.syncKey,
				tags: extracted.tags,
				isCardDataOutOfSync: extracted.isOutOfSync,
			}

			await this.db.entries.put(newData)
		})
	}

	getData = async (): Promise<EntryEntity<CE, CD> | null> => {
		const value = await this.db.entries.get(this.id)
		if (!value) return null

		return {
			id: value.id,
			cardData: value.cardData,
			engineData: value.engineData,
		}
	}

	delete = async (): Promise<void> => {
		await this.db.entries.delete(this.id)
	}
}

export class DBCollectionEntriesView<CE, CD>
	implements
		EntriesView<CE, CD>,
		MutableEntriesView<CE, CD>,
		EngineEntriesView<CE, CD>
{
	constructor(
		private readonly db: DB<CE, CD, any>,
		private readonly operators: EntryOperators<CE, CD>,
		private readonly collectionId: string
	) {}

	iterate = (): Cursor<EntryEntity<CE, CD>> => {
		const query = () =>
			this.db.entries.where("[collectionId+id]").equals(this.collectionId)

		return new AsyncCursor({
			fetch: async (offset, limit) => {
				return await query().offset(offset).limit(limit).toArray()
			},
			count: async () => await query().count(),
		})
	}

	addCard = async (cardData: CD, engineData: CE): Promise<void> => {
		const extractedCard = this.operators.cardDataExtractor(cardData)
		const extractedEngine = this.operators.engineDataExtractor(engineData)

		const entry: Entry<CE, CD> = {
			id: generateUUID(),

			engineData,
			cardData,
			collectionId: this.collectionId,

			syncKey: extractedCard.syncKey,
			tags: extractedCard.tags,
			isCardDataOutOfSync: extractedCard.isOutOfSync,

			queue: extractedEngine.queue,
			queuePriority: extractedEngine.queuePriority,
			isEngineDataOutOfSync: extractedEngine.isOutOfSync,
		}

		await this.db.transaction(
			"rw",
			[this.db.collections, this.db.entries],
			async () => {
				const collection = await this.db.collections.get(
					this.collectionId
				)
				if (!collection) {
					throw new Error(
						`Collection with id ${this.collectionId} does not exist`
					)
				}

				await this.db.entries.put(entry)
			}
		)
	}

	getData = async (id: string): Promise<EntryEntity<CE, CD> | null> => {
		return (await (await this.getAccess(id)).getData()) ?? null
	}

	getAccess = async (id: string): Promise<EntryAccess<CE, CD>> => {
		return new DBEntryAccess(this.db, this.operators, id)
	}

	getTopmostQueueEntry = async (
		queues: IDBComparable[]
	): Promise<string | null> => {
		const results: Entry<CE, CD>[] = []

		for (const queue of queues) {
			const entry = await this.db.entries
				.where("[collectionId+queue+queuePriority]")
				.between(
					[this.collectionId, queue, MIN_IDB_KEY],
					[this.collectionId, queue, MAX_IDB_KEY]
				)
				.first()

			if (!entry) continue

			results.push(entry)
		}

		if (!results.length) return null
		results.sort((a, b) => idbComparator(a.queuePriority, b.queuePriority))
		return results[0].id
	}

	getQueueLength = async (queue: IDBComparable): Promise<number> => {
		return await this.db.entries
			.where("[collectionId+queue+queuePriority]")
			.between(
				[this.collectionId, queue, MIN_IDB_KEY],
				[this.collectionId, queue, MAX_IDB_KEY]
			)
			.count()
	}
}
