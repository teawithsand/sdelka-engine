import { UserCollectionData, UserEntryData } from "../card"
import {
	EngineConfig,
	EngineEntryData,
	EngineHistoryData,
	EngineImpl,
	EngineCollectionData,
} from "../engine"
import { DBEngineStorage } from "../engine/storage/viewstorage"
import { Clock, SystemClock } from "../pubutil"
import { DB, DBCollectionsStore } from "../store"
import { CollectionOperatorsImpl, EntryOperatorsImpl } from "./operators"

export interface AppEngineOpts {
	clockOverride?: Clock
}

export interface App {
	db: DB<
		EngineEntryData,
		UserEntryData,
		UserCollectionData,
		EngineCollectionData,
		EngineHistoryData
	>
	store: DBCollectionsStore<
		EngineEntryData,
		UserEntryData,
		UserCollectionData,
		EngineCollectionData,
		EngineHistoryData
	>

	getEngine: (
		collectionId: string,
		config: EngineConfig,
		opts?: AppEngineOpts
	) => Promise<EngineImpl | null>
}

export interface AppInitOptions {
	dbName?: string
}

export const initializeApp = async (
	appOptions?: AppInitOptions
): Promise<App> => {
	const db = new DB<
		EngineEntryData,
		UserEntryData,
		UserCollectionData,
		EngineCollectionData,
		EngineHistoryData
	>(appOptions?.dbName ?? "sdelka-default-db")

	const store = new DBCollectionsStore(
		db,
		EntryOperatorsImpl,
		CollectionOperatorsImpl
	)

	return {
		db,
		store,

		getEngine: async (
			id: string,
			config: EngineConfig,
			opts?: AppEngineOpts
		) => {
			const view = store.getCollectionEntriesView(id)
			const access = await store.getAccess(id)

			const engineStorage = new DBEngineStorage(store, view, access)

			const clock = opts?.clockOverride ?? new SystemClock(0)
			const engine = new EngineImpl(engineStorage, clock, config)

			return engine
		},
	}
}
