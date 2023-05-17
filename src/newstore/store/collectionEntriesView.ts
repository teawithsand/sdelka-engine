import {
	AsyncCursor,
	Cursor,
	IDBComparable,
	MAX_IDB_KEY,
	MIN_IDB_KEY,
	idbComparator,
} from "../../pubutil"
import { generateUUID } from "../../util/stl"
import { DB } from "../db"
import {
	EngineEntriesView,
	EntriesView,
	Entry,
	EntryAccess,
	EntryEntity,
	EntryOperators,
	MutableEntriesView,
} from "../defines"
import { DBEntryAccess } from "./entryAccess"

export class DBCollectionEntriesView<EngineEntryData, EntryData>
	implements
		EntriesView<EngineEntryData, EntryData>,
		MutableEntriesView<EngineEntryData, EntryData>,
		EngineEntriesView<EngineEntryData, EntryData>
{
	constructor(
		private readonly db: DB<EngineEntryData, EntryData, any, any, any>,
		private readonly operators: EntryOperators<
			EngineEntryData,
			EntryData,
			any
		>,
		private readonly collectionId: string
	) {}

	iterate = (): Cursor<EntryEntity<EngineEntryData, EntryData>> => {
		const query = () =>
			this.db.entries.where("[collectionId+id]").equals(this.collectionId)

		return new AsyncCursor({
			fetch: async (offset, limit) => {
				return await query().offset(offset).limit(limit).toArray()
			},
			count: async () => await query().count(),
		})
	}

	addCard = async (
		cardData: EntryData,
		engineData: EngineEntryData
	): Promise<void> => {
		const extractedCard = this.operators.cardDataExtractor(cardData)
		const extractedEngine = this.operators.engineDataExtractor(engineData)

		const entry: Entry<EngineEntryData, EntryData> = {
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

	getData = async (
		id: string
	): Promise<EntryEntity<EngineEntryData, EntryData> | null> => {
		return (await (await this.getAccess(id)).getData()) ?? null
	}

	getAccess = async (
		id: string
	): Promise<EntryAccess<EngineEntryData, EntryData>> => {
		return new DBEntryAccess(this.db, this.operators, id)
	}

	getTopmostQueueEntry = async (
		queues: IDBComparable[]
	): Promise<string | null> => {
		const results: Entry<EngineEntryData, EntryData>[] = []

		for (const queue of queues) {
			const entry = await this.db.entries
				.where("[collectionId+queue+queuePriority]")
				.between(
					[this.collectionId, queue, MIN_IDB_KEY],
					[this.collectionId, queue, MAX_IDB_KEY],
					true,
					true
				)
				.first()

			if (!entry) continue

			results.push(entry)
		}

		if (!results.length) return null
		results.sort((a, b) => idbComparator(a.queuePriority, b.queuePriority))
		return results[0].id
	}

	getQueueLengthUntil = async (
		queue: IDBComparable,
		element: IDBComparable
	): Promise<number> => {
		return await this.db.entries
			.where("[collectionId+queue+queuePriority]")
			.between(
				[this.collectionId, queue, MIN_IDB_KEY],
				[this.collectionId, queue, element],
				true,
				false
			)
			.count()
	}

	getQueueLengthAfter = async (
		queue: IDBComparable,
		element: IDBComparable
	): Promise<number> => {
		return await this.db.entries
			.where("[collectionId+queue+queuePriority]")
			.between(
				[this.collectionId, queue, element],
				[this.collectionId, queue, MAX_IDB_KEY],
				false,
				true
			)
			.count()
	}

	getQueueLength = async (queue: IDBComparable): Promise<number> => {
		return await this.db.entries
			.where("[collectionId+queue+queuePriority]")
			.between(
				[this.collectionId, queue, MIN_IDB_KEY],
				[this.collectionId, queue, MAX_IDB_KEY],
				true,
				true
			)
			.count()
	}
}
