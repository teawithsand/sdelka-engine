import { DerivedEntryEngineDataExtractor } from "../../store"
import { EngineEntryData, EngineEntryDataType } from "./entry"
import { EngineQueueType } from "./queue"

const entryTypeToQueue = (type: EngineEntryDataType): EngineQueueType => {
	if (type === EngineEntryDataType.NEW) {
		return EngineQueueType.NEW
	} else if (type === EngineEntryDataType.LEARNING) {
		return EngineQueueType.LEARNING
	} else if (type === EngineEntryDataType.RELEARNING) {
		return EngineQueueType.RELEARNING
	} else if (type === EngineEntryDataType.LEARNED) {
		return EngineQueueType.LEARNED
	} else {
		throw new Error(`Invalid entry type ${type}`)
	}
}

export const EngineDataExtractor: DerivedEntryEngineDataExtractor<
	EngineEntryData
> = (data) => {
	if (data.type === EngineEntryDataType.NEW) {
		return {
			isOutOfSync: data.isOutOfSync ?? true,
			queue: entryTypeToQueue(data.type),
			queuePriority: [data.userPriority, data.ordinalNumber],
		}
	} else {
		return {
			isOutOfSync: data.isOutOfSync ?? true,
			queue: entryTypeToQueue(data.type),
			queuePriority: data.desiredPresentationTimestamp,
		}
	}
}
