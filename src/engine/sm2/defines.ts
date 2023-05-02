import { CardId } from "../../storage/storage"
import { TimeMs } from "../../pubutil/time"
import { DayTimestamp } from "../clock"
import { TimestampMs } from "../../util/stl"
import { NDTSC, SyncData } from "../../util/sync"

export enum SM2EngineAnswer {
	EASY = 1,
	GOOD = 2,
	HARD = 3,
	AGAIN = 4,
}

export type SM2EngineStorageStats = {
	newCount: number
	learningCount: number
	relearningCount: number
	learnedCount: number
}

export type SM2EngineStats = {
	newCount: number
	learningCount: number
	relearningCount: number
	repetitionCount: number
}

export type SM2EngineDailyDailyData = {
	dailyConfig: SM2EngineDailyConfig

	/**
	 * DayTimestamp this data was generated at. Stored in order to check if it's up-to-date. 
	 */
	dayTimestamp: DayTimestamp

	/**
	 * How many cards were polled from LEARNED queue today.
	 */
	processedLearnedCount: number

	/**
	 * How many new cards have been processed today.
	 */
	processedNewCardsCount: number
}

export type SM2EngineSessionData = {
	/**
	 * Used to ensure that we are using non-backing timer, as using such timer would break our scheduler.
	 */
	lastTimestampFetched: TimestampMs

	/**
	 * Session data, which gets reset every day.
	 */
	dailyData: SM2EngineDailyDailyData

	/**
	 * NDTSC updated each time card data gets updated.
	 * Used for synchronization.
	 */
	cardDataNdtsc: NDTSC

	/**
	 * NDTSC updated each time card is added to engine.
	 * Used to maintain order between new cards, which have the same priority.
	 */
	cardInsertNdtsc: NDTSC
}

export type SM2EngineDailyConfig = {
	learnedCountOverride: {
		/**
		 * How many learned cards may be processed that day.
		 *
		 * null should be used instead of infinity.
		 * Beware that using null causes infinite repetition cycle to run when used with allowNotToday.
		 */
		limit: number | null
	
		/**
		 * When true, limit really equals to
		 * 1. If one of them is null, other one is used.
		 * 2. If both are null, then null.
		 * 3. `limit + config.maxLearnedReviewsPerDay`.
		 */
		limitIsRelative: boolean
	}
	
	/**
	 * How many days into future is considered today?
	 *
	 * By default zero.
	 */
	learnedCardDaysFutureAllowed: number

	/**
	 * How many cards user requested to be available above/below the desired new cards per day value.
	 *
	 * By default 0; can be less than zero.
	 */
	additionalNewCardsToProcess: number
}

export type SM2EngineConfig = {
	initialDailyConfig: SM2EngineDailyConfig

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

	maxNewCardsPerDay: number // TODO(teawithsand): make it nullable
	maxLearnedReviewsPerDay: number | null
}

export enum SM2CardType {
	NEW = 0,
	LEARNING = 1,
	LEARNED = 2,
	RELEARNING = 3,
}

export type SM2EngineCardStats = {
	/**
	 * How many times has this card jumped from learned to relearning.
	 */
	lapCount: number
}

export type SM2EngineCardData = {
	/**
	 * Id of card that this data belongs to.
	 */
	id: CardId

	/**
	 * SyncData for each card, so we know when it was updated, so we can synchronize different learning sessions.
	 */
	syncData: SyncData
} & (
	| {
			type: SM2CardType.NEW
			ndtscOffset: number
			userPriorityOffset: number
	  }
	| ({
			desiredPresentationTimestamp: TimestampMs
	  } & (
			| {
					type: SM2CardType.LEARNING
					stepIndex: number
			  }
			| (SM2EngineCardStats & {
					/**
					 * Factor, which should be used to multiply intervals by.
					 */
					easeFactor: number
			  } & (
						| {
								type: SM2CardType.RELEARNING
								stepIndex: number
						  }
						| {
								type: SM2CardType.LEARNED

								/**
								 * Interval used to determine next desiredPresentationTimestamp.
								 */
								interval: TimeMs
						  }
					))
	  ))
)
