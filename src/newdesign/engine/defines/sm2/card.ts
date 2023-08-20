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

/**
 * Extracts priority value of SM2CardState. Should be used as part of IDBDBCardMetadataExtractor.
 * It can be extended, so that custom user priority factors may be added with `.push` on resulting array.
 * 
 * It should be noted. Please note that priority for cards other than new one should not be overridden.
 */
export const extractSM2CardStatePriority = (state: SM2CardState): IDBComparable[] => {
	if (state.type === SM2CardStateType.NEW) {	
		return []
    } else {
        return [state.desiredPresentationTimestamp]
    }
}

/**
 * Initializes SM2 card state for new cards.
 * 
 * @returns SM2 card state suitable for use in new cards.
 */
export const initializeSM2CardState = (): SM2CardState => ({
	type: SM2CardStateType.NEW,
})