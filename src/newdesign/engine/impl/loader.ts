import { ScopeDB } from "../../db/defines";
import { IDBScopeDBQuery, IDBScopeDBQueryType, IDBScopeDBWrite } from "../../db/impl";
import { EngineCard, EngineCardLoader, SM2CardState, SM2CardStateType, SM2EnginePersistentState, SM2EngineState } from "../defines";
import { SM2EngineStateUtil } from "./util";

export class SM2IDBScopeDBEngineCardLoader<CD> implements EngineCardLoader<
    SM2EngineState,
    CD,
    SM2CardState
> {
    constructor(
        private readonly db: ScopeDB<
            EngineCard<CD, SM2CardState>,
            SM2EnginePersistentState,
            IDBScopeDBWrite<EngineCard<CD, SM2CardState>, SM2EnginePersistentState>,
            IDBScopeDBQuery
        >,
    ) { }

    loadCardState = async (
        engineState: SM2EngineState,
    ): Promise<EngineCard<CD, SM2CardState> | null> => {
        // TODO(teawithsand): implement NotDueCardPickStrategy here

        const now = engineState.now
        const daily = engineState.dailyState

        const stateUtil = new SM2EngineStateUtil(engineState)

        const fallbackCandidate = await this.db.querySingle({
            type: IDBScopeDBQueryType.BY_PRIORITY,
            asc: false,
            groups: [SM2CardStateType.LEARNING, SM2CardStateType.RELEARNING],
            omitDeleted: true,
        })

        const newCandidate = daily.processedNewCount < stateUtil.newCardsLimit ? await this.db.querySingle({
            type: IDBScopeDBQueryType.BY_PRIORITY,
            asc: false,
            groups: [SM2CardStateType.NEW],
            omitDeleted: true,
        }) : null

        const learnedCandidate = daily.processedLearnedCount < stateUtil.learnedCardsLimit ? await this.db.querySingle({
            type: IDBScopeDBQueryType.BY_PRIORITY,
            asc: false,
            groups: [SM2CardStateType.LEARNED],
            omitDeleted: true,
        }) : null

        const candidates = [fallbackCandidate, newCandidate, learnedCandidate].filter(x => !!x)
        candidates.sort((a, b) => {
            if (!a || !b) throw new Error("Unreachable code")
            const presentationTimestampA = a.state.type === SM2CardStateType.NEW ? now : a.state.desiredPresentationTimestamp
            const presentationTimestampB = b.state.type === SM2CardStateType.NEW ? now : b.state.desiredPresentationTimestamp

            return presentationTimestampA - presentationTimestampB
        })

        if (candidates.length) {
            const candidate = candidates[0]
            if (!candidate) throw new Error("Unreachable code")
            if (candidate.state.type === SM2CardStateType.LEARNED) {
                if (!stateUtil.isCardForToday(candidate.state.desiredPresentationTimestamp)) {
                    return null
                }
            }

            return candidate
        }

        return null
    }
}