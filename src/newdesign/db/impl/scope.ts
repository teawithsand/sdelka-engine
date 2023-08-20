import { AsyncCursor, Cursor, ID, IDBComparable, idbComparator, maxIdbKey, minIdbKey } from "../../../util"
import { ScopeDB } from "../defines"
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
    DELETE_MARKED_AS_DELETED = 7,
}

export type IDBScopeDBQuery = {
    type: IDBScopeDBQueryType.BY_ID,
    id: ID,
} | {
    type: IDBScopeDBQueryType.BY_PRIORITY,
    omitDeleted: boolean,
    groups: IDBComparable[],
    asc: boolean
} | {
    type: IDBScopeDBQueryType.BY_LAST_MODIFIED,
    omitDeleted: boolean,
    groups: IDBComparable[],
    asc: boolean
}

export type IDBScopeDBWrite<C, S> = {
    /**
     * When true, entry will be stored in history log.
     * Ignored when it's false.
     */
    history?: boolean
} & ({
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
    type: IDBScopeDBWriteType.CARD_DELETE,
    id: ID
} | {
    type: IDBScopeDBWriteType.UNDO_BOUNDARY
    history?: undefined | false,
} | {
    type: IDBScopeDBWriteType.UNDO,
    history?: undefined | false,
} | {
    type: IDBScopeDBWriteType.DELETE_MARKED_AS_DELETED,
    history?: undefined | false,
})

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

        // TODO(teawithsand): limit amount of history entries stored
        await this.db.history.put({
            type: IDBDBHistoryEntryType.CARD_AND_STATE_WRITE,
            previousState: prevState,
            previousCardData: prevCard,
            ndctr: ndctr,
            scope: this.scope,
        })
    }

    private handleCommand = async (command: IDBScopeDBWrite<C, S>) => {
        // TODO(teawithsand): implement command.history handling

        const history = command.history ?? true
        if (command.type === IDBScopeDBWriteType.UNDO_BOUNDARY) {
            await this.db.history.where("scope").equals(this.scope).delete()
        } else if (command.type === IDBScopeDBWriteType.CARD_DATA) {
            const metadata = this.db.cardMetadataExtractor(command.cardData)
            const ndctr = await this.getAndIncrementNDCTR()
            await this.makeHistoryEntryForCard(metadata.id, ndctr)
            await this.db.cards.put({
                ...metadata,

                data: command.cardData,
                scope: this.scope,
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
        } else if (command.type === IDBScopeDBWriteType.DELETE_MARKED_AS_DELETED) {
            await this.getAndIncrementNDCTR()
            // TODO(teawithsand): create history entry for that event OR document 
            //  it somehow that it's not subject for undoing
            await this.db.cards.where("[scope+deletedAt]").between(
                [this.scope, 0],
                [this.scope, maxIdbKey()],
                false,
                true,
            ).delete()
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

    private translateQuery = (query: IDBScopeDBQuery) => {
        if (
            query.type === IDBScopeDBQueryType.BY_ID
        ) {
            return [
                this.db.cards
                    .where("[scope+id]")
                    .equals([this.scope, query.id])
            ]
        } else if (query.type === IDBScopeDBQueryType.BY_PRIORITY) {
            return query.groups.map(group => query.omitDeleted ? this.db.cards
                .where("[scope+deletedAt+group+priority]")
                .between(
                    [
                        this.scope,
                        0,
                        group,
                        minIdbKey()
                    ],
                    [
                        this.scope,
                        0,
                        group,
                        maxIdbKey()
                    ],
                    true,
                    true,
                ) : this.db.cards
                    .where("[scope+group+priority]")
                    .between(
                        [
                            this.scope,
                            group,
                            minIdbKey()
                        ],
                        [
                            this.scope,
                            group,
                            maxIdbKey()
                        ],
                        true,
                        true,
                    ))
        } else if (query.type === IDBScopeDBQueryType.BY_LAST_MODIFIED) {
            // TODO(teawithsand): fix omitDeleted bug
            return [
                this.db.cards
                    .where("[scope+deletedAt+lastModifiedAt]")
                    .between(
                        [this.scope, minIdbKey(), minIdbKey()],
                        [this.scope, maxIdbKey(), maxIdbKey()],
                        true,
                        true,
                    )
            ]
        } else {
            throw new Error(`Unsupported query type: ${(query as any).type}`)
        }
    }

    private performQuery = async (query: IDBScopeDBQuery, offset: number, limit: number): Promise<IDBDBCard<C>[]> => {
        return await this.db.transaction("r?", [
            this.db.cards
        ], async () => {
            const translatedQueries = this.translateQuery(query)
            if (translatedQueries.length === 0) {
                return []
            } else if (query.type !== IDBScopeDBQueryType.BY_PRIORITY && translatedQueries.length === 1) {
                const q = translatedQueries[0]
                return await q
                    .offset(offset)
                    .limit(limit)
                    .toArray()
            } else {
                if (offset !== 0 || limit !== 1) {
                    throw new Error(`Offset and limit are not supported for multi-query translations`)
                }

                if (query.type === IDBScopeDBQueryType.BY_ID) {
                    throw new Error(`Id queries may not yield multiple translated queries`)
                }

                const asc = query.asc
                const results: IDBDBCard<C>[] = []
                for (const translatedQuery of translatedQueries) {
                    if (asc) {
                        const res = await translatedQuery.first()
                        if (res) results.push(res)
                    } else {
                        const res = await translatedQuery.last()
                        if (res) results.push(res)
                    }
                }

                if (asc) {
                    results.sort((a, b) => idbComparator(a.priority, b.priority))
                } else {
                    results.sort((a, b) => -idbComparator(a.priority, b.priority))
                }

                if (results.length) {
                    return [results[0]]
                } else {
                    return []
                }
            }
        })
    }

    querySingle = async (query: IDBScopeDBQuery): Promise<C | null> => {
        return await this.db.transaction('rw?', [
            this.db.cards,
        ], async () => {
            const res = await this.performQuery(query, 0, 1)
            if (res.length) {
                return res[0].data
            } else {
                return null
            }
        })
    }

    queryMany = async (query: IDBScopeDBQuery): Promise<Cursor<C>> => {
        return new AsyncCursor({
            fetch: async (offset, limit) => {
                const results = await this.performQuery(query, offset, limit)
                return results.map(v => v.data)
            },
            count: async () => {
                const translated = this.translateQuery(query)
                if (translated.length === 0) return 0
                if (translated.length === 1) return await translated[0].count()

                throw new Error(`Multi-translated queries are not supported with cursor count method`)
            }
        })
    }
}