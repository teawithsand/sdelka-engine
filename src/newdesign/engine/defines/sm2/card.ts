import { TimestampMs } from "../../../../internal"
import { IDBComparable, TimeMs } from "../../../../util"

export enum SM2CardStateType {
	NEW = 0,
	LEARNING = 1,
	LEARNED = 2,
	RELEARNING = 3,
}

export type SM2CardState = {
	isOutOfSync?: boolean
} & (
	| {
			type: SM2CardStateType.NEW
			ordinalNumber: IDBComparable
			userPriority: IDBComparable
	  }
	| ({
			desiredPresentationTimestamp: TimestampMs
	  } & (
			| {
					type: SM2CardStateType.LEARNING
					stepIndex: number
			  }
			| ({
					/**
					 * How many times has this card jumped from learned to relearning.
					 */
					lapCount: number
			  } & {
					/**
					 * Factor, which should be used to multiply intervals by.
					 */
					easeFactor: number
			  } & (
						| {
								type: SM2CardStateType.RELEARNING
								stepIndex: number
						  }
						| {
								type: SM2CardStateType.LEARNED

								/**
								 * Interval used to determine next desiredPresentationTimestamp.
								 */
								interval: TimeMs
						  }
					))
	  ))
)