import { CollectionDerivedDataExtractor } from "../../store"

export type UserCollectionData = {
	isOutOfSync: boolean
	syncKey: string

	name: string
    description: string
}

export const UserCollectionDataExtractor: CollectionDerivedDataExtractor<
	UserCollectionData
> = (data) => ({
	isOutOfSync: data.isOutOfSync,
	syncKey: data.syncKey,
})
