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

	skipLearningInterval: 1.25
	skipLearningEaseFactor: number

	initEaseFactor: number
	minEaseFactor: number
	maxEaseFactor: number

	hardEaseFactorDelta: number
	easyEaseFactorDelta: number
	lapEaseFactorDelta: number

	maxInterval: TimeMs
	graduatedInterval: TimeMs
	relearnedInterval: TimeMs
	lapInterval: TimeMs

	learningSteps: TimeMs[]
	relearningSteps: TimeMs[]
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
                config: {
                    
                },
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