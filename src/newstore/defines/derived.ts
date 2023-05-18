import { IDBComparable } from "../../pubutil"

export type DerivedEntryEngineDataExtractor<T> = (
	data: T
) => DerivedEntryEngineData

export interface DerivedEntryEngineData {
	queue: IDBComparable
	queuePriority: IDBComparable

	isOutOfSync: boolean
}

export type DerivedEntryUserDataExtractor<T> = (data: T) => DerivedEntryUserData

export interface DerivedEntryUserData {
	syncKey: string
	tags: string[]

	isOutOfSync: boolean
}


export type DerivedHistoryDataExtractor<T> = (
	data: T
) => DerivedHistoryData

export interface DerivedHistoryData {
	entryId: string
}