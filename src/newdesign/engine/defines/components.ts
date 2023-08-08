import { EngineCard } from "./card"

export type CardStateTransitionResult<EG, CS> = {
    cardState: CS,
    engineGlobalState: EG
}

export interface EngineStateTransition<EG, UG, UA, CS, MSG> {
    transitionEngineCommand: (
        engineGlobalState: EG,
        userGlobalState: UG,
        message: MSG
    ) => EG

    transitionCardState: (
        engineGlobalState: EG,
        userGlobalState: UG,
        userAnswer: UA,
        cardState: CS
    ) => CardStateTransitionResult<EG, CS>
}

export interface EngineSaver<EG, CS, CD> {
    saveEngineStateTransition: (eg: EG) => Promise<void>
    saveStateCardTransitionResult: (
        originalCard: EngineCard<CS, CD>,
        transitionResult: CardStateTransitionResult<EG, CS>,
    ) => Promise<void>
    undo: () => Promise<void>
}

export interface EngineInitializer<EG> {
    /**
     * Loads engine global state. 
     * 
     * This function should be called only once during initialization. 
     * Then state should be managed internally in-memory until engine is reinitialized.
     */
    loadEngineGlobalState: () => Promise<EG>
}

/**
 * Component responsible for loading the topmost card.
 */
export interface EngineCardLoader<EG, UG, CS, CD> {

    /**
     * Loads whatever card is considered fittest by this loader.
     * 
     * It may also return null when it thinks that there is no more card to process for some reason.
     */
    loadCardState: (
        engineGlobalState: EG,
        userGlobalState: UG,
    ) => Promise<EngineCard<CS, CD> | null>
}

/**
 * Component responsible for gathering any kind of statistics for end user from given engine.
 */
export interface EngineStatsLoader<EG, UG, ST> {
    getStatistics: (
        engineGlobalState: EG,
        userGlobalState: UG
    ) => Promise<ST>
}