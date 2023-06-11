import { TimestampMs } from "../../internal/stl"
import { IDBComparable, TimeMs } from "../../util"

export enum EngineEntryDataType {
	NEW = 0,
	LEARNING = 1,
	LEARNED = 2,
	RELEARNING = 3,
}

export type EngineEntryData = {
	isOutOfSync?: boolean
} & (
	| {
			type: EngineEntryDataType.NEW
			ordinalNumber: IDBComparable
			userPriority: IDBComparable
	  }
	| ({
			desiredPresentationTimestamp: TimestampMs
	  } & (
			| {
					type: EngineEntryDataType.LEARNING
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
								type: EngineEntryDataType.RELEARNING
								stepIndex: number
						  }
						| {
								type: EngineEntryDataType.LEARNED

								/**
								 * Interval used to determine next desiredPresentationTimestamp.
								 */
								interval: TimeMs
						  }
					))
	  ))
)


/**
 * Entity, which is only used in scope of engine. Represents EngineEntryData with id.
 * 
 * It should not be used by external library users unless they are shipping alternative engine implementation
 * or EngineStorage implementation.
 */
export type EngineEntryDataEntity = {
    id: string
    data: EngineEntryData
}

export type EngineHistoryData = EngineEntryDataEntity