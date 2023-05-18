import { IDBComparable, TimeMs } from "../../pubutil"
import { TimestampMs } from "../../util/stl"

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


export type EngineEntryDataEntity = {
    id: string
    data: EngineEntryData
}

export type EngineHistoryData = EngineEntryDataEntity