import { CollectionEntity } from "./collection"
import { EngineEntriesView, EntriesView, MutableEntriesView } from "./entryView"

export interface CardCollectionAccess<CLD, ESD, H> {
	updateCollectionData: (data: CLD) => Promise<void>
	updateEngineData: (data: ESD) => Promise<void>
	delete: () => Promise<void>

	pushHistoryEntry: (entry: H) => Promise<void>
	peekHistoryEntry: () => Promise<H | null>
	popHistoryEntry: () => Promise<void>
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
