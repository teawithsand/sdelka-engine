import { EngineCard } from "./card"

export type CardStateTransitionResult<EG, CS> = {
    cardState: CS,
    engineState: EG
}

export interface EngineStateTransition<EG, UA, CS, MSG> {
    transitionEngineCommand: (
        engineState: EG,
        message: MSG
    ) => EG

    transitionCardState: (
        engineState: EG,
        userAnswer: UA,
        cardState: CS
    ) => CardStateTransitionResult<EG, CS>
}

export interface EngineSaver<EP, CS, CD> {
    saveEngineStateTransition: (persistentEngineState: EP) => Promise<void>
    saveStateCardTransitionResult: (
        originalCard: EngineCard<CS, CD>,
        transitionResult: CardStateTransitionResult<EP, CS>,
    ) => Promise<void>
    undo: () => Promise<void>
}

export interface EngineStateManager<ES, EP, UG> {
    getEngineState: (enginePersistentState: EP, userGlobalState: UG) => ES
    getPersistentState: (engineState: ES) => EP,
}

export interface EngineInitializer<EP> {
    /**
     * Loads engine global state. 
     * 
     * This function should be called only once during initialization. 
     * Then state should be managed internally in-memory until engine is reinitialized.
     */
    loadEngineGlobalState: () => Promise<EP>
}

/**
 * Component responsible for loading the topmost card.
 */
export interface EngineCardLoader<ES, CS, CD> {
    /**
     * Loads whatever card is considered fittest by this loader.
     * 
     * It may also return null when it thinks that there is no more card to process for some reason.
     */
    loadCardState: (
        engineState: ES,
    ) => Promise<EngineCard<CS, CD> | null>
}

/**
 * Component responsible for gathering any kind of statistics for end user from given engine.
 */
export interface EngineStatsLoader<ES, ST> {
    getStatistics: (
        engineState: ES,
    ) => Promise<ST>
}