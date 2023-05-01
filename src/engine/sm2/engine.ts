import { Draft, produce } from "immer"
import { EngineStorage } from "../../storage/storage"
import { Clock } from "../clock"
import {
	CardDataBasedEngineManagement,
	CardEngineManagement,
	Engine,
} from "../engine"

import { Cursor } from "../../pubutil"
import { TimestampMs } from "../../util/stl"
import { NDTSC_BASE, SyncData, SyncRequest } from "../../util/sync"
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

export class SM2Engine
	implements
		Engine<string, SM2EngineAnswer, SM2EngineStats>,
		CardDataBasedEngineManagement<SM2EngineCardData>,
		CardEngineManagement
{
	private isInitialized = false

	constructor(
		private readonly lowLevelStorage: EngineStorage<
			SM2EngineCardData,
			SM2EngineSessionData
		>,
		private readonly config: SM2EngineConfig,
		private readonly clock: Clock
	) {}

	private sessionData: Readonly<SM2EngineSessionData> = {
		lastTimestampFetched: 0 as TimestampMs,
		dailyData: {
			maxLearnedReviewCardCount: this.config.maxLearnedReviewsPerDay,
			learnedReviewedCount: 0,
			dayTimestamp: NaN,
			additionalLearnedReviewCount: 0,
			processedNewCardsCount: 0,
			additionalNewCardsToProcess: 0,
		},
		cardDataNdtsc: NDTSC_BASE,
		cardInsertNdtsc: NDTSC_BASE,
	}

	private currentCardData: Readonly<SM2EngineCardData | null> = null
	private readonly transition = new SM2EngineCardDataTransition(this.config)

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

	private makeCardDataSyncData = async (
		now?: TimestampMs
	): Promise<SyncData> => {
		const res: SyncData = {
			ndtsc: this.sessionData.cardDataNdtsc,
			timestamp: now ?? (await this.getNowTimestamp()),
		}
		await this.updateSessionData((draft) => {
			draft.cardDataNdtsc += 1
		})

		return res
	}

	private getDesiredNewCardCountToProcess = () => {
		return (
			this.config.maxNewCardsPerDay +
			this.sessionData.dailyData.additionalNewCardsToProcess
		)
	}

	private setAdditionalNewCards = async (count: number) => {
		if (!isFinite(count) || Math.round(count) !== count)
			throw new Error(`Invalid count ${count} provided to setNewCards`)

		const leftNewCardCount = await this.cardStorage.getNewCardCount()

		await this.updateSessionData((draft) => {
			draft.dailyData.additionalNewCardsToProcess = Math.min(
				Math.max(0, leftNewCardCount - this.config.maxNewCardsPerDay),
				Math.max(-this.config.maxNewCardsPerDay, count)
			)
		})
	}

	private addAdditionalNewCards = async (count: number) => {
		if (count < 0 || !isFinite(count) || Math.round(count) !== count)
			throw new Error(`Invalid count ${count} provided to appendNewCards`)

		await this.setAdditionalNewCards(
			this.sessionData.dailyData.additionalNewCardsToProcess + count
		)
	}

	private removeAdditionalNewCards = async (count: number) => {
		if (count < 0 || !isFinite(count) || Math.round(count) !== count)
			throw new Error(`Invalid count ${count} provided to appendNewCards`)

		await this.setAdditionalNewCards(
			this.sessionData.dailyData.additionalNewCardsToProcess - count
		)
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
					additionalNewCardsToProcess: 0,
					processedNewCardsCount: 0,
				}
			})
		}
	}

	private loadCurrentCard = async (): Promise<void> => {
		const now = await this.getNowTimestamp()

		const card = await this.cardStorage.getTopEngineCardData(
			now,
			!(
				this.sessionData.dailyData.processedNewCardsCount <
				this.getDesiredNewCardCountToProcess()
			)
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

	private updateSessionData = async (
		callback: (draft: Draft<SM2EngineSessionData>) => void
	) => {
		this.sessionData = produce(this.sessionData, callback)
		Object.freeze(this.sessionData)
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
				newCount: Math.min(
					storageStats.newCount,
					Math.max(
						0,
						this.getDesiredNewCardCountToProcess() -
							this.sessionData.dailyData.processedNewCardsCount
					)
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
			return currentCardData.id
		})
	}

	public answer = async (answer: SM2EngineAnswer): Promise<void> => {
		return await this.lowLevelStorage.transaction(async () => {
			await this.initialize()
			await this.onMaybeNewDay()

			const now = await this.getNowTimestamp()

			const currentCardData = await this.getOrLoadCurrentCardData()
			if (!currentCardData)
				throw new Error(`No current card data; Can't answer`)

			const newCardData = this.transition.transitionCardData(
				now,
				answer,
				currentCardData
			)

			newCardData.syncData = await this.makeCardDataSyncData()

			if (
				currentCardData.type === SM2CardType.NEW &&
				newCardData.type !== SM2CardType.NEW
			) {
				// we just got rid of one new card
				await this.updateSessionData((draft) => {
					draft.dailyData.processedNewCardsCount += 1
				})
			}

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

			// invalidate cached currentCardData
			this.currentCardData = null

			const res = await this.history.pop()
			if (!res) return

			// Right now this undone card should be always at the first place in new queue
			// since it must have lower total-index, as it was already processed from new to some other state,
			// so any card that comes after it must have been processed already.

			// this is sufficient, since we can't reverse from now to sth else
			// as transition from X to new is impossible
			if (res.type === SM2CardType.NEW) {
				await this.updateSessionData((draft) => {
					// this has to be done, so we make sure that we just didn't remove
					// some new card, which was scheduled for today

					// max here for safety in case we've just done inter-day card reversal
					draft.dailyData.processedNewCardsCount = Math.max(
						0,
						draft.dailyData.processedNewCardsCount - 1
					)
				})
			}

			// TODO(teawithsand): update popped value's sync data here
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
				await this.addAdditionalNewCards(Math.abs(n))
			} else {
				await this.removeAdditionalNewCards(Math.abs(n))
			}
		})
	}

	public getEngineCardData = async (
		id: string
	): Promise<SM2EngineCardData | null> => {
		return await this.lowLevelStorage.transaction(async () => {
			await this.initialize()

			return await this.cardStorage.getEngineCardData(id)
		})
	}

	public setEngineCardData = async (
		id: string,
		data: SM2EngineCardData
	): Promise<void> => {
		return await this.lowLevelStorage.transaction(async () => {
			await this.initialize()

			this.currentCardData = null

			if (data.id !== id)
				throw new Error(`Data id does not match id provided`)

			return await this.cardStorage.setEngineCardData(data)
		})
	}

	public hasEngineCardData = async (id: string): Promise<boolean> => {
		return await this.lowLevelStorage.transaction(async () => {
			await this.initialize()

			return (await this.cardStorage.getEngineCardData(id)) !== null
		})
	}

	public getEngineCardDataForSyncRequest = (
		req: SyncRequest
	): Cursor<SM2EngineCardData> => {
		throw new Error(`NIY`)
	}

	public hasCard = async (id: string): Promise<boolean> => {
		return await this.lowLevelStorage.transaction(async () => {
			await this.initialize()

			return (await this.cardStorage.getEngineCardData(id)) !== null
		})
	}

	public addCard = async (
		id: string,
		priority?: number | undefined
	): Promise<void> => {
		return await this.lowLevelStorage.transaction(async () => {
			await this.initialize()

			const syncData = await this.makeCardDataSyncData()
			this.currentCardData = null

			await this.cardStorage.appendNewCard({
				type: SM2CardType.NEW,
				id,
				syncData,
				userPriorityOffset: priority ?? 0,
				ndtscOffset: this.sessionData.cardInsertNdtsc,
			})

			await this.updateSessionData((draft) => {
				draft.cardInsertNdtsc += 1
			})
		})
	}

	public deleteCard = async (id: string): Promise<void> => {
		return await this.lowLevelStorage.transaction(async () => {
			this.currentCardData = null

			await this.initialize()
			await this.cardStorage.deleteEngineCardData(id)
		})
	}
}
