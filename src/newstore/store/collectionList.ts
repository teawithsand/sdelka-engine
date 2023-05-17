import { generateUUID } from "../../util/stl"
import { DB } from "../db"
import {
	CardCollectionAccess,
	CardCollectionsStore,
	Collection,
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
	) {}

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
			collectionData: e.collectonData,
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

		const collection: Collection<CollectionData, EngineCollectionData> = {
			id: generateUUID(),
			collectonData: data,
			engineData: null,
			syncKey: extracted.syncKey,
		}

		await this.db.collections.put(collection)

		return {
			id: collection.id,
			collectionData: collection.collectonData,
			engineData: collection.engineData,
		}
	}

	getCollectionEntriesView = (
		id: string
	): (MutableEntriesView<EntryEngineData, EntryData> &
		EngineEntriesView<EntryEngineData, EntryData>) => {

		return new DBCollectionEntriesView(this.db, this.operators, id)
	}

	// for now use bypass - just use cursor and filter on is-in-sync param manually
	getCollectionSyncEntriesView = (
		id: string
	): EntriesView<EntryEngineData, EntryData> => {
		throw new Error("NIY")
	}
}
