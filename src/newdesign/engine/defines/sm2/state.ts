import { TimestampMs } from "../../../../internal"
import { SM2EngineConfig } from "./config"

export type DailySM2EngineState = {
	/**
	 * DayTimestamp this data was generated at. Stored in order to check if it's up-to-date. 
	 */
	dayTimestamp: number

	/**
	 * How many cards were polled from LEARNED queue today.
	 */
	processedLearnedCount: number

	/**
	 * How many new cards have been processed today.
	 */
	processedNewCount: number

	learnedLimitDelta: number
	newLimitDelta: number
}

export type SM2EngineState = {
	now: TimestampMs
	dailyState: DailySM2EngineState
	config: SM2EngineConfig
}

export type SM2EnginePersistentState = {
	config: SM2EngineConfig
	dailyState: DailySM2EngineState
}