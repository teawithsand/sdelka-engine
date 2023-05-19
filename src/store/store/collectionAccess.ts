import { MAX_IDB_KEY, MIN_IDB_KEY } from "../../pubutil"
import { generateUUID, throwExpression } from "../../util/stl"
import { DB } from "../db"
import {
	CardCollectionAccess,
	CollectionEntity,
	EntryOperators,
} from "../defines"

export class DBCollectionAccess<
	CollectionData,
	EngineCollectionData,
	EngineHistoryData
> implements
		CardCollectionAccess<
			CollectionData,
			EngineCollectionData,
			EngineHistoryData
		>
{
	constructor(
		private readonly db: DB<
			any,
			any,
			CollectionData,
			EngineCollectionData,
			EngineHistoryData
		>,
		public readonly collectionId: string,
		private readonly operators: EntryOperators<any, any, EngineHistoryData>
	) {}

	private obtainData = async () => {
		const data = await this.db.collections.get(this.collectionId)
		if (!data) {
			throw new Error(
				`Collection with id ${this.collectionId} was deleted`
			)
		}

		return data
	}

	public getData = async (): Promise<CollectionEntity<
		any,
		EngineCollectionData
	> | null> => {
		const data = await this.db.collections.get(this.collectionId)
		if (!data) return null

		return {
			id: this.collectionId,
			collectionData: data.collectionData,
			engineData: data.engineData,
		}
	}

	updateCollectionData = async (data: CollectionData): Promise<void> => {
		await this.db.transaction("rw", [this.db.collections], async () => {
			const collection = await this.obtainData()
			collection.collectionData = data
			await this.db.collections.put(collection)
		})
	}

	updateEngineData = async (data: EngineCollectionData): Promise<void> => {
		await this.db.transaction("rw", [this.db.collections], async () => {
			const collection = await this.obtainData()
			collection.engineData = data
			await this.db.collections.put(collection)
		})
	}

	delete = async (): Promise<void> => {
		await this.db.transaction(
			"rw",
			[
				this.db.collections,
				this.db.historyEntries,
				this.db.entries,
				this.db.deletedEntries,
			],
			async () => {
				await this.db.collections.delete(this.collectionId)
				await this.db.entries
					.where("collectionId")
					.equals(this.collectionId)
					.delete()
				await this.db.historyEntries
					.where("collectionId")
					.equals(this.collectionId)
					.delete()
				await this.db.deletedEntries
					.where("collectionId")
					.equals(this.collectionId)
					.delete()
			}
		)
	}

	pushHistoryEntry = async (entry: EngineHistoryData): Promise<void> => {
		await this.db.transaction(
			"rw",
			[this.db.collections, this.db.historyEntries],
			async () => {
				await this.obtainData()

				const count = await this.db.historyEntries
					.where("[collectionId+ordinalNumber]")
					.between(
						[this.collectionId, MIN_IDB_KEY],
						[this.collectionId, MAX_IDB_KEY],
						true,
						true
					)
					.count()

				const lastOrdinalNumber =
					(
						await this.db.historyEntries
							.where("[collectionId+ordinalNumber]")
							.between(
								[this.collectionId, MIN_IDB_KEY],
								[this.collectionId, MAX_IDB_KEY],
								true,
								true
							)
							.last()
					)?.ordinalNumber ?? -(2 ** 31)

				if (count > 200) {
					const entry = await this.db.historyEntries
						.where("[collectionId+ordinalNumber]")
						.between(
							[this.collectionId, MIN_IDB_KEY],
							[this.collectionId, MAX_IDB_KEY],
							true,
							true
						)
						.first()

					if (entry) {
						await this.db.historyEntries.delete(entry.id)
					}
				}

				await this.db.historyEntries.put({
					id: generateUUID(),
					collectionId: this.collectionId,
					data: entry,
					entryId: this.operators.historyDataExtractor(entry).entryId,
					ordinalNumber: lastOrdinalNumber + 1,
				})
			}
		)
	}

	peekHistoryEntry = async (): Promise<EngineHistoryData | null> => {
		const data = await this.db.historyEntries
			.where("[collectionId+ordinalNumber]")
			.between(
				[this.collectionId, MIN_IDB_KEY],
				[this.collectionId, MAX_IDB_KEY],
				true,
				true
			)
			.last()
		if (!data) return null

		return data.data
	}

	popHistoryEntry = async (): Promise<void> => {
		const data = await this.db.historyEntries
			.where("[collectionId+ordinalNumber]")
			.between(
				[this.collectionId, MIN_IDB_KEY],
				[this.collectionId, MAX_IDB_KEY],
				true,
				true
			)
			.last()
		if (!data) return

		await this.db.collections.delete(data.id)
	}
}
