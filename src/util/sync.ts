import { TimestampMs, getNowTimestamp } from "./stl"

export type SyncData = {
	timestamp: TimestampMs
	ndtsc: number
}

export const NDTSC_BASE = -(2 ** 31)

export const makeSyncData = (
	ndtsc: number | null,
	timestamp = getNowTimestamp()
): SyncData => ({
	ndtsc: ndtsc ?? NDTSC_BASE,
	timestamp,
})
