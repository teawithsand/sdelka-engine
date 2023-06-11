import { UserEntryData } from "../../card"
import { EngineEntryData } from "../../engine"
import { generateUUID } from "../../util/stl"
import { DB } from "../db"
import { EntryAccess, EntryEntity, EntryOperators } from "../defines"

export class DBEntryAccess
	implements EntryAccess {
	constructor(
		private readonly db: DB,
		private readonly operators: EntryOperators,
		public readonly entryId: string,
		public readonly collectionId: string
	) { }

	updateEngineData = async (engineData: EngineEntryData): Promise<void> => {
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

	updateUserData = async (cardData: UserEntryData): Promise<void> => {
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

	getData = async (): Promise<EntryEntity | null> => {
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
