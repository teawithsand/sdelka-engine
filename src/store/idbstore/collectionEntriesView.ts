import { UserEntryData } from "../../card"
import {
	AsyncCursor,
	Cursor,
	IDBComparable,
	MAX_IDB_KEY,
	MIN_IDB_KEY,
	idbComparator,
} from "../../pubutil"
import { generateUUID } from "../../util/stl"
import { DB, DBEntry } from "../db"
import {
	EngineEntriesView,
	EntriesView,
	EntryAccess,
	EntryEntity,
	EntryOperators,
	MutableEntriesView,
} from "../defines"
import { DBEntryAccess } from "./entryAccess"

export class DBCollectionEntriesView
	implements
	EntriesView,
	MutableEntriesView,
	EngineEntriesView {
	constructor(
		private readonly db: DB,
		private readonly operators: EntryOperators,
		private readonly collectionId: string
	) { }

	iterate = (): Cursor<EntryEntity> => {
		const query = () =>
			this.db.entries
				.where("[collectionId+id]")
				.between(
					[this.collectionId, MIN_IDB_KEY],
					[this.collectionId, MAX_IDB_KEY],
					true,
					true
				)

		return new AsyncCursor({
			fetch: async (offset, limit) => {
				return (
					await query().offset(offset).limit(limit).toArray()
				).map(
					(e): EntryEntity => ({
						id: e.id,
						userData: e.userData,
						engineData: e.engineData,
					})
				)
			},
			count: async () => await query().count(),
		})
	}

	addCard = async (
		userData: UserEntryData
	): Promise<EntryEntity> => {
		const extractedCard = this.operators.cardDataExtractor(userData)
		const engineData = this.operators.engineDataInitializer(userData)
		const extractedEngine = this.operators.engineDataExtractor(engineData)

		const entry: DBEntry = {
			id: generateUUID(),

			engineData,
			userData: userData,
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

		return {
			id: entry.id,
			engineData: entry.engineData,
			userData: entry.userData,
		}
	}

	getData = async (
		id: string
	): Promise<EntryEntity | null> => {
		return (await (await this.getAccess(id)).getData()) ?? null
	}

	getAccess = async (
		entryId: string
	): Promise<EntryAccess> => {
		return new DBEntryAccess(
			this.db,
			this.operators,
			entryId,
			this.collectionId
		)
	}

	getTopmostQueueEntry = async (
		queues: IDBComparable[]
	): Promise<string | null> => {
		const results: DBEntry[] = []

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

	getQueueLengthInRange = async (
		queue: IDBComparable,
		from: IDBComparable,
		to: IDBComparable,
		startIncl: boolean,
		endIncl: boolean
	): Promise<number> => {
		return await this.db.entries
			.where("[collectionId+queue+queuePriority]")
			.between(
				[this.collectionId, queue, from],
				[this.collectionId, queue, to],
				startIncl,
				endIncl
			)
			.count()
	}
}
