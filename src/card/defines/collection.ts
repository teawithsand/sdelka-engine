import { DerivedUserCollectionDataExtractor } from "../../store"

export type UserCollectionData = {
	isOutOfSync: boolean
	syncKey: string

	name: string
	description: string
}

export const DerivedUserCollectionDataExtractorImpl: DerivedUserCollectionDataExtractor = (data) => ({
	isOutOfSync: data.isOutOfSync,
	syncKey: data.syncKey,
})
