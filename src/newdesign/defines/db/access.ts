import { ID, IDBComparable } from "../../../util";
import { Card } from "../card";

/**
 * Basic way of writing cards to database.
 */
export interface WriteCardAccess<D> {
    setCard: (cardData: D) => Promise<ID>,
    removeCard: (id: ID) => Promise<void>
}

/**
 * Way of accessing DB, which lets you retrive card with highest priority.
 */
export interface PriorityReadCardAccess<S, D> {
    getHighestPriorityCard: (groups: ID[]) => Promise<Card<S, D> | null>
}
/**
 * Way of accessing DB, using same group and priority scheme.
 * Right now it's used solely for statistical purposes.
 */
export interface ExtendedPriorityReadCardAccess<S, D> extends PriorityReadCardAccess<S, D> {
    getGroupPriorityRangeCount: (
        priorityMin: IDBComparable,
        priorityMax: IDBComparable,
        minInclusive: boolean,
        maxInclusive: boolean,
        groups: ID[],
    ) => Promise<number>,
}