import { UserEntryData } from "../../card"
import { EngineEntryData, EngineHistoryData } from "../../engine"
import { IDBComparable } from "../../util"

export type DerivedEngineEntryDataExtractor = (
	data: EngineEntryData
) => DerivedEngineEntryData

export interface DerivedEngineEntryData {
	queue: IDBComparable
	queuePriority: IDBComparable

	isOutOfSync: boolean
}

export type DerivedUserEntryDataExtractor = (data: UserEntryData) => DerivedUserEntryData

export interface DerivedUserEntryData {
	syncKey: string
	tags: string[]

	isOutOfSync: boolean
}


export type DerivedHistoryEntryDataExtractor = (
	data: EngineHistoryData
) => DerivedHistoryEntryData

export interface DerivedHistoryEntryData {
	entryId: string
}