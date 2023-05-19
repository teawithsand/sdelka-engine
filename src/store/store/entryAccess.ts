import { generateUUID } from "../../util/stl"
import { DB } from "../db"
import { EntryAccess, EntryEntity, EntryOperators } from "../defines"

export class DBEntryAccess<EntryEngineData, EntryData>
	implements EntryAccess<EntryEngineData, EntryData>
{
	constructor(
		private readonly db: DB<EntryEngineData, EntryData, any, any, any>,
		private readonly operators: EntryOperators<
			EntryEngineData,
			EntryData,
			any
		>,
		public readonly entryId: string,
		public readonly collectionId: string
	) {}

	updateEngineData = async (engineData: EntryEngineData): Promise<void> => {
		this.db.transaction("rw", [this.db.entries], async () => {
			const data = await this.db.entries.get(this.entryId)
			if (!data)
				throw new Error(`Entry with id ${this.entryId} was deleted`)

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

	updateCardData = async (cardData: EntryData): Promise<void> => {
		this.db.transaction("rw", [this.db.entries], async () => {
			const data = await this.db.entries.get(this.entryId)
			if (!data)
				throw new Error(`Entry with id ${this.entryId} was deleted`)

			const extracted = this.operators.cardDataExtractor(cardData)
			const newData: typeof data = {
				...data,

				engineData: this.operators.engineDataUpdater(
					cardData,
					data.engineData
				),
				userData: cardData,

				syncKey: extracted.syncKey,
				tags: extracted.tags,
				isCardDataOutOfSync: extracted.isOutOfSync,
			}

			await this.db.entries.put(newData)
		})
	}

	getData = async (): Promise<EntryEntity<
		EntryEngineData,
		EntryData
	> | null> => {
		const value = await this.db.entries.get(this.entryId)
		if (!value) return null

		return {
			id: value.id,
			userData: value.userData,
			engineData: value.engineData,
		}
	}

	delete = async (): Promise<void> => {
		await this.db.transaction(
			"rw",
			[this.db.entries, this.db.deletedEntries, this.db.collections],
			async () => {
				const collection = await this.db.collections.get(
					this.collectionId
				)
				if (!collection) return

				const entry = await this.db.entries.get(this.entryId)
				if (!entry) return

				await this.db.entries.delete(this.entryId)

				await this.db.deletedEntries.put({
					id: generateUUID(),
					entryId: entry.id,
					collectionId: this.collectionId,
					collectionSyncKey: collection.syncKey,
					entrySyncKey: entry.syncKey,
				})
			}
		)
	}
}
