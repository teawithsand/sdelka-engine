import { Cursor } from "../pubutil";
import { EmbeddedSyncData, NDTSC } from "../util/sync";

/**
 * Adapter for any store, which contains data, which may be synchronized. 
 */
export interface SyncableStoreAdapter<T> {
    extractEmbeddedSyncData: (data: T) => EmbeddedSyncData
    getData: (id: string) => Promise<T | null>

    /**
     * Yielded cursor also should yield new entries, not only modified after specified NDTSC.
     */
    getModifiedAfter: (ndtsc: NDTSC) => Cursor<T> 
}