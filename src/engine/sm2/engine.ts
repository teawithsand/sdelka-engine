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
import {
	SM2EngineHistory,
	SM2EngineHistoryDataGroupedQueueElementPropsExtractor as SM2EngineHistoryQueueElementExtractor,
} from "./history"
import { makeNewSM2EngineCardData } from "./innerUtil"
import { SM2EngineQueueElementExtractor as SM2EngineCardQueueElementExtractor } from "./queues"
import { SM2EngineStorage as SM2EngineCardStorage } from "./storage"
import { SM2EngineCardDataTransition } from "./transition"

export class SM2Engine<T>
	implements Engine<T, SM2EngineAnswer, SM2EngineStats>
{
	private isInitialized = false

	constructor(
		private readonly lowLevelStorage: EngineStorage<
			SM2EngineCardData,
			SM2EngineSessionData
		>,
		private readonly source: CardSource<T>,
		private readonly config: SM2EngineConfig,
		private readonly clock: Clock
	) {}

	private sessionData: Readonly<SM2EngineSessionData> = {
		lastCardId: null,
		lastTimestampFetched: 0 as TimestampMs,
		dailyData: {
			maxLearnedReviewCardCount: this.config.maxDailyReviewCardCount,
			learnedReviewedCount: 0,
			dayTimestamp: 0,
			additionalLearnedReviewCount: 0,
		},
	}
	private currentCardData: Readonly<SM2EngineCardData | null> = null

	private readonly transition = new SM2EngineCardDataTransition(this.config)

	private onMaybeNewDay = async () => {
		const now = await this.getNowTimestamp()
		if (
			this.sessionData.dailyData.dayTimestamp !== this.clock.getDay(now)
		) {
			this.currentCardData = null // reset it

			await this.updateSessionData((draft) => {
				draft.dailyData = {
					maxLearnedReviewCardCount:
						this.config.maxDailyReviewCardCount,
					learnedReviewedCount: 0,
					additionalLearnedReviewCount: 0,
					dayTimestamp: this.clock.getDay(now),
				}
			})

			let lastCardId = this.sessionData.lastCardId

			let newCount = (await this.cardStorage.getStorageStats(now))
				.newCount

			while (newCount < this.config.maxNewCardsPerDay) {
				const id = await this.source.getCardNext(lastCardId)
				if (id === null) break
				await this.cardStorage.appendNewCard(id)
				newCount++
			}
		}
	}

	private loadTopCardData = async () => {
		const now = await this.getNowTimestamp()
		const card = await this.cardStorage.getTopEngineCardData(now)
		if (!card) {
			this.currentCardData = null
			return
		}

		if (card.type === SM2CardType.LEARNED) {
			const isDataForToday =
				this.clock.getDay(card.desiredPresentationTimestamp) <=
				this.clock.getDay(now)

			const reachedReviewLimit =
				this.sessionData.dailyData.learnedReviewedCount >=
				this.sessionData.dailyData.maxLearnedReviewCardCount
			if (
				this.sessionData.dailyData.additionalLearnedReviewCount >= 0 &&
				(reachedReviewLimit || !isDataForToday)
			) {
				await this.updateSessionData((draft) => {
					draft.dailyData.additionalLearnedReviewCount--
				})
				// and leave the card
			} else if (!reachedReviewLimit && isDataForToday) {
				await this.updateSessionData((draft) => {
					draft.dailyData.learnedReviewedCount++
				})
				// and leave the card
			} else {
				this.currentCardData = null
				return
			}
		}

		this.currentCardData = card
	}

	public readonly cardStorage: SM2EngineCardStorage =
		new SM2EngineCardStorage(
			this.lowLevelStorage.getQueue(
				"cards",
				SM2EngineCardQueueElementExtractor
			),
			this.clock
		)

	public readonly history: SM2EngineHistory = new SM2EngineHistory(
		this.lowLevelStorage.getQueue(
			"history",
			SM2EngineHistoryQueueElementExtractor
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

		this.sessionData =
			(await this.lowLevelStorage.getSessionData()) ?? this.sessionData
		this.isInitialized = true
	}

	private getOrLoadCurrentCardData =
		async (): Promise<SM2EngineCardData | null> => {
			if (this.currentCardData) return this.currentCardData

			await this.loadTopCardData()
			return this.currentCardData
		}

	public getStats = async (): Promise<SM2EngineStats> => {
		return await this.lowLevelStorage.transaction(async () => {
			await this.initialize()
			await this.onMaybeNewDay()

			const now = await this.getNowTimestamp()
			const storageStats = await this.cardStorage.getStorageStats(now)

			return {
				...storageStats,
				repetitionCount: Math.min(
					this.sessionData.dailyData.maxLearnedReviewCardCount,
					storageStats.todayLearnedCount
				),
			}
		})
	}

	public getCurrentCard = async (): Promise<T | null> => {
		return await this.lowLevelStorage.transaction(async () => {
			await this.initialize()
			await this.onMaybeNewDay()

			const currentCardData = await this.getOrLoadCurrentCardData()
			if (!currentCardData) return null

			const data =
				(await this.source.getCard(currentCardData.id)) ??
				throwExpression(
					new Error(
						`Card with id ${currentCardData.id} was not found`
					)
				)

			return data
		})
	}

	public undo = async (): Promise<void> => {
		return await this.lowLevelStorage.transaction(async () => {
			await this.initialize()
			// await this.onMaybeNewDay() // it's safer not to do new-day checking here
			// although it should still work
			// it may introduce inconsistencies, when card is to be backed from
			// LEARNING/LEARNED to new state.

			const res = await this.history.pop()
			if (!res) return

			// TODO(teawithsand): special treatment for new cards - put them in front of 
			// all the new cards that are here right now?
			//
			// Leaving this as-is is so-so, but will work
			await this.cardStorage.setEngineCardData(res)
		})
	}

	public answer = async (answer: SM2EngineAnswer): Promise<void> => {
		return await this.lowLevelStorage.transaction(async () => {
			await this.initialize()
			await this.onMaybeNewDay()

			const now = await this.getNowTimestamp()

			const currentCardData = await this.getOrLoadCurrentCardData()
			if (!currentCardData) throw new Error(`No current card data`)

			const newCardData = this.transition.transitionCardData(
				now,
				answer,
				currentCardData
			)

			await this.history.push(currentCardData)
			await this.cardStorage.setEngineCardData(newCardData)
			await this.loadTopCardData()
		})
	}
}
