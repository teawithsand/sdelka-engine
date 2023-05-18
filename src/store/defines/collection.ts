export type CollectionDerivedDataExtractor<T> = (
	data: T
) => CollectionDerivedData

export interface CollectionDerivedData {
	syncKey: string
	isOutOfSync: boolean
}

export type Collection<CLD, ESD> = {
	// embedded
	collectionData: CLD
	engineData: ESD | null

	// own
	id: string

	// sync
	syncKey: string
}

export interface CollectionEntity<CLD, ESD> {
	id: string
	collectionData: CLD
	engineData: ESD | null
}
