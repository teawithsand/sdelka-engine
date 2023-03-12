import { TimestampMs } from "@teawithsand/tws-stl"
import { CardId } from "../../storage/storage"
import { TimeMs } from "../../util/time"

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
	repetitionCount: number
}

export type SM2EngineStats = {
	storageStats: SM2EngineStorageStats
}

export type SM2EngineSessionData = {
	/**
	 * Used to ensure that we are using non-backing timer, as using such timer would break our scheduler.
	 */
	lastTimestampFetched: TimestampMs

	/**
	 * Note: In fact, day is the only thing that matters, so it could be stored instead.
	 * But whole ts is stored instead.
	 *
	 * TODO(teawithsand): check behavior of day shift on this method of storing day
	 */
	lastCardFetchedTimestamp: TimestampMs

	/**
	 * ID of card fetched from source. Used to determine what next card should be.
	 */
	lastCardId: string | null
}

export type SM2EngineConfig = {
	newCardsPerDay: number

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

export enum SM2CardType {
	NEW = 0,
	LEARNING = 1,
	LEARNED = 2,
	RELEARNING = 3,
}

export type SM2EngineCardData = {
	/**
	 * Id of card that this data belongs to.
	 */
	id: CardId
} & (
	| {
			type: SM2CardType.NEW
			engineQueueOffset: number
	  }
	| ({
			desiredPresentationTimestamp: TimestampMs
	  } & (
			| {
					type: SM2CardType.LEARNING
					stepIndex: number
			  }
			| ({
					/**
					 * How many times has this card jumped from learned to relearning.
					 */
					lapCount: number

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

