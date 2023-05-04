import { GroupedQueue } from "../storage/queue"
import { CardId } from "../storage/storage"
import { TimestampMs } from "../../util/stl"
import { Clock, DayTimestamp } from "../clock"
import {
	SM2CardType,
	SM2EngineCardData,
	SM2EngineStorageStats,
} from "./defines"
import { SM2EngineQueueId } from "./innerUtil"

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
		await this.queue.add(data)
	}

	deleteEngineCardData = async (id: CardId) => {
		// TODO(teawithsand): move that card to deleted queue + integrate it with undo
		await this.queue.deleteId(id)
	}

	appendNewCard = async (
		data: SM2EngineCardData & { type: SM2CardType.NEW }
	) => {
		await this.setEngineCardData(data)
	}

	getNewCardCount = async () => {
		return await this.queue.length([SM2EngineQueueId.NEW])
	}

	getStorageStats = async (
		toDay: DayTimestamp
	): Promise<SM2EngineStorageStats> => {
		return {
			newCount: await this.queue.length([SM2EngineQueueId.NEW]),
			relearningCount: await this.queue.length([
				SM2EngineQueueId.RELEARNING,
			]),
			learningCount: await this.queue.length([SM2EngineQueueId.LEARNING]),
			learnedCount: await this.queue.length(
				[SM2EngineQueueId.LEARNED],
				{
					toExcl: toDay,
				}
			),
		}
	}

	getTopEngineCardData = async (
		now: TimestampMs,
		disallowNew?: boolean
	): Promise<SM2EngineCardData | null> => {
		let card = await this.queue.peekBack([
			SM2EngineQueueId.RELEARNING,
			SM2EngineQueueId.LEARNED,
			SM2EngineQueueId.LEARNING,
		])

		if (card && card.type === SM2CardType.NEW) {
			throw new Error("Assertion filed: Card can't be new here")
		}

		if (
			!disallowNew &&
			(!card || card.desiredPresentationTimestamp > now)
		) {
			const poll = await this.queue.peekBack([SM2EngineQueueId.NEW])
			card = poll ?? card
		}

		return card
	}

	getTodaysTopEngineCardData = async (
		now: TimestampMs = this.clock.getNow()
	): Promise<SM2EngineCardData | null> => {
		let card = await this.queue.peekBack([
			SM2EngineQueueId.RELEARNING,
			SM2EngineQueueId.LEARNED,
			SM2EngineQueueId.LEARNING,
		])

		if (card && card.type === SM2CardType.NEW) {
			throw new Error("Assertion filed: Card can't be new here")
		}

		if (
			card &&
			card.type === SM2CardType.LEARNED &&
			this.clock.getDay(card.desiredPresentationTimestamp) >
				this.clock.getDay(now)
		) {
			card = null
		}

		if (!card || card.desiredPresentationTimestamp > now) {
			card = (await this.queue.peekFront([SM2EngineQueueId.NEW])) ?? card
		}

		return card
	}
}
