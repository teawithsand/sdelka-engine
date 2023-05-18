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
		public readonly id: string
	) {}

	updateEngineData = async (engineData: EntryEngineData): Promise<void> => {
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

	updateCardData = async (cardData: EntryData): Promise<void> => {
		this.db.transaction("rw", [this.db.entries], async () => {
			const data = await this.db.entries.get(this.id)
			if (!data) throw new Error(`Entry with id ${this.id} was deleted`)

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
		const value = await this.db.entries.get(this.id)
		if (!value) return null

		return {
			id: value.id,
			userData: value.userData,
			engineData: value.engineData,
		}
	}

	delete = async (): Promise<void> => {
		await this.db.entries.delete(this.id)
	}
}
