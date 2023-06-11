import { UserCollectionData } from "../../card"
import { EngineCollectionData } from "../../engine"

export type DerivedUserCollectionDataExtractor = (
	data: UserCollectionData
) => DerivedUserCollectionData

export interface DerivedUserCollectionData {
	syncKey: string
	isOutOfSync: boolean
}

export interface CollectionEntity {
	id: string
	collectionData: UserCollectionData
	engineData: EngineCollectionData | null
}
