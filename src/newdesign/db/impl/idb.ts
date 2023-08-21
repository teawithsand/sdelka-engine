import Dexie, { Table } from "dexie"
import { ID, IDBComparable } from "../../../util"
import { TimestampMs } from "../../../internal"

/**
 * All kinds of metadata derived from card data, which is processed by IDBDB.
 */
export type IDBDBCardMetadata = {
    /**
     * Card id obviously. It has to be unique with respect to scope.
     */
    id: ID,

    /**
     * When true, card is omitted in queries, which do not explicitly
     * specify that they are showing marked-as-deleted entries.
     * 
     * Assumed to be false, when it's equal to zero or less than zero.
     */
    deletedAt: TimestampMs

    /**
     * When was card last modified.
     */
    lastModifiedAt: TimestampMs

    /**
     * Group this card is in. Can be used to filter cards.
     */
    group: IDBComparable,

    /**
     * Priority this card has. Used for priority queries.
     */
    priority: IDBComparable
}

/**
 * Extractor, which extracts IDBDBCardMetadata from card data.
 */
export type IDBDBCardMetadataExtractor<C> = (data: C) => IDBDBCardMetadata

/**
 * Card stored in IDBDB.
 */
export type IDBDBCard<C> = {
    scope: ID
    data: C

    /**
     * For sake of completeness - last modified non decreasing counter. Copied from global NDCTR.
     */
    lastModifiedNdctr: IDBComparable
} & IDBDBCardMetadata

export type IDBDBState<S> = {
    /**
     * In this context, it's the scope, but it's called id, because it serves as id.
     */
    id: ID

    /**
     * Actual state stored, or null if it was not set yet.
     */
    data: S | null

    /**
     * Complementary value used to maintain history.
     */
    ndctr: number
}

export enum IDBDBHistoryEntryType {
    STATE_WRITE = 1,
    CARD_WRITE = 2,
    CARD_AND_STATE_WRITE = 3,
    CARD_DELETION = 4,
}

export type IDBDBHistoryEntry<C, S> = ({
    /**
     * Scope, in which the entry exists.
     */
    scope: ID,

    /**
     * non-decreasing counter. Usually timestamp. Used to determine order of history entries within scope.
     */
    ndctr: IDBComparable
}) & ({
    type: IDBDBHistoryEntryType.STATE_WRITE,
    previousState: S | null
} | {
    type: IDBDBHistoryEntryType.CARD_WRITE,
    previousCardId: ID, // required when card data is null
    previousCardData: C | null,
} | {
    type: IDBDBHistoryEntryType.CARD_AND_STATE_WRITE,
    previousCardId: ID, // required when card data is null
    previousCardData: C | null,
    previousState: S | null,
} | {
    type: IDBDBHistoryEntryType.CARD_DELETION,
    previousCardData: C,
})

/**
 * Master database, which can be used to derive IDBScopeDBs, once it's given a scope.
 * 
 * It's implementation isn't the only valid one. There may be different, however this one, shipped
 * with this library, is especially designed for SM2-like engine workload.
 */
export class IDBDB<C, S> extends Dexie {
    public readonly cards!: Table<IDBDBCard<C>>
    public readonly states!: Table<IDBDBState<S>>
    public readonly history!: Table<IDBDBHistoryEntry<C, S>>

    constructor(
        public readonly name: string,
        public readonly cardMetadataExtractor: IDBDBCardMetadataExtractor<C>,
    ) {
        super(name)
        this.version(1).stores({
            cards: "[scope+id], [scope+group+priority], [scope+deletedAt+group+priority], [scope+deletedAt+lastModifiedAt]",
            states: "id",
            history: "[scope+ndctr]",
        })
    }

    clear = async () => {
        await this.transaction("rw?", [this.cards, this.states, this.history], async () => {
            await this.cards.clear()
            await this.states.clear()
            await this.history.clear()
        })
    }
}
