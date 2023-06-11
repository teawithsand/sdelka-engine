import { DerivedEntryUserDataExtractor } from "../../store"

export type UserEntryData = {
	isOutOfSync: boolean
	syncKey: string
	tags: string[]
	priority: number

	/**
	 * Any external data library user wants to store here.
	 * External user is responsible for maintaining proper type of this data.
	 * 
	 * Data passed here must be IDB/Any other storage serializable.
	 */
	external?: any
}

export const UserEntryDataExtractor: DerivedEntryUserDataExtractor = (data) => ({
	isOutOfSync: data.isOutOfSync,
	syncKey: data.syncKey,
	tags: data.tags,
})
