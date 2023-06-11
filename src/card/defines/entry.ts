import { DerivedEntryUserDataExtractor } from "../../store"

export type UserEntryData = {
	isOutOfSync: boolean
	syncKey: string
	tags: string[]
	values: {
		[key: string]: string
	}

	priority: number
}

export const UserEntryDataExtractor: DerivedEntryUserDataExtractor<
	UserEntryData
> = (data) => ({
	isOutOfSync: data.isOutOfSync,
	syncKey: data.syncKey,
	tags: data.tags,
})
