export type CollectionDerivedDataExtractor<T> = (
	data: T
) => CollectionDerivedData

export interface CollectionDerivedData {
	syncKey: string
	isOutOfSync: boolean
}


export type Collection<SD> = {
	// embedded
	data: SD

	// own
	id: string

	// sync
	syncKey: string
	
	isOutOfSync: boolean
}

export interface CollectionEntity<T> {
	id: string
	data: T,
}