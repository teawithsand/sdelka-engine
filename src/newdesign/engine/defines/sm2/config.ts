import { TimeMs } from "../../../../util"

export enum NotDueCardPickStrategy {
	NEW_FIRST = 1,
	LEARNED_FIRST = 2,
	RANDOM = 3,
	DESIRED_PRESENTATION_TIMESTAMP = 4,
}

export type SM2EngineConfig = {
    learnedLimitBase: number
	newLimitBase: number

	newDayDelta: TimeMs

	notDueCardPickStrategy: NotDueCardPickStrategy

	skipLearningInterval: number
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

export const DEFAULT_SM2_ENGINE_CONFIG: Readonly<SM2EngineConfig> = {
    learnedLimitBase: 100,
	newLimitBase: 30,

	newDayDelta: 0,

	notDueCardPickStrategy: NotDueCardPickStrategy.DESIRED_PRESENTATION_TIMESTAMP,


    skipLearningEaseFactor: 2,
    
    initEaseFactor: 1.4,
    minEaseFactor: 1.2,
    maxEaseFactor: 4,

    hardEaseFactorDelta: 0.1,
    easyEaseFactorDelta: 0.2,
    lapEaseFactorDelta: 0.2,

    maxInterval: 1000 * 60 * 60 * 24 * 365 * 10,
    skipLearningInterval: 1000 * 60 * 60 * 24 * 4,
    graduatedInterval: 1000 * 60 * 60 * 24,
    relearnedInterval: 1000 * 60 * 60 * 24,
    lapInterval: 1000 * 60,

    learningSteps: [1000 * 60, 1000 * 60 * 10],
    relearningSteps: [1000 * 60, 1000 * 60 * 10],
}
