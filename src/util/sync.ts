import { TimestampMs, getNowTimestamp } from "./stl"

export type NDTSC = number

export type SyncData = {
	timestamp: TimestampMs
	ndtsc: NDTSC
}

export const NDTSC_BASE: NDTSC = -(2 ** 31)

export const makeSyncData = (
	ndtsc: NDTSC | null,
	timestamp = getNowTimestamp()
): SyncData => ({
	ndtsc: ndtsc ?? NDTSC_BASE,
	timestamp,
})

export type SyncRequest = {
	ndtscLowerThanOrEq?: number
	ndtscGreaterThanOrEq?: number
	timestampLowerThanOrEq?: number
	timestampGreaterThanOrEq?: number
}