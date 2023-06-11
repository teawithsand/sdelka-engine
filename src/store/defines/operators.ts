import { UserEntryData } from "../../card"
import { EngineEntryData } from "../../engine"
import { DerivedUserCollectionDataExtractor } from "./collection"
import {
	DerivedHistoryEntryDataExtractor,
	DerivedUserEntryDataExtractor,
	DerivedEngineEntryDataExtractor,
} from "./derived"

export interface EntryOperators {
	/**
	 * Initializes EngineEntryData from UserEntryData, which can be manipulated by user as the name
	 * suggests.
	 */
	engineDataInitializer: (data: UserEntryData) => EngineEntryData

	/**
	 * Engine data may be influenced by UserData
	 * but not vice versa
	 * this can be set to no-op in case no update is needed
	 */
	engineDataUpdater: (
		newEntryData: UserEntryData,
		engineData: EngineEntryData
	) => EngineEntryData

	engineDataExtractor: DerivedEngineEntryDataExtractor
	cardDataExtractor: DerivedUserEntryDataExtractor
	historyDataExtractor: DerivedHistoryEntryDataExtractor
}

export interface CollectionOperators {
	collectionDataExtractor: DerivedUserCollectionDataExtractor
}
