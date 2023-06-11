import { UserCollectionData } from "../../card"
import { EngineCollectionData, EngineHistoryData } from "../../engine"
import { CollectionEntity } from "./collection"
import { EngineEntriesView, EntriesView, MutableEntriesView } from "./entryView"

export interface CardCollectionAccess {
	updateCollectionData: (data: UserCollectionData) => Promise<void>
	updateEngineData: (data: EngineCollectionData) => Promise<void>
	delete: () => Promise<void>

	pushHistoryEntry: (entry: EngineHistoryData) => Promise<void>
	peekHistoryEntry: () => Promise<EngineHistoryData | null>
	popHistoryEntry: () => Promise<void>

	getData: () => Promise<CollectionEntity | null>
}

export interface CardCollectionsStore {
	transaction: <R>(cb: () => Promise<R>) => Promise<R>

	getCollections: () => Promise<
		CollectionEntity[]
	>
	createCollection: (
		collectionData: UserCollectionData
	) => Promise<CollectionEntity>

	getAccess: (
		id: string
	) => Promise<
		CardCollectionAccess
	>

	getCollectionEntriesView: (
		id: string
	) => MutableEntriesView &
		EngineEntriesView

	getCollectionSyncEntriesView: (
		id: string
	) => EntriesView
}
