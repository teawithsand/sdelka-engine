import { Cursor } from "../../../util"

/**
 * Component handling storage for single scope(learning session).
 * 
 * Notice that DB does not have notion of user card data and card state(AKA card engine's data).
 * DB shouldn't differentiate between these.
 * 
 * Also DB does not use the same terms the sync code and the engine uses.
 */
export interface ScopeDB<C, S, W, Q> {
    /**
     * Returns latest global state for given DB.
     */
    getState: () => Promise<S | null>

    /**
     * Atomically performs write operation it's given.
     */
    write: (commands: W[]) => Promise<void>

    /**
     * Queries DB for single card. If order is not specified, any card may be returned.
     * 
     * null shall be returned if result set is empty.
     */
    querySingle: (query: Q) => Promise<C | null>

    /**
     * Queries DB for many cards. Returns cursor for easier iteration.
     * 
     * Cursor given should *NOT* be used after DB write has been performed. It's undefined behavior to do so.
     * Till that time, it should be either depleted or dropped.
     */
    queryMany: (query: Q) => Promise<Cursor<C>>
}