import { TimestampMs, getNowTimestamp } from "../internal/stl"
import { TimeMs } from "./time"

/**
 * Like TimestampMs, but expressed in days.
 * Unlike TimestampMs may be skewed.
 */
export type DayTimestamp = number

/**
 * Clock, which returns current time.
 */
export interface Clock {
	/**
	 * Returns current timestamp with any timezone skew, if requested by user.
	 */
	getNow: () => TimestampMs

	/**
	 * Extract day index from timestamp.
	 *
	 * This one may be skewed as day starts at different time in different places.
	 */
	getDay: (ts: TimestampMs) => DayTimestamp

	/**
	 * Returns last timestamp of passed day number.
	 */
	getEndDayTimestamp: (dayTs: DayTimestamp) => TimestampMs

	/**
	 * Returns first timestamp of passed day number.
	 */
	getStartDayTimestamp: (dayTs: DayTimestamp) => TimestampMs

}

/**
 * Clock, which uses browser's API in order to get current timestamp.
 */
export class SystemClock implements Clock {
	constructor(private readonly newDaySkew: TimeMs) {}
	getNow = getNowTimestamp
	getDay = (ts: TimestampMs) =>
		Math.floor(
			(ts + this.newDaySkew > 0 ? ts + this.newDaySkew : 0) /
				1000 /
				60 /
				60 /
				24
		)

	getStartDayTimestamp = (dayTs: DayTimestamp) =>
		(dayTs * 1000 * 60 * 60 * 24 - this.newDaySkew) as TimestampMs
	getEndDayTimestamp = (dayTs: number) =>
		(this.getStartDayTimestamp(dayTs) +
			1000 * 60 * 60 * 24 -
			1 -
			this.newDaySkew) as TimestampMs
}

export class DebugClock implements Clock {
	constructor(private value: TimestampMs = 0 as TimestampMs) {}
	advance = (v: number) => {
		this.value = (this.value + v) as TimestampMs
	}
	set = (v: TimestampMs) => {
		this.value = v
	}
	nextDay = () => this.set((this.value + 1000 * 60 * 60 * 24) as TimestampMs)
	getNow = () => this.value
	getDay = (ts: TimestampMs) => Math.floor(ts / 1000 / 60 / 60 / 24)

	getStartDayTimestamp = (dayTs: DayTimestamp) =>
		(dayTs * 1000 * 60 * 60 * 24) as TimestampMs

	getEndDayTimestamp = (dayTs: number) =>
		(this.getStartDayTimestamp(dayTs) +
			1000 * 60 * 60 * 24 -
			1) as TimestampMs
}
