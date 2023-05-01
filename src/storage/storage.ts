import { Cursor } from "../pubutil"
import { SyncRequest } from "../util/sync"
import { GroupedQueueElementPropsExtractor, GroupedQueue } from "./queue"

export type CardId = string

/**
 * Storage that engine utilizes in order to do it's job.
 */
export interface EngineStorage<CD, SD> {
	/**
	 * Note #1: transactions used here may or may not be recursive. Read docs for specific storage used.
	 *
	 * Note #2: it's likely that indexed-db transaction is used. In that case no non-storage
	 * awaits should occur in between calls, as this breaks IDB.
	 */
	transaction: <R>(cb: () => Promise<R>) => Promise<R>

	getSessionData: () => Promise<SD | null>
	setSessionData: (sd: SD) => Promise<void>
	deleteSessionData: () => Promise<void>

	getEngineCardData: (id: CardId) => Promise<CD | null>
	setEngineCardData: (id: CardId, data: CD) => Promise<void>
	deleteEngineCardData: (id: CardId) => Promise<void>

	getQueue: <D>(
		queueId: string,
		extractor: GroupedQueueElementPropsExtractor<D>
	) => GroupedQueue<D>

	// TODO(teawithsand): implement this
	// getEntiresForSyncRequest: (req: SyncRequest) => Cursor<CardId>
}
