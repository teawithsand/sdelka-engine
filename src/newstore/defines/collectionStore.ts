import { CollectionDerivedDataExtractor, CollectionEntity } from "./collection"
import {
	EntryCardDerivedDataExtractor,
	EntryEngineDerivedDataExtractor,
} from "./entry"
import { EngineEntriesView, EntriesView, MutableEntriesView } from "./entryView"

export interface EntryOperators<CE, CD> {
	defaultEngineDataGenerator: (cardData: CD) => CE
	engineDataExtractor: EntryEngineDerivedDataExtractor<CE>
	cardDataExtractor: EntryCardDerivedDataExtractor<CD>
}

export interface CollectionOperators<SD> {
	collectionDataExtractor: CollectionDerivedDataExtractor<SD>
}

export interface CardCollectionsStore<CE, CD, SD> {
	transaction: <R>(cb: () => Promise<R>) => Promise<R>

	getCollections: () => Promise<CollectionEntity<SD>[]>

	createCollection: (data: SD) => Promise<CollectionEntity<SD>>
	updateCollection: (id: string, data: SD) => Promise<void>
	deleteCollection: (id: string) => Promise<void>

	getCollectionEntriesView: (
		id: string
	) => MutableEntriesView<CE, CD> & EngineEntriesView<CE, CD>

	getCollectionSyncEntriesView: (id: string) => EntriesView<CE, CD>
}
