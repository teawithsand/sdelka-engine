import { AsyncCursor, Cursor, IDB_LIMIT_INF } from "../pubutil"
import { IndexedDBCardStorage } from "./idbCardStorage"
import { IndexedDBCardStorageDB } from "./idbStorageDB"
import {
	CardCollectionStorage,
	CardDataExtractor,
	CardStorage,
	CollectionDataExtractor,
} from "./storage"

// TODO(teawithsand): remodel this to collection storage

export class IndexedDBCollectionStorage<T, C>
	implements CardCollectionStorage<T, C>
{
	constructor(
		private readonly db: IndexedDBCardStorageDB<T, C>,
		private readonly cardDataExtractor: CardDataExtractor<C>,
		private readonly collectionDataExtractor: CollectionDataExtractor<T>
	) {}

	transaction = async <R>(callback: () => Promise<R>): Promise<R> => {
		return await this.db.transaction(
			"rw",
			[this.db.cards, this.db.collections],
			// although seems redundant, it's safer to keep awaits here, since tx promises
			// are not real promises
			async () => await callback()
		)
	}

	putCollection = async (data: T): Promise<void> => {
		const extracted = this.collectionDataExtractor(data)
		await this.db.collections.put({
			id: extracted.id,
			cardModifyNdtsc: extracted.cardModifyNdtsc,
			data,
		})
	}
	deleteCollection = async (id: string): Promise<void> => {
		await this.db.transaction(
			"rw",
			[this.db.cards, this.db.collections],
			async () => {
				await this.db.collections.where("id").equals(id).delete()
				await this.db.cards.where("collectionId").equals(id).delete()
			}
		)
	}

	getCollections = (): Cursor<T> => {
		const makeQuery = (offset: number, limit: number | null) => {
			return this.db.collections
				.offset(offset)
				.limit(limit ?? IDB_LIMIT_INF)
		}

		return new AsyncCursor({
			fetch: async (offset, limit) =>
				(await makeQuery(offset, limit).toArray()).map((e) => e.data),
			count: async () => await makeQuery(0, null).count(),
		})
	}

	getCollectionCards = async (id: string): Promise<CardStorage<C>> => {
		const res = await this.db.collections.where("id").equals(id).first()
		if (!res)
			throw new Error(
				`Can't obtain access for collection with id ${id} as it does not exist`
			)

		return new IndexedDBCardStorage(this.db, this.cardDataExtractor, id)
	}
}
