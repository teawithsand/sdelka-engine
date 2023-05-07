import { Cursor } from "../pubutil"
import { EmbeddedSyncData } from "./data"

/**
 * Used for synchronization. Store, which contains keys, which were deleted.
 * It may be purged after synchronization to reclaim space.
 */
export interface DeletedKeysStore {
	addKey: (key: string, data: EmbeddedSyncData) => Promise<void>
	removeKey: (key: string) => Promise<void>
	clear: () => Promise<void>
	keys: () => Cursor<string>
}
