import { TimestampMs } from "../../../internal"
import { IDBComparable } from "../../../util"
import { IDBDB, IDBScopeDB } from "../../db/impl"
import { EngineCard, SM2CardState, SM2EnginePersistentState, extractSM2CardStatePriority } from "../defines"
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

    beforeEach(() => {
        db = new IDBDB<EngineCard<CardData, SM2CardState>, SM2EnginePersistentState>("newdgign-fdsa-fdas", (data) => {
            return {
                id: data.data.id,
                deletedAt: data.data.deletedAt,
                lastModifiedAt: data.data.lastModifiedAt,
                group: data.state.type,
                priority: extractSM2CardStatePriority(data.state),
            }
        })
        sdb = new IDBScopeDB("s1", db)
        engine = makeSM2Engine(sdb)
    })
    afterEach(async () => {
        await db.clear()
        db.close()
    })

    it("does nothing", () => {
        
    })
})