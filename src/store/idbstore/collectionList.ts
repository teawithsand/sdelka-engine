import { generateUUID } from "../../util/stl"
import { DBCollection, DB } from "../db"
import {
	CardCollectionAccess,
	CardCollectionsStore,
	CollectionEntity,
	CollectionOperators,
	EngineEntriesView,
	EntriesView,
	EntryOperators,
	MutableEntriesView,
} from "../defines"
import { DBCollectionAccess } from "./collectionAccess"
import { DBCollectionEntriesView } from "./collectionEntriesView"

export class DBCollectionsStore<
	EntryEngineData,
	EntryData,
	CollectionData,
	EngineCollectionData,
	EngineHistoryData
> implements
	CardCollectionsStore<
		EntryEngineData,
		EntryData,
		CollectionData,
		EngineCollectionData,
		EngineHistoryData
	>
{
	constructor(
		private readonly db: DB<
			EntryEngineData,
			EntryData,
			CollectionData,
			EngineCollectionData,
			EngineHistoryData
		>,
		private readonly operators: EntryOperators<
			EntryEngineData,
			EntryData,
			EngineHistoryData
		>,
		private readonly collectionOperators: CollectionOperators<CollectionData>
	) { }

	transaction = <R>(cb: () => Promise<R>): Promise<R> => {
		return this.db.transaction(
			"rw",
			[
				this.db.entries,
				this.db.collections,
				this.db.deletedEntries,
				this.db.historyEntries,
			],
			async () => await cb()
		)
	}

	getCollections = async (): Promise<
		CollectionEntity<CollectionData, EngineCollectionData>[]
	> => {
		return (await this.db.collections.toArray()).map((e) => ({
			id: e.id,
			collectionData: e.collectionData,
			engineData: e.engineData,
		}))
	}

	getAccess = async (
		id: string
	): Promise<
		CardCollectionAccess<
			CollectionData,
			EngineCollectionData,
			EngineHistoryData
		>
	> => {
		return new DBCollectionAccess(this.db, id, this.operators)
	}

	createCollection = async (
		data: CollectionData
	): Promise<CollectionEntity<CollectionData, EngineCollectionData>> => {
		const extracted = this.collectionOperators.collectionDataExtractor(data)

		const collection: DBCollection<CollectionData, EngineCollectionData> = {
			id: generateUUID(),
			collectionData: data,
			engineData: null,
			syncKey: extracted.syncKey,
		}

		await this.db.collections.put(collection)

		return {
			id: collection.id,
			collectionData: collection.collectionData,
			engineData: collection.engineData,
		}
	}

	getCollectionEntriesView = (
		id: string
	): MutableEntriesView<EntryEngineData, EntryData> &
		EngineEntriesView<EntryEngineData, EntryData> => {
		return new DBCollectionEntriesView(this.db, this.operators, id)
	}

	// for now use bypass - just use cursor and filter on is-in-sync param manually
	getCollectionSyncEntriesView = (
		id: string
	): EntriesView<EntryEngineData, EntryData> => {
		throw new Error("NIY")
	}

	clear = async () => {
		await this.transaction(async () => {
			await this.db.entries.clear()
			await this.db.collections.clear()
			await this.db.deletedEntries.clear()
			await this.db.historyEntries.clear()
		})
	}
}
