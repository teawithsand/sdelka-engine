import { CollectionEntity } from "./collection"
import { EngineEntriesView, EntriesView, MutableEntriesView } from "./entryView"

export interface CardCollectionAccess<
	CollectionData,
	EngineCollectionData,
	HistoryEntry
> {
	updateCollectionData: (data: CollectionData) => Promise<void>
	updateEngineData: (data: EngineCollectionData) => Promise<void>
	delete: () => Promise<void>

	pushHistoryEntry: (entry: HistoryEntry) => Promise<void>
	peekHistoryEntry: () => Promise<HistoryEntry | null>
	popHistoryEntry: () => Promise<void>

	getData: () => Promise<CollectionEntity<
		CollectionData,
		EngineCollectionData
	> | null | null>
}

export interface CardCollectionsStore<
	CardEngineData,
	CardData,
	CollectionData,
	EngineCollectionData,
	EngineHistoryData
> {
	transaction: <R>(cb: () => Promise<R>) => Promise<R>

	getCollections: () => Promise<
		CollectionEntity<CollectionData, EngineCollectionData>[]
	>
	createCollection: (
		collectionData: CollectionData
	) => Promise<CollectionEntity<CollectionData, EngineCollectionData>>

	getAccess: (
		id: string
	) => Promise<
		CardCollectionAccess<
			CollectionData,
			EngineCollectionData,
			EngineHistoryData
		>
	>

	getCollectionEntriesView: (
		id: string
	) => MutableEntriesView<CardEngineData, CardData> &
		EngineEntriesView<CardEngineData, CardData>

	getCollectionSyncEntriesView: (
		id: string
	) => EntriesView<CardEngineData, CardData>
}
