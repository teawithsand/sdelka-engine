import { TimestampMs, generateUUID } from "../../../internal"
import { IDBComparable } from "../../../util"
import { IDBDB, IDBScopeDB, IDBScopeDBQueryType, IDBScopeDBWriteType } from "../../db/impl"
import { DEFAULT_SM2_ENGINE_CONFIG, EngineCard, SM2CardState, SM2CardStateType, SM2EngineAnswer, SM2EnginePersistentState, SM2UserState, extractSM2CardStatePriority, initializeSM2CardState } from "../defines"
import { makeSM2Engine } from "./instantiate"

export type CardData = {
    id: string
    deletedAt: TimestampMs
    lastModifiedAt: TimestampMs
    userPriority: IDBComparable
}

describe("SM2 engine", () => {
    let db: IDBDB<EngineCard<CardData, SM2CardState>, SM2EnginePersistentState>
    let sdb: IDBScopeDB<EngineCard<CardData, SM2CardState>, SM2EnginePersistentState>
    let engine: ReturnType<typeof makeSM2Engine<CardData>>
    let cards: CardData[] = []
    const config = DEFAULT_SM2_ENGINE_CONFIG

    beforeEach(async () => {
        db = new IDBDB<EngineCard<CardData, SM2CardState>, SM2EnginePersistentState>("newdgign-fdsa-fdas", (data) => {
            const priority = extractSM2CardStatePriority(data.state)
            priority.push(data.data.userPriority)

            return {
                id: data.data.id,
                deletedAt: data.data.deletedAt,
                lastModifiedAt: data.data.lastModifiedAt,
                group: data.state.type,
                priority,
            }
        })
        sdb = new IDBScopeDB("s1", db)
        engine = makeSM2Engine(sdb, config)

        for (let i = 0; i < 100; i++) {
            cards.push({
                id: generateUUID(),
                deletedAt: 0 as TimestampMs,
                lastModifiedAt: 0 as TimestampMs,
                userPriority: 0,
            })
        }

        for (const c of cards.map((c): EngineCard<CardData, SM2CardState> => ({
            data: c,
            state: initializeSM2CardState(),
        }))) {
            await sdb.write([{
                type: IDBScopeDBWriteType.CARD_DATA,
                cardData: c,
            }])
        }
    })
    afterEach(async () => {
        await db.clear()
        db.close()
    })

    it("can get stats", async () => {
        // const stats = await engine.getStatistics({
        //     now: 1000 as TimestampMs,
        // })
        // TODO(teawithsand): some assertions here
    })

    it("can answer a card and undo it", async () => {
        const state: SM2UserState = {
            now: 1000 as TimestampMs,
        }

        const handle = await engine.getCard(state)
        {
            if (!handle) throw new Error(`Handle not present`)

            expect(handle.card.state.type).toEqual(SM2CardStateType.NEW)

            await handle.answerAndSave(SM2EngineAnswer.EASY)
        }

        {
            const card = await sdb.querySingle({
                type: IDBScopeDBQueryType.BY_ID,
                id: handle.card.data.id,
            })

            expect(card?.state?.type).toEqual(SM2CardStateType.LEARNED)
        }

        await engine.undo()

        {
            const card = await sdb.querySingle({
                type: IDBScopeDBQueryType.BY_ID,
                id: handle.card.data.id,
            })

            expect(card?.state?.type).toEqual(SM2CardStateType.NEW)
        }
    })


    it.each([
        [SM2EngineAnswer.EASY],
        [SM2EngineAnswer.GOOD]
    ])("can go through all cards for today with good and easy answers", async (answer: SM2EngineAnswer) => {
        const state: SM2UserState = {
            now: 1000 as TimestampMs,
        }

        for (; ;) {
            const handle = await engine.getCard(state)
            if (!handle) break

            await handle.answerAndSave(answer)
        }
    })

    it("can go through all cards for today with easy answers and undo it all", async () => {
        const state: SM2UserState = {
            now: 1000 as TimestampMs,
        }

        const localCards = []
        for (var i = 0; ; i++) {
            const handle = await engine.getCard(state)
            if (!handle) break

            localCards.push(
                await handle.answerAndSave(SM2EngineAnswer.EASY)
            )
        }

        for (let j = i; j >= 0; j--) {
            await engine.undo()
        }

        for(const lc of localCards) {
            expect(lc.state.type).toEqual(SM2CardStateType.LEARNED)

            const storedCard = await sdb.querySingle({
                type: IDBScopeDBQueryType.BY_ID,
                id: lc.data.id,
            })

            expect(storedCard?.state.type).toEqual(SM2CardStateType.NEW)
        }
    })
})