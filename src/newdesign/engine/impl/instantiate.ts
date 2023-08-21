import { ScopeDB } from "../../db/defines";
import { IDBScopeDBQuery, IDBScopeDBWrite } from "../../db/impl";
import { DEFAULT_SM2_ENGINE_CONFIG, Engine, EngineCard, EngineImpl, SM2CardState, SM2EngineAnswer, SM2EngineConfig, SM2EngineMessage, SM2EnginePersistentState, SM2Statistics, SM2UserState } from "../defines";
import { IDBScopeDBEngineInitializer } from "./initializer";
import { SM2IDBScopeDBEngineCardLoader } from "./loader";
import { SM2EngineStateManager } from "./manager";
import { IDBScopeDBEngineSaver } from "./saver";
import { SM2EngineStatsLoader } from "./stats";
import { SM2EngineStateTransition } from "./transition";

export const makeSM2Engine = <CD>(
    db: ScopeDB<
        EngineCard<CD, SM2CardState>,
        SM2EnginePersistentState,
        IDBScopeDBWrite<EngineCard<CD, SM2CardState>, SM2EnginePersistentState>,
        IDBScopeDBQuery
    >,
    defaultConfig: SM2EngineConfig = DEFAULT_SM2_ENGINE_CONFIG
): Engine<SM2UserState, SM2EngineAnswer, CD, SM2CardState, SM2EngineMessage, SM2Statistics> => {
    return new EngineImpl(
        new IDBScopeDBEngineInitializer(
            db,
            {
                config: defaultConfig,
                dailyState: {
                    dayTimestamp: NaN,
                    learnedLimitDelta: 0,
                    newLimitDelta: 0,
                    processedLearnedCount: 0,
                    processedNewCount: 0,
                }
            }
        ),
        new SM2EngineStateTransition(),
        new IDBScopeDBEngineSaver(
            db,
        ),
        new SM2IDBScopeDBEngineCardLoader(
            db,
        ),
        new SM2EngineStatsLoader(db),
        new SM2EngineStateManager(),
    )
}