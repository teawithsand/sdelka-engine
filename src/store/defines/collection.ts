export type CollectionDerivedDataExtractor<T> = (
	data: T
) => CollectionDerivedData

export interface CollectionDerivedData {
	syncKey: string
	isOutOfSync: boolean
}

export interface CollectionEntity<CLD, ESD> {
	id: string
	collectionData: CLD
	engineData: ESD | null
}
