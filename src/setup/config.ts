import { EngineConfig } from "../engine";

export const DefaultEngineConfig: Readonly<EngineConfig> = {
    skipLearningInterval: 1000 * 60 * 60 * 24 * 4,
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
 
    initialDailyConfig: {
        learnedCountLimit: null,
        newCardLimit: 30,
        learnedCardDaysFutureAllowed: 0
    }
}