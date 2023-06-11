import { TimeMs } from "../../util"

export type EngineDailyConfig = {
	/**
	 * How many learned cards may be reviewed today?
	 *
	 * null is considered infinite; as many as required for that day
	 *
	 * Equal to zero, when less than already-processed count.
	 */
	learnedCountLimit: number | null

	/**
	 * How many new cards should be processed that day?
	 *
	 * Equal to zero, when less than already-processed count.
	 */
	newCardLimit: number

	/**
	 * How many days into future is considered today?
	 */
	learnedCardDaysFutureAllowed: number
}

export enum NotDueCardPickStrategy {
	NEW_FIRST = 1,
	LEARNED_FIRST = 2,
	RANDOM = 4,
}

export type EngineConfig = {
	initialDailyConfig: EngineDailyConfig

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
