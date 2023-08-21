import { ScopeDB } from "../../db/defines";
import { IDBScopeDBQuery, IDBScopeDBQueryType, IDBScopeDBWrite } from "../../db/impl";
import { EngineCard, EngineStatsLoader, SM2CardStateType, SM2EngineState, SM2Statistics, SM2UserState } from "../defines";
import { SM2EngineStateUtil } from "./util";

export class SM2EngineStatsLoader<EP, CS, CD> implements EngineStatsLoader<
    SM2EngineState,
    SM2Statistics
>{
    constructor(
        private readonly db: ScopeDB<
            EngineCard<CD, CS>,
            EP,
            IDBScopeDBWrite<EngineCard<CD, CS>, EP>,
            IDBScopeDBQuery
        >,
    ) { }
    getStatistics = async (
        engineState: SM2EngineState,
    ): Promise<SM2Statistics> => {
        // TODO(teawithsand): these stats are insanely slow; make them faster
        
        const util = new SM2EngineStateUtil(engineState)

        const learnedCardCount = await (await this.db.queryMany({
            type: IDBScopeDBQueryType.BY_PRIORITY,
            groups: [SM2CardStateType.LEARNED],
            omitDeleted: true,
            asc: true,
        })).left()

        const newCardCount = await (await this.db.queryMany({
            type: IDBScopeDBQueryType.BY_PRIORITY,
            groups: [SM2CardStateType.NEW],
            omitDeleted: true,
            asc: true,
        })).left()

        const learningCardCount = await (await this.db.queryMany({
            type: IDBScopeDBQueryType.BY_PRIORITY,
            groups: [SM2CardStateType.LEARNING],
            omitDeleted: true,
            asc: true,
        })).left()

        const relearningCardCount = await (await this.db.queryMany({
            type: IDBScopeDBQueryType.BY_PRIORITY,
            groups: [SM2CardStateType.RELEARNING],
            omitDeleted: true,
            asc: true,
        })).left()

        return {
            todayLeftNewCardCount: Math.max(0,util.newCardsLimit -  engineState.dailyState.processedNewCount),
            todayLeftLearnedCardCount: Math.max(0, util.learnedCardsLimit - engineState.dailyState.processedLearnedCount),

            newCardCount,
            learnedCardCount,
            learningCardCount,
            relearningCardCount,

            todayProcessedNewCardCount: engineState.dailyState.processedNewCount,
            todayProcessedLearnedCardCount: engineState.dailyState.processedLearnedCount,
        }
    }

}