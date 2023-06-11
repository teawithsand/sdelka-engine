import { IDBComparable } from "../../util"
import {
	EngineEntryData,
	EngineEntryDataEntity,
	EngineHistoryData,
	EngineCollectionData,
} from "../defines"

/**
 * Any storage, which is capable of acting as storage for engine.
 *
 * This abstraction layer exists, because engine does not have to operate on cards in collections.
 * In fact, it could operate on any other card pick.
 */
export interface EngineStorage {
	transaction<R>(callback: () => Promise<R>): Promise<R>

	setSessionData: (data: EngineCollectionData) => Promise<void>
	getSessionData: () => Promise<EngineCollectionData | null>

	// ENTRY FUNCTIONS //

	getTopEntryOnQueue: (
		queue: IDBComparable[]
	) => Promise<EngineEntryDataEntity | null>
	getQueueLengthInRange: (
		queue: IDBComparable,
		start: IDBComparable,
		end: IDBComparable,
		startIncl: boolean,
		endIncl: boolean
	) => Promise<number>
	setEngineData: (id: string, data: EngineEntryData) => Promise<void>
	getEngineData: (id: string) => Promise<EngineEntryDataEntity | null>

	// HISTORY FUNCTIONS //

	pushHistoryEntry: (data: EngineHistoryData) => Promise<void>
	peekHistoryEntry: () => Promise<EngineHistoryData | null>
	popHistoryEntry: () => Promise<void>
}
