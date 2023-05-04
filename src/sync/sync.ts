import { Cursor } from "../pubutil"
import { TimestampMs } from "../util/stl"
import { NDTSC } from "../util/sync"

export enum RowSyncState {
	EXISTS = 1,
	DELETED = 2,
}

export type EmbeddedSyncData = {
	lastModifiedNDTSC: NDTSC
	lastModifiedTimestampMs: TimestampMs
}

export type RowSyncData = {
	id: string

	// 
	// When was row last modified on local device.
	// Used to determine which version remote or local should be preserved.
	//
	// Conflict resolution is done using external data, not only data stored here.
	// If data was modified, which should be detected, then syncing on both sides has to use some smart 
	// algo to pick the winner.
	// 
	// locallyLastsModified: TimestampMs

	/**
	 * If row still exists or was deleted.
	 * 
	 * Required in order to determine, which deletes have to be pushed.
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

export interface SyncDataStore<C> {
	transaction: <R>(cb: () => Promise<R>) => Promise<R>

	getClientSyncData: () => Promise<C>
	setClientSyncData: (csd: C) => Promise<void>

	setRowSyncData: (rsd: RowSyncData) => Promise<void>
	deleteRowSyncData: (id: string) => Promise<void>

	getSynchronizedAfterNDTSC: (ndtsc: NDTSC) => Cursor<RowSyncData>
	getNotYetSynchronized: () => Cursor<RowSyncData>
}

export interface SyncStoreAdapter<T> {
	getElement: (id: string) => Promise<T | null>
	setElement: (id: string, data: T) => Promise<void>
	extractEmbeddedSyncData: (data: T) => EmbeddedSyncData

	/**
	 * Using data of local and remote element, pick one, which should be used.
	 * 
	 * TODO(teawithsand): allow user interaction here
	 */
	pickElement: (local: T, remote: T) => Promise<T>
}	