import { DayTimestamp } from "../../engine"
import { TimestampMs } from "../../util/stl"
import { EngineDailyConfig } from "./config"

export type EngineDailyData = {
	dailyConfig: EngineDailyConfig

	/**
	 * DayTimestamp this data was generated at. Stored in order to check if it's up-to-date. 
	 */
	dayTimestamp: DayTimestamp

	/**
	 * How many cards were polled from LEARNED queue today.
	 */
	processedLearnedCount: number

	/**
	 * How many new cards have been processed today.
	 */
	processedNewCount: number
}

export type EngineSessionData = {
	/**
	 * Used to ensure that we are using non-backing timer, as using such timer would break our scheduler.
	 */
	lastTimestampFetched: TimestampMs | null

	/**
	 * Session data, which gets reset every day.
	 */
	dailyData: EngineDailyData
}