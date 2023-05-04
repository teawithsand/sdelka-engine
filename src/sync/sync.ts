import { Cursor } from "../pubutil"
import { TimestampMs } from "../util/stl"
import { NDTSC } from "../util/sync"

export enum RowSyncState {
	EXISTS = 1,
	DELETED = 2,
}

export type RowSyncData = {
	id: string

	/**
	 * When was row last modified on local device.
	 * Used to determine which version remote or local should be preserved.
	 */
	locallyLastsModified: TimestampMs

	/**
	 * If row still exists or was deleted.
	 */
	state: RowSyncState

	lastSync: {
		/**
		 * Timestamp, which informs when was given row last updated.
		 * Maintained by remote server.
		 */
		timestamp: TimestampMs

		/**
		 * NDTSC which informs which synchronization was the row last updated at.
		 * Maintained by remote server.
		 */
		counter: NDTSC
	} | null
}

export type ClientSyncData = {
	/**
	 * ID of client, which performs synchronization.
	 */
	id: string

	/**
	 * ID of dataset, which is being synchronized.
	 */
	datasetId: string
}

export interface SyncDataStore {
	transaction: <R>(cb: () => Promise<R>) => Promise<R>

	getClientSyncData: () => Promise<ClientSyncData>
	setClientSyncData: (csd: ClientSyncData) => Promise<void>

	setRowSyncData: (rsd: RowSyncData) => Promise<void>
	deleteRowSyncData: (id: string) => Promise<void>

	getSynchronizedAfterNDTSC: (ndtsc: NDTSC) => Cursor<RowSyncData>
	getNotYetSynchronized: () => Cursor<RowSyncData>
}
