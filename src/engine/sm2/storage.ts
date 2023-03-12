import { TimestampMs } from "@teawithsand/tws-stl"
import { GroupedQueue } from "../../storage/queue"
import { CardId } from "../../storage/storage"
import { Clock } from "../clock"
import {
	SM2CardType,
	SM2EngineCardData,
	SM2EngineStorageStats
} from "./defines"
import { makeNewSM2EngineCardData, SM2EngineQueueId } from "./innerUtil"

export class SM2EngineStorage {
	constructor(
		public readonly queue: GroupedQueue<SM2EngineCardData>,
		public readonly clock: Clock
	) {}

	/**
	 * Returns data of card with given id.
	 * Returns null if card is not on any queue.
	 */
	getEngineCardData = async (
		id: CardId
	): Promise<SM2EngineCardData | null> => {
		return await this.queue.getId(id)
	}

	setEngineCardData = async (data: SM2EngineCardData) => {
		await this.queue.push(data)
	}

	deleteEngineCardData = async (id: CardId) => {
		await this.queue.deleteId(id)
	}

	appendNewCard = async (id: CardId) => {
		const offset = await this.queue.length([SM2EngineQueueId.NEW])
		await this.setEngineCardData(makeNewSM2EngineCardData(id, offset))
	}

	getStorageStats = async (): Promise<SM2EngineStorageStats> => {
		return {
			newCount: await this.queue.length([SM2EngineQueueId.NEW]),
			relearningCount: await this.queue.length([
				SM2EngineQueueId.RELEARNING,
			]),
			learningCount: await this.queue.length([SM2EngineQueueId.LEARNING]),
			// TODO(teawithsand): specify priority range here for LEARNED cards
			repetitionCount: await this.queue.length([
				SM2EngineQueueId.LEARNED,
			]),
		}
	}

	getTopEngineCardData = async (): Promise<SM2EngineCardData | null> => {
		let card = await this.queue.peek([
			SM2EngineQueueId.RELEARNING,
			SM2EngineQueueId.LEARNED,
			SM2EngineQueueId.LEARNING,
		])

		if (card && card.type === SM2CardType.NEW) {
			throw new Error("Assertion filed: Card can't be new here")
		}

		if (!card) {
			let candidate = await this.queue.peek([SM2EngineQueueId.NEW])
			if (candidate) card = candidate
		}

		return card
	}

	getTodaysTopEngineCardData = async (
		now: TimestampMs = this.clock.getNow()
	): Promise<SM2EngineCardData | null> => {
		let card = await this.queue.peek([
			SM2EngineQueueId.RELEARNING,
			SM2EngineQueueId.LEARNED,
			SM2EngineQueueId.LEARNING,
		])

		if (card && card.type === SM2CardType.NEW) {
			throw new Error("Assertion filed: Card can't be new here")
		}

		if (!card || card.desiredPresentationTimestamp > now) {
			let candidate = await this.queue.peek([SM2EngineQueueId.NEW])
			if (candidate) card = candidate
		}

		if (
			card &&
			card.type === SM2CardType.LEARNED &&
			this.clock.getDay(card.desiredPresentationTimestamp) >
				this.clock.getDay(now)
		) {
			card = null
		}

		return card
	}
}
