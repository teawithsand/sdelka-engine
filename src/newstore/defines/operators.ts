import { CollectionDerivedDataExtractor } from "./collection"
import {
	DerivedHistoryDataExtractor,
	DerivedEntryUserDataExtractor,
	DerivedEntryEngineDataExtractor,
} from "./derived"

export interface EntryOperators<EngineEntryData, UserData, HistoryData> {
	engineDataInitializer: (data: UserData) => EngineEntryData

	// Engine data may be influenced by UserData
	// but not vice versa
	// this can be set to no-op in case no update is needed
	engineDataUpdater: (
		newEntryData: UserData,
		engineData: EngineEntryData
	) => EngineEntryData

	engineDataExtractor: DerivedEntryEngineDataExtractor<EngineEntryData>
	cardDataExtractor: DerivedEntryUserDataExtractor<UserData>
	historyDataExtractor: DerivedHistoryDataExtractor<HistoryData>
}

export interface CollectionOperators<CollectionData> {
	collectionDataExtractor: CollectionDerivedDataExtractor<CollectionData>
}
