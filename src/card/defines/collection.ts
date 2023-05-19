import { CollectionDerivedDataExtractor } from "../../store"

export type CollectionData = {
	isOutOfSync: boolean
	syncKey: string

	name: string
    description: string
}

export const CollectionDataExtractor: CollectionDerivedDataExtractor<
	CollectionData
> = (data) => ({
	isOutOfSync: data.isOutOfSync,
	syncKey: data.syncKey,
})
