import { GroupedQueueElementPropsExtractor } from "../storage/queue"
import { SM2CardType, SM2EngineCardData } from "./defines"
import { cardTypeToQueueId } from "./innerUtil"

export const SM2EngineQueueElementExtractor: GroupedQueueElementPropsExtractor<
	SM2EngineCardData
> = (data) => {
	if (data.type === SM2CardType.NEW) {
		return {
			id: data.id,
			group: cardTypeToQueueId(data.type),
			priority: [data.userPriorityOffset, data.ndtscOffset],
		}
	} else {
		return {
			id: data.id,
			group: cardTypeToQueueId(data.type),
			priority: data.desiredPresentationTimestamp,
		}
	}
}