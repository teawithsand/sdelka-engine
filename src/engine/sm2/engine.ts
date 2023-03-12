import { throwExpression, TimestampMs } from "@teawithsand/tws-stl"
import { Draft, produce } from "immer"
import { CardSource } from "../../storage/source"
import { EngineStorage } from "../../storage/storage"
import { Clock } from "../clock"
import { Engine } from "../engine"

import {
	SM2CardType,
	SM2EngineAnswer,
	SM2EngineCardData,
	SM2EngineConfig,
	SM2EngineSessionData,
	SM2EngineStats,
} from "./defines"
import { SM2EngineQueueElementExtractor as SM2EngineQueueElementExtractor } from "./queues"
import { SM2EngineStorage as SM2EngineCardStorage } from "./storage"
import { SM2EngineCardDataTransition } from "./transition"

export class SM2Engine<T>
	implements Engine<T, SM2EngineAnswer, SM2EngineStats>
{
	private isInitialized = false
	private sessionData: Readonly<SM2EngineSessionData> = {
		lastCardId: null,
		lastTimestampFetched: 0 as TimestampMs,
		lastCardFetchedTimestamp: 0 as TimestampMs,
	}

	constructor(
		private readonly lowLevelStorage: EngineStorage<
			SM2EngineCardData,
			SM2EngineSessionData
		>,
		private readonly source: CardSource<T>,
		private readonly config: SM2EngineConfig,
		private readonly clock: Clock
	) {}

	private readonly transition = new SM2EngineCardDataTransition(this.config)

	public readonly cardStorage: SM2EngineCardStorage =
		new SM2EngineCardStorage(
			this.lowLevelStorage.getQueue(
				"main",
				SM2EngineQueueElementExtractor
			),
			this.clock
		)

	private getNowTimestamp = async (): Promise<TimestampMs> => {
		const ts = this.clock.getNow()
		if (ts < this.sessionData.lastTimestampFetched) {
			throw new Error("Time went backwards; can't operate")
		}

		await this.updateSessionData((draft) => {
			draft.lastTimestampFetched = ts
		})

		return ts
	}

	private updateSessionData = async (
		callback: (draft: Draft<SM2EngineSessionData>) => void
	) => {
		this.sessionData = produce(this.sessionData, callback)
		await this.lowLevelStorage.setSessionData(this.sessionData)
	}

	private initialize = async () => {
		if (this.isInitialized) return

		const sd = await this.lowLevelStorage.getSessionData()
		if (sd) this.sessionData = sd

		this.isInitialized = true
	}

	private getCurrentEngineCardData =
		async (): Promise<SM2EngineCardData | null> => {
			const now = await this.getNowTimestamp()
			const currentCard =
				await this.cardStorage.getTodaysTopEngineCardData(now)
			if (!currentCard) return null

			// This learned card is to-be-shown in future
			if (
				currentCard.type === SM2CardType.LEARNED &&
				this.clock.getDay(currentCard.desiredPresentationTimestamp) >
					this.clock.getDay(now)
			) {
				return null
			}
			return currentCard
		}

	public addNewCards = (count: number) => {}

	public getStats = async (): Promise<SM2EngineStats> => {
		const storageStats = await this.cardStorage.getStorageStats()

		return {
			storageStats,
		}
	}

	public getCurrentCard = async (): Promise<T | null> => {
		return await this.lowLevelStorage.transaction(async () => {
			await this.initialize()

			const currentCard = await this.getCurrentEngineCardData()
			if (!currentCard) return null

			const data =
				(await this.source.getCard(currentCard.id)) ??
				throwExpression(
					new Error(`Card with id ${currentCard.id} was not found`)
				)

			return data
		})
	}

	public answer = async (answer: SM2EngineAnswer): Promise<void> => {
		return await this.lowLevelStorage.transaction(async () => {
			await this.initialize()
			const now = await this.getNowTimestamp()

			const currentCardData = await this.getCurrentEngineCardData()
			if (!currentCardData) throw new Error(`No card available`)
			const newCardData = this.transition.transitionCardData(
				now,
				answer,
				currentCardData
			)
			await this.cardStorage.setEngineCardData(newCardData)
		})
	}
}
