import { TimestampMs } from "@teawithsand/tws-stl"
import { CardId } from "../../storage/storage"
import { TimeMs } from "../../pubutil/time"

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
	newCount: number
	learningCount: number
	relearningCount: number
	repetitionCount: number
}

export type SM2EngineSessionData = {
	/**
	 * Used to ensure that we are using non-backing timer, as using such timer would break our scheduler.
	 */
	lastTimestampFetched: TimestampMs

	/**
	 * ID of card fetched from source. Used to determine what next card should be.
	 */
	lastCardId: string | null

	/**
	 * Counter, which tells you how many additional learned cards should be pulled, once we ran out of new cards.
	 */
	additionalLearningCardsCounter: number
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

