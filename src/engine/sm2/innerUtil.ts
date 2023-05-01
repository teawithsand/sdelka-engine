import { CardId } from "../../storage"
import { NDTSC } from "../../util/sync"
import { SM2CardType, SM2EngineCardData } from "./defines"

/**
 * Creates card data for new card.
 */
export const makeNewSM2EngineCardData = (
	id: CardId,
	offset: NDTSC
): SM2EngineCardData => ({
	type: SM2CardType.NEW,
	id,
	engineQueueOffset: offset,
})

export enum SM2EngineQueueId {
	NEW = "new",
	RELEARNING = "relearning",
	LEARNING = "learning",
	LEARNED = "learned",
}

export const cardTypeToQueueId = (ct: SM2CardType): SM2EngineQueueId => {
	if (ct === SM2CardType.NEW) {
		return SM2EngineQueueId.NEW
	} else if (ct === SM2CardType.RELEARNING) {
		return SM2EngineQueueId.RELEARNING
	} else if (ct === SM2CardType.LEARNING) {
		return SM2EngineQueueId.LEARNING
	} else if (ct === SM2CardType.LEARNED) {
		return SM2EngineQueueId.LEARNED
	} else {
		throw new Error(`Unknown card type ${ct}`)
	}
}
