import { ClientSyncConn } from "./client";

/**
 * Synchronizer, which performs synchronization acting as client.
 */
export interface ClientSynchronizer<C> {
    /**
     * Performs synchronization using client connection given.
     */
    synchronize: (conn: ClientSyncConn<C>) => Promise<void>
}