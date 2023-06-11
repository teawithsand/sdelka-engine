import produce from "immer"
import {
	UserCollectionData,
	UserCollectionDataExtractor,
	UserEntryData,
	UserEntryDataExtractor,
} from "../card"
import {
	EngineDataExtractor,
	EngineEntryData,
	EngineEntryDataType,
	EngineHistoryData,
} from "../engine"
import { CollectionOperators, EntryOperators } from "../store"
import { getNowTimestamp } from "../util/stl"

export const EntryOperatorsImpl: EntryOperators<
	EngineEntryData,
	UserEntryData,
	EngineHistoryData
> = {
	cardDataExtractor: UserEntryDataExtractor,
	engineDataExtractor: EngineDataExtractor,
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

export const CollectionOperatorsImpl: CollectionOperators<UserCollectionData> = {
	collectionDataExtractor: UserCollectionDataExtractor,
}
