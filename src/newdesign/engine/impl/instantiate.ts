import { ScopeDB } from "../../db/defines";
import { IDBScopeDBQuery, IDBScopeDBWrite } from "../../db/impl";
import { EngineCard, EngineImpl, NotDueCardPickStrategy, SM2CardState, SM2EngineConfig, SM2EnginePersistentState } from "../defines";
import { IDBScopeDBEngineInitializer } from "./initializer";
import { SM2IDBScopeDBEngineCardLoader } from "./loader";
import { SM2EngineStateManager } from "./manager";
import { IDBScopeDBEngineSaver } from "./saver";
import { SM2EngineStatsLoader } from "./stats";
import { SM2EngineStateTransition } from "./transition";

export const DEFAULT_SM2_ENGINE_CONFIG: SM2EngineConfig = {
    learnedLimitBase: 100,
	newLimitBase: 30,

	newDayDelta: 0,

	notDueCardPickStrategy: NotDueCardPickStrategy.DESIRED_PRESENTATION_TIMESTAMP,

	skipLearningInterval: 1.25,
    skipLearningEaseFactor: 2,
    
    initEaseFactor: 1.4,
    minEaseFactor: 1.2,
    maxEaseFactor: 4,

    hardEaseFactorDelta: 0.1,
    easyEaseFactorDelta: 0.2,
    lapEaseFactorDelta: 0.2,

    maxInterval: 1000 * 60 * 60 * 24 * 365,
    graduatedInterval: 1000 * 60 * 60 * 24,
    relearnedInterval: 1000 * 60 * 60 * 24,
    lapInterval: 1000 * 60,

    learningSteps: [1000 * 60, 1000 * 60 * 10],
    relearningSteps: [1000 * 60, 1000 * 60 * 10],
}

export const makeSM2Engine = <CD>(
    db: ScopeDB<
        EngineCard<SM2CardState, CD>,
        SM2EnginePersistentState,
        IDBScopeDBWrite<EngineCard<SM2CardState, CD>, SM2EnginePersistentState>,
        IDBScopeDBQuery
    >
) => {
    return new EngineImpl(
        new IDBScopeDBEngineInitializer(
            db,
            {
                config: DEFAULT_SM2_ENGINE_CONFIG,
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
        new IDBScopeDBEngineSaver<SM2EnginePersistentState, SM2CardState, CD>(
            db,
        ),
        new SM2IDBScopeDBEngineCardLoader(
            db,
        ),
        new SM2EngineStatsLoader(),
        new SM2EngineStateManager(),
    )
}