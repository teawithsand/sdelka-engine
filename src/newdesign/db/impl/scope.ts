import { Cursor, ID, MAX_IDB_KEY, MIN_IDB_KEY, idbComparator } from "../../../util"
import { ScopeDB } from "../defines/db"
import { IDBDB, IDBDBCard, IDBDBHistoryEntryType, IDBDBState } from "./idb"

export enum IDBScopeDBQueryType {
    BY_ID = 1,
    BY_PRIORITY = 2,
    BY_LAST_MODIFIED = 3,
}

export enum IDBScopeDBWriteType {
    CARD_DATA = 1,
    STATE = 2,
    CARD_DATA_AND_STATE = 3,
    UNDO_BOUNDARY = 4,
    CARD_DELETE = 5,
    UNDO = 6,
}

export type IDBScopeDBQuery = {
    type: IDBScopeDBQueryType.BY_ID,
    id: ID,
} | ({
    offset?: number
    limit?: number
} & ({
    type: IDBScopeDBQueryType.BY_PRIORITY,
    omitDeleted: boolean,
    groups: ID[],
    asc: boolean
} | {
    type: IDBScopeDBQueryType.BY_LAST_MODIFIED,
    omitDeleted: boolean,
    groups: ID[],
    asc: boolean
}))

export type IDBScopeDBWrite<C, S> = {
    type: IDBScopeDBWriteType.CARD_DATA,
    cardData: C,
} | {
    type: IDBScopeDBWriteType.STATE,
    state: S,
} | {
    type: IDBScopeDBWriteType.CARD_DATA_AND_STATE,
    cardData: C,
    state: S,
} | {
    type: IDBScopeDBWriteType.UNDO_BOUNDARY
} | {
    type: IDBScopeDBWriteType.CARD_DELETE,
    id: ID
} | {
    type: IDBScopeDBWriteType.UNDO,
}

export class IDBScopeDB<C, S> implements ScopeDB<C, S, IDBScopeDBWrite<C, S>, IDBScopeDBQuery> {

    constructor(
        public readonly scope: ID,
        public readonly db: IDBDB<C, S>,
    ) { }

    private ndctrValue: number | null = null

    getState = async (): Promise<S | null> => {
        return (await this.db.states.get(this.scope))?.data ?? null
    }

    private getNDCTR = async (): Promise<number> => {
        if (this.ndctrValue !== null) {
            return this.ndctrValue
        }

        const state = await this.db.states.get(this.scope)
        const ctr = state?.ndctr ?? -(2 ** 31)
        this.ndctrValue = ctr

        return ctr
    }

    private getAndIncrementNDCTR = async (): Promise<number> => {
        await this.getNDCTR()
        if (this.ndctrValue === null) throw new Error("NDCTR value not loaded after get call")
        this.ndctrValue += 1
        return this.ndctrValue
    }

    private flushNDCTR = async () => {
        if (this.ndctrValue === null) return

        const ndctr = this.ndctrValue ?? -(2 ** 31)
        const state: IDBDBState<S> = (await this.db.states.get(this.scope)) ?? {
            id: this.scope,
            data: null,
            ndctr: ndctr,
        }

        state.ndctr = ndctr
        await this.db.states.put(state)
    }

    private makeHistoryEntryForCard = async (
        id: ID,
        ndctr: number,
        type: IDBDBHistoryEntryType.CARD_WRITE | IDBDBHistoryEntryType.CARD_DELETION = IDBDBHistoryEntryType.CARD_WRITE,
    ) => {
        const prevCard = (await this.db.cards.get([this.scope, id]))?.data ?? null
        await this.db.history.put({
            type,
            previousCardData: prevCard,
            ndctr: ndctr,
            scope: this.scope,
        })
    }

    private makeHistoryEntryForState = async (ndctr: number) => {
        const prevState = (await this.db.states.get(this.scope))?.data ?? null
        await this.db.history.put({
            type: IDBDBHistoryEntryType.STATE_WRITE,
            previousState: prevState,
            ndctr: ndctr,
            scope: this.scope,
        })
    }

    private makeHistoryEntryForStateAndCard = async (id: ID, ndctr: number) => {
        const prevState = (await this.db.states.get(this.scope))?.data ?? null
        const prevCard = (await this.db.cards.get([this.scope, id]))?.data ?? null
        await this.db.history.put({
            type: IDBDBHistoryEntryType.CARD_AND_STATE_WRITE,
            previousState: prevState,
            previousCardData: prevCard,
            ndctr: ndctr,
            scope: this.scope,
        })
    }

    private handleCommand = async (command: IDBScopeDBWrite<C, S>) => {
        if (command.type === IDBScopeDBWriteType.UNDO_BOUNDARY) {
            await this.db.history.where("scope").equals(this.scope).delete()
        } else if (command.type === IDBScopeDBWriteType.CARD_DATA) {
            const metadata = this.db.cardMetadataExtractor(command.cardData)
            const ndctr = await this.getAndIncrementNDCTR()
            await this.makeHistoryEntryForCard(metadata.id, ndctr)
            await this.db.cards.put({
                data: command.cardData,
                scope: this.scope,
                ...metadata,
                lastModifiedNdctr: ndctr,
            })
        } else if (command.type === IDBScopeDBWriteType.STATE) {
            const ndctr = await this.getAndIncrementNDCTR()
            await this.makeHistoryEntryForState(ndctr)
            await this.db.states.put({
                id: this.scope,
                data: command.state,
                ndctr,
            })
        } else if (command.type == IDBScopeDBWriteType.CARD_DATA_AND_STATE) {
            const metadata = this.db.cardMetadataExtractor(command.cardData)
            const ndctr = await this.getAndIncrementNDCTR()
            await this.makeHistoryEntryForStateAndCard(metadata.id, ndctr)

            await this.db.cards.put({
                data: command.cardData,
                scope: this.scope,
                ...metadata,
                lastModifiedNdctr: ndctr,
            })
            await this.db.states.put({
                id: this.scope,
                data: command.state,
                ndctr: ndctr, // does not matter; will be fixed by flush
            })
        } else if (command.type === IDBScopeDBWriteType.CARD_DELETE) {
            const ndctr = await this.getAndIncrementNDCTR()
            await this.makeHistoryEntryForCard(command.id, ndctr, IDBDBHistoryEntryType.CARD_DELETION)

            await this.db.cards.where("[scope+id]").equals([this.scope, command.id]).delete()
        } else {
            throw new Error(`Unsupported command: ${command}`)
        }
    }

    write = async (commands: IDBScopeDBWrite<C, S>[]): Promise<void> => {
        await this.db.transaction("rw?", [
            this.db.cards,
            this.db.states,
            this.db.history,
        ], async () => {
            for (const c of commands) {
                await this.handleCommand(c)
            }

            await this.flushNDCTR()
        })
    }

    private executeQuery = (query: IDBScopeDBQuery) => {
        if (query.type === IDBScopeDBQueryType.BY_ID) {
            return [

            ]
        } else if (query.type === IDBScopeDBQueryType.BY_PRIORITY) {
            return query.groups.forEach
        }
    }

    querySingle = async (query: IDBScopeDBQuery): Promise<C | null> => {
        if (
            query.type === IDBScopeDBQueryType.BY_ID
        ) {
            return (await this.db.cards
                .where("[scope+id]")
                .equals([this.scope, query.id])
                .first())?.data ?? null
        } else if (query.type === IDBScopeDBQueryType.BY_PRIORITY) {
            const results: IDBDBCard<C>[] = []
            const deletedAtMin = query.omitDeleted ? null : MIN_IDB_KEY
            const deletedAtMax = query.omitDeleted ? null : MAX_IDB_KEY
            for (const group of query.groups) {
                const partialQuery = this.db.cards
                    .where("[scope+deletedAt+group+priority]")
                    .between(
                        [this.scope, deletedAtMin, group, MIN_IDB_KEY],
                        [this.scope, deletedAtMax, group, MAX_IDB_KEY],
                        true,
                        true,
                    )
                if (query.asc) {
                    const res = await partialQuery.first()
                    if (res) results.push(res)
                } else {
                    const res = await partialQuery.last()
                    if (res) results.push(res)
                }
            }

            if (query.asc) {
                results.sort((a, b) => idbComparator(a.priority, b.priority))
            } else {
                results.sort((a, b) => -idbComparator(a.priority, b.priority))
            }

            if (results.length) {
                return results[0].data
            } else {
                return null
            }
        } else {
            throw new Error("NIY")
        }
    }

    queryMany = async (query: IDBScopeDBQuery): Promise<Cursor<C>> => {
        throw new Error("NIY")
    }
}