import { EngineStateManager, SM2EnginePersistentState, SM2EngineState, SM2UserState } from "../defines";

export class SM2EngineStateManager implements EngineStateManager<SM2EngineState, SM2EnginePersistentState, SM2UserState> {
    getEngineState = (
        enginePersistentState: SM2EnginePersistentState,
        userGlobalState: SM2UserState
    ): SM2EngineState => {
        const now = userGlobalState.now
        const dayTimestamp = Math.max(
            0,
            Math.floor((now + enginePersistentState.config.newDayDelta) / (24 * 60 * 60 * 1000)),
        )

        return {
            now: now,
            config: enginePersistentState.config,
            dailyState: enginePersistentState.dailyState.dayTimestamp === dayTimestamp ?
                enginePersistentState.dailyState :
                {
                    dayTimestamp: dayTimestamp,
                    learnedLimitDelta: 0,
                    newLimitDelta: 0,
                    processedLearnedCount: 0,
                    processedNewCount: 0,
                },
        }
    }

    getPersistentState = (engineState: SM2EngineState): SM2EnginePersistentState => {
        return {
            dailyState: engineState.dailyState,
            config: engineState.config,
        }
    }
}