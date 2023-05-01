import { Draft, produce } from "immer"
import { CardSource, CardSourceCursor } from "../../storage/source"
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
import { SM2EngineQueueElementExtractor as SM2EngineCardQueueElementExtractor } from "./queues"
import { SM2EngineStorage as SM2EngineCardStorage } from "./storage"
import { SM2EngineCardDataTransition } from "./transition"
import { TimestampMs, throwExpression } from "../../util/stl"

export class SM2Engine<D extends { id: string }>
	implements Engine<string, SM2EngineAnswer, SM2EngineStats>
{
	private isInitialized = false

	constructor(
		private readonly lowLevelStorage: EngineStorage<
			SM2EngineCardData,
			SM2EngineSessionData
		>,
		private readonly source: CardSource<D>,
		private readonly config: SM2EngineConfig,
		private readonly clock: Clock
	) {}

	private sessionData: Readonly<SM2EngineSessionData> = {
		serializedCursor: null,
		polledCardCount: 0,
		lastTimestampFetched: 0 as TimestampMs,
		dailyData: {
			maxLearnedReviewCardCount: this.config.maxLearnedReviewsPerDay,
			learnedReviewedCount: 0,
			dayTimestamp: NaN,
			additionalLearnedReviewCount: 0,
		},
		hiddenNewCardsCount: 0,
	}
	private currentCardData: Readonly<SM2EngineCardData | null> = null
	private currentCursor: CardSourceCursor | null = null

	private readonly transition = new SM2EngineCardDataTransition(this.config)

	private appendNewCards = async (count: number) => {
		this.currentCardData = null
		let lastCardId = this.sessionData.serializedCursor

		if (this.sessionData.hiddenNewCardsCount > 0) {
			const newHiddenCardsCount = Math.max(
				0,
				this.sessionData.hiddenNewCardsCount - count
			)
			const newCount = count - this.sessionData.hiddenNewCardsCount

			await this.updateSessionData((draft) => {
				draft.hiddenNewCardsCount = newHiddenCardsCount
			})

			if (newCount <= 0) return this.sessionData.hiddenNewCardsCount
			count = newCount
		}

		const cursor = await this.getOrLoadCursor()

		let i = 0
		for (;;) {
			if(i >= count) break

			const id = cursor.currentId
			if (id !== null) {
				i++
				if (id === null) break
				lastCardId = id
				await this.cardStorage.appendNewCard(
					id,
					// subtract 2**31 here in order to stay SMI for as long as possible
					// both in JS engine and in idb encoding(though I am not sure about 2nd one)
					this.sessionData.polledCardCount + i - 2 ** 31
				)
			}

			const goneToNext = await cursor.next()
			if (!goneToNext) {
				break
			}
		}

		await this.updateSessionData((draft) => {
			draft.serializedCursor = lastCardId
			draft.polledCardCount += i
		})

		return i
	}

	private discardNewCards = async (count: number) => {
		this.currentCardData = null
		const newCardCount = await this.cardStorage.getNewCardCount()

		await this.updateSessionData((draft) => {
			draft.hiddenNewCardsCount = Math.min(
				newCardCount,
				count + draft.hiddenNewCardsCount
			)
		})
	}

	private onMaybeNewDay = async () => {
		const now = await this.getNowTimestamp()
		if (
			this.sessionData.dailyData.dayTimestamp !== this.clock.getDay(now)
		) {
			this.currentCardData = null // reset it

			await this.updateSessionData((draft) => {
				draft.dailyData = {
					maxLearnedReviewCardCount:
						this.config.maxLearnedReviewsPerDay,
					learnedReviewedCount: 0,
					additionalLearnedReviewCount: 0,
					dayTimestamp: this.clock.getDay(now),
				}
			})

			const newCount = await this.cardStorage.getNewCardCount()

			await this.appendNewCards(
				Math.max(0, this.config.maxNewCardsPerDay - newCount)
			)
		}
	}

	private loadCurrentCard = async () => {
		const now = await this.getNowTimestamp()
		const newCardCount = await this.cardStorage.getNewCardCount()

		const card = await this.cardStorage.getTopEngineCardData(
			now,
			newCardCount <= this.sessionData.hiddenNewCardsCount
		)
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
				this.sessionData.dailyData.additionalLearnedReviewCount > 0 &&
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
		Object.freeze(this.sessionData)
		await this.lowLevelStorage.setSessionData(this.sessionData)
	}

	private getOrLoadCursor = async () => {
		if (!this.currentCursor) {
			if (this.sessionData.serializedCursor) {
				this.currentCursor = this.source.deserializeCursor(
					this.sessionData.serializedCursor
				)
				await this.currentCursor.refresh()
			} else {
				this.currentCursor = this.source.newCursor()
			}
		}

		return this.currentCursor
	}

	private initialize = async () => {
		if (this.isInitialized) return

		this.sessionData =
			(await this.lowLevelStorage.getSessionData()) ?? this.sessionData

		await this.getOrLoadCursor()

		this.isInitialized = true
	}

	private getOrLoadCurrentCardData =
		async (): Promise<SM2EngineCardData | null> => {
			if (this.currentCardData) return this.currentCardData

			await this.loadCurrentCard()
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
				newCount: Math.max(
					0,
					storageStats.newCount - this.sessionData.hiddenNewCardsCount
				),
			}
		})
	}

	public getCurrentCardData = async (): Promise<SM2EngineCardData | null> => {
		return await this.lowLevelStorage.transaction(async () => {
			await this.initialize()
			await this.onMaybeNewDay()

			return await this.getOrLoadCurrentCardData()
		})
	}

	public getCurrentCard = async (): Promise<string | null> => {
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

			return data?.id ?? null
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
			await this.loadCurrentCard()
		})
	}

	public undo = async (): Promise<void> => {
		return await this.lowLevelStorage.transaction(async () => {
			await this.initialize()
			// await this.onMaybeNewDay() // it's safer not to do new-day checking here
			// although it should still work
			// it may introduce inconsistencies, when card is to be backed from
			// LEARNING/LEARNED to new state.

			this.currentCardData = null

			const res = await this.history.pop()
			if (!res) return

			// Right now this undone card should be always at the first place in new queue
			// since it must have lower total-index, as it was already processed from new to some other state,
			// so any card that comes after it must have been processed already.
			await this.cardStorage.setEngineCardData(res)
		})
	}

	public addOrRemoveNewCards = async (n: number): Promise<void> => {
		if (!isFinite(n) || Math.round(n) !== n)
			throw new Error(`Invalid n=${n} provided`)
		if (n === 0) return

		return await this.lowLevelStorage.transaction(async () => {
			await this.initialize()
			await this.onMaybeNewDay()

			if (n > 0) {
				await this.appendNewCards(Math.abs(n))
			} else {
				await this.discardNewCards(Math.abs(n))
			}
		})
	}
}
