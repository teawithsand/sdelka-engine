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
	todayLearnedCount: number
}

export type SM2EngineStats = {
	newCount: number
	learningCount: number
	relearningCount: number
	repetitionCount: number
}

export type SM2EngineDailySessionData = {
	dayTimestamp: DayTimestamp
	
	/**
	 * How many cards were polled from LEARNED queue today.
	 */
	learnedReviewedCount: number

	/**
	 * Daily limit of reviewed cards. Can be adjusted accordingly.
	 */
	maxLearnedReviewCardCount: number

	/**
	 * How many cards(besides reviewed in-schedule) should be processed today.
	 */
	additionalLearnedReviewCount: number

	/**
	 * How many new cards have been processed today.
	 */
	processedNewCardsCount: number

	/**
	 * How many cards user requested to be available above/below the desired new cards per day value.
	 * 
	 * By default 0; can be less than zero.
	 */
	additionalNewCardsToProcess: number
}

export type SM2EngineSessionData = {
	/**
	 * Used to ensure that we are using non-backing timer, as using such timer would break our scheduler.
	 */
	lastTimestampFetched: TimestampMs

	/**
	 * Session data, which gets reset every day.
	 */
	dailyData: SM2EngineDailySessionData

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

export type SM2EngineConfig = {
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

	maxNewCardsPerDay: number
	maxLearnedReviewsPerDay: number
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
