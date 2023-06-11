import {
	DerivedUserCollectionDataExtractorImpl,
	DerivedEntryUserDataExtractorImpl
} from "../card"
import {
	DerivedEngineEntryDataExtractorImpl,
	EngineEntryDataType
} from "../engine"
import { CollectionOperators, EntryOperators } from "../store"
import { getNowTimestamp } from "../internal/stl"

export const EntryOperatorsImpl: EntryOperators = {
	cardDataExtractor: DerivedEntryUserDataExtractorImpl,
	engineDataExtractor: DerivedEngineEntryDataExtractorImpl,
	engineDataInitializer: (data) => ({
		type: EngineEntryDataType.NEW,
		ordinalNumber: getNowTimestamp() + Math.random(),
		userPriority: data.priority,
		isOutOfSync: true,
	}),
	engineDataUpdater: (entryData, engineData) => {
		if (engineData.type !== EngineEntryDataType.NEW) return engineData

		const newEngineData = { ...engineData }
		newEngineData.userPriority = entryData.priority

		return newEngineData
	},
	historyDataExtractor: (data) => {
		return {
			entryId: data.id,
		}
	},
}

export const CollectionOperatorsImpl: CollectionOperators = {
	collectionDataExtractor: DerivedUserCollectionDataExtractorImpl,
}
