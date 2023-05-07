import { AsyncCursor, Cursor, MAX_IDB_KEY, MIN_IDB_KEY } from "../pubutil"
import { IndexedDBCardStorageDB } from "./idbStorageDB"
import { CardDataExtractor, CardFilter } from "./storage"

// TODO(teawithsand): remodel this to collection storage

export class IndexedDBCardStorage<C> {
	constructor(
		private readonly db: IndexedDBCardStorageDB<any, C>,
		private readonly extractor: CardDataExtractor<C>,
		private readonly collectionId: string
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

	getCard = async (cardId: string): Promise<C | null> =>
		(await this.db.cards.get([this.collectionId, cardId]))?.data ?? null

	deleteCard = async (cardId: string): Promise<void> =>
		await this.db.cards.delete([this.collectionId, cardId])

	putCard = async (cardData: C): Promise<void> => {
		const metadata = this.extractor(cardData)

		if (metadata.collectionId !== this.collectionId) {
			throw new Error(
				`Collection id mismatch; card has to belong to collection ${this.collectionId}`
			)
		}

		await this.db.transaction(
			"rw",
			[this.db.cards, this.db.collections],
			async () => {
				const collectionData = await this.db.collections.get(
					this.collectionId
				)
				if (!collectionData) {
					throw new Error(
						`Collection associated with this card store was not found(id ${this.collectionId})`
					)
				}

				await this.db.cards.put({
					id: metadata.id,

					priority: metadata.priority,
					tags: metadata.tags,
					collectionId: metadata.collectionId,
					ndtsc: collectionData.cardModifyNdtsc,

					data: cardData,
				})

				collectionData.cardModifyNdtsc += 1
				await this.db.collections.put(collectionData)
			}
		)
	}

	getCards = (filter: CardFilter): Cursor<C> => {
		const { hasTag } = filter

		const makeQuery = (offset: number, limit: number | null) => {
			return (
				this.db.cards
					.where("[collectionId+*tags]")
					// TODO(teawithsand): check if this min/max key works for compound indexes
					.between(
						[this.collectionId, hasTag ?? MIN_IDB_KEY],
						[this.collectionId, hasTag ?? MAX_IDB_KEY],
						true,
						true
					)
					.offset(offset)
					.limit(limit ?? 2 ** 32) // some large number here as limit fallback
			)
		}

		return new AsyncCursor({
			fetch: async (offset, limit) =>
				(await makeQuery(offset, limit).toArray()).map((e) => e.data),
			count: async () => await makeQuery(0, null).count(),
		})
	}
}
