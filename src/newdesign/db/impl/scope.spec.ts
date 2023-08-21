import { TimestampMs, generateUUID } from "../../../internal"
import { IDBComparable, idbComparator } from "../../../util"
import { IDBDB } from "./idb"
import { IDBScopeDB, IDBScopeDBQuery, IDBScopeDBQueryType, IDBScopeDBWriteType } from "./scope"

type Card = {
    id: string
    deletedAt: TimestampMs
    lastModifiedAt: TimestampMs
    group: IDBComparable
    priority: IDBComparable
}

type State = {
    i: number
}

describe("IDBDB", () => {
    let db: IDBDB<Card, State>
    let sdb: IDBScopeDB<Card, State>

    beforeEach(() => {
        db = new IDBDB<Card, State>("newdesgign-asdf", (card) => ({
            id: card.id,
            deletedAt: card.deletedAt,
            group: card.group,
            lastModifiedAt: card.lastModifiedAt,
            priority: card.priority,
        }))
        sdb = new IDBScopeDB("s1", db)
    })
    afterEach(async () => {
        await db.clear()
        db.close()
    })

    it("can get/set state", async () => {
        let state = await sdb.getState()

        expect(state).toStrictEqual(null)

        await sdb.write([{
            type: IDBScopeDBWriteType.STATE,
            state: {
                i: 42,
            }
        }])

        state = await sdb.getState()
        expect(state?.i).toStrictEqual(42)
    })

    // TODO(teawithsand): testing with deleted
    it("can get single card data by priority", async () => {
        const groups = [1, 2, 3]
        let groupPriorities = [0, 0, 0]
        let cards: Card[] = []
        for (let i = 0; i < 100; i++) {
            const group = groups[i % 3]
            const priority = groupPriorities[i % 3]
            groupPriorities[i % 3] += 1

            cards.push({
                id: generateUUID(),
                deletedAt: 0 as TimestampMs,
                group: group,
                lastModifiedAt: 0 as TimestampMs,
                priority: priority * 10 + group,
            })
        }

        await sdb.write(cards.map(c => ({
            type: IDBScopeDBWriteType.CARD_DATA,
            cardData: c,
        })))

        const doTest = async (query: IDBScopeDBQuery & { type: IDBScopeDBQueryType.BY_PRIORITY }) => {
            const idbRes = await sdb.querySingle(query)

            const expRes = cards
                .filter(c => query.omitDeleted ? c.deletedAt === 0 : true)
                .filter(c => query.groups.some(g => g === c.group))
                .sort(
                    (a, b) => query.asc ?
                        idbComparator(a.priority, b.priority) :
                        -idbComparator(a.priority, b.priority)
                )[0] ?? null

            // console.log({ idbRes, expRes, query })
            expect(idbRes).toEqual(expRes)
        }
        for (const asc of [true, false]) {
            for (const omitDeleted of [true, false]) {
                for (const queryGroups of [
                    [groups[0]],
                    [groups[1]],
                    [groups[0], groups[1]],
                    [groups[1], groups[0]],
                    [groups[1], groups[0], groups[2]],
                ]) {
                    await doTest({
                        type: IDBScopeDBQueryType.BY_PRIORITY,
                        asc,
                        groups: queryGroups,
                        omitDeleted,
                    })
                }
            }
        }
    })

    // TODO(teawithsand): testing with deleted
    it.each([
        [
            [96252, 85844, 16222, 11247, 56728, 14048, 62291, 6935, 3934, 89735],
        ],
        [
            [36046, 26929, 35716, 80211, 19775, 29177, 37801, 59537, 79114, 32520]
        ]
    ])("can get many cards by last modified", async (lastMods: number[]) => {
        let cards: Card[] = []
        for (const v of lastMods) {
            cards.push({
                id: generateUUID(),
                deletedAt: 0 as TimestampMs,
                group: 0,
                lastModifiedAt: v as TimestampMs,
                priority: 10,
            })
        }
        for (const c of cards) {
            await sdb.write([{
                type: IDBScopeDBWriteType.CARD_DATA,
                cardData: c,
            }])
        }
        for (const asc of [true, false]) {
            for (const omitDeleted of [true, false]) {
                const cursor = await sdb.queryMany({
                    type: IDBScopeDBQueryType.BY_LAST_MODIFIED,
                    asc,
                    omitDeleted,
                    groups: [],
                })

                const res = await cursor.toArray()

                const localCards = [...cards]
                localCards.sort((a, b) => asc ? a.lastModifiedAt - b.lastModifiedAt : b.lastModifiedAt - a.lastModifiedAt)
                expect(res).toEqual(localCards)
            }
        }

    })
})