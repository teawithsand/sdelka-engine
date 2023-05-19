import { DerivedEntryUserDataExtractor } from "../../store"

export type EntryUserData = {
	isOutOfSync: boolean
	syncKey: string
	tags: string[]
	values: {
		[key: string]: string
	}

	priority: number
}

export const EntryUserDataExtractor: DerivedEntryUserDataExtractor<
	EntryUserData
> = (data) => ({
	isOutOfSync: data.isOutOfSync,
	syncKey: data.syncKey,
	tags: data.tags,
})
