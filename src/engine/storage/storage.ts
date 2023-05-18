import { IDBComparable } from "../../pubutil"
import {
	EngineEntryData,
	EngineEntryDataEntity,
	EngineHistoryData,
	EngineSessionData,
} from "../defines"

/**
 * Any storage, which is capable of acting as storage for engine.
 *
 * This abstraction layer exists, because engine does not have to operate on cards in collections.
 * In fact, it could operate on any other card pick.
 */
export interface EngineStorage {
	transaction<R>(callback: () => Promise<R>): Promise<R>

	setSessionData: (data: EngineSessionData) => Promise<void>
	getSessionData: () => Promise<EngineSessionData | null>

	// ENTRY FUNCTIONS //

	getTopEntryOnQueue: (
		queue: IDBComparable[]
	) => Promise<EngineEntryDataEntity | null>
	setEngineData: (id: string, data: EngineEntryData) => Promise<void>
	getEngineData: (id: string) => Promise<EngineEntryDataEntity | null>

	// HISTORY FUNCTIONS //

	pushHistoryEntry: (data: EngineHistoryDataa) => Promise<void>
	peekHistoryEntry: () => Promise<EngineHistoryData | null>
	popHistoryEntry: () => Promise<void>
}
