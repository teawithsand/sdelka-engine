import { TimestampMs, getNowTimestamp } from "./stl"

export type NDTSC = number

/**
 * Used for testing, which do not require sync data.
 */
export const DUMMY_SYNC_DATA: EmbeddedSyncData = {
	ndtsc: 0,
	timestamp: 0 as TimestampMs,
}

/**
 * Data, which should be embedded in any row, which is subject to synchronization.
 */
export type EmbeddedSyncData = {
	timestamp: TimestampMs
	ndtsc: NDTSC
}

export const NDTSC_BASE: NDTSC = -(2 ** 31)

/**
 * @deprecated Construct this object manually instead.
 */
export const makeSyncData = (
	ndtsc: NDTSC | null,
	timestamp = getNowTimestamp()
): EmbeddedSyncData => ({
	ndtsc: ndtsc ?? NDTSC_BASE,
	timestamp,
})