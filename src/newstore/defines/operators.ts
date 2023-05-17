import { CollectionDerivedDataExtractor } from "./collection"
import {
	EntryCardDerivedDataExtractor,
	EntryEngineDerivedDataExtractor,
	HistoryEntryDerivedDataExtractor,
} from "./entry"

export interface EntryOperators<EngineEntryData, EntryData, HistoryData> {
	engineDataExtractor: EntryEngineDerivedDataExtractor<EngineEntryData>
	cardDataExtractor: EntryCardDerivedDataExtractor<EntryData>
	historyDataExtractor: HistoryEntryDerivedDataExtractor<HistoryData>
}

export interface CollectionOperators<SD> {
	collectionDataExtractor: CollectionDerivedDataExtractor<SD>
}
