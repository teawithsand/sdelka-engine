import { EngineStorage } from "../storage/storage"
import { Clock } from "../clock"
import {
	CardDataBasedEngineManagement,
	CardEngineManagement,
	RuntimeConfigurableEngine,
	Engine,
} from "../engine"

import { Cursor } from "../../pubutil"
import { SyncRequest } from "../../util/sync"
import {
	SM2CardType,
	SM2EngineAnswer,
	SM2EngineCardData,
	SM2EngineConfig,
	SM2EngineDailyConfig,
	SM2EngineSessionData,
	SM2EngineStats,
} from "./defines"
import {
	SM2EngineHistory,
	SM2EngineHistoryDataGroupedQueueElementPropsExtractor as SM2EngineHistoryQueueElementExtractor,
} from "./history"
import { SM2EngineQueueElementExtractor as SM2EngineCardQueueElementExtractor } from "./queues"
import { SM2EngineSessionDataHelper } from "./sessionData"
import { SM2EngineStorage as SM2EngineCardStorage } from "./storage"
import { SM2EngineCardDataTransition } from "./transition"
import { WritableDraft } from "immer/dist/internal"
import produce from "immer"

enum CardDataChangeSource {
	ANSWER = 1,
	UNDO = 2,
	EXTERNAL = 3,
}

export class SM2Engine
	implements
		Engine<string, SM2EngineAnswer, SM2EngineStats>,
		CardDataBasedEngineManagement<SM2EngineCardData>,
		CardEngineManagement,
		RuntimeConfigurableEngine<SM2EngineDailyConfig>
{
	private readonly sessionDataHelper: SM2EngineSessionDataHelper
	constructor(
		private readonly lowLevelStorage: EngineStorage<
			SM2EngineCardData,
			SM2EngineSessionData
		>,
		private readonly config: SM2EngineConfig,
		private readonly clock: Clock
	) {
		this.sessionDataHelper = new SM2EngineSessionDataHelper(
			config,
			lowLevelStorage,
			clock
		)
	}

	private readonly transition = new SM2EngineCardDataTransition(this.config)

	private loadCurrentCardData =
		async (): Promise<SM2EngineCardData | null> => {
			const now = await this.sessionDataHelper.getNowTimestamp()

			const card = await this.cardStorage.getTopEngineCardData(
				now,
				!this.sessionDataHelper.shouldPollNewCardIfAvailable
			)
			if (!card) {
				return null
			}

			if (card.type === SM2CardType.LEARNED) {
				const isDataForTodayOrFutureDaysAllowed =
					this.clock.getDay(card.desiredPresentationTimestamp) <=
					this.clock.getDay(now) +
						this.sessionDataHelper.learnedCardsDaysFutureAllowed

				if (
					!this.sessionDataHelper.shouldPollLearnedCardIfAvailable ||
					!isDataForTodayOrFutureDaysAllowed
				) {
					return null
				}
			}

			return card
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

	private initialize = async () => {
		await this.sessionDataHelper.initialize()
	}

	private onMaybeNewDay = async () => {
		await this.sessionDataHelper.checkIfAlreadyTomorrow()
	}

	/**
	 * Handles any transition between states of any card
	 *
	 * @param from null when card was just created
	 * @param to null when card was deleted
	 */
	private onCardDataChange = async (
		from: SM2EngineCardData | null,
		to: SM2EngineCardData | null,
		src: CardDataChangeSource
	) => {
		if (!from || !to) return

		if (src === CardDataChangeSource.UNDO) {
			if (to.type === SM2CardType.NEW && from.type !== SM2CardType.NEW) {
				await this.sessionDataHelper.updateSessionData((draft) => {
					// this has to be done, so we make sure that we just didn't remove
					// some new card, which was scheduled for today

					// max here for safety in case we've just done inter-day card reversal
					draft.dailyData.processedNewCardsCount = Math.max(
						0,
						draft.dailyData.processedNewCardsCount - 1
					)
				})
			}

			if (
				from.type === SM2CardType.LEARNED &&
				to.type !== SM2CardType.LEARNED
			) {
				await this.sessionDataHelper.updateSessionData((draft) => {
					draft.dailyData.processedLearnedCount = Math.max(
						0,
						draft.dailyData.processedLearnedCount - 1
					)
				})
			}
		} else if (src === CardDataChangeSource.ANSWER) {
			if (to.type === SM2CardType.LEARNED) {
				// it's fine for learned to change to learned. Such card is considered processed as well.
				await this.sessionDataHelper.updateSessionData((draft) => {
					draft.dailyData.processedLearnedCount += 1
				})
			}

			if (from.type === SM2CardType.NEW && to.type !== SM2CardType.NEW) {
				await this.sessionDataHelper.updateSessionData((draft) => {
					draft.dailyData.processedNewCardsCount += 1
				})
			}
		}
	}

	private setEngineCardDataWithTransitionTracking = async (
		newData: SM2EngineCardData,
		src: CardDataChangeSource
	) => {
		const prevData = await this.cardStorage.getEngineCardData(newData.id)
		await this.onCardDataChange(prevData, newData, src)
		await this.cardStorage.setEngineCardData(newData)
	}

	private getOrLoadCurrentCardData = this.loadCurrentCardData

	public getStats = async (): Promise<SM2EngineStats> => {
		return await this.lowLevelStorage.transaction(async () => {
			await this.initialize()
			await this.onMaybeNewDay()

			const now = await this.sessionDataHelper.getNowTimestamp()
			// TODO(teawithsand): refactor this call, so it supports better stats by design not using this clock hacking
			const storageStats = await this.cardStorage.getStorageStats(
				this.clock.getDay(now) +
					this.sessionDataHelper.learnedCardsDaysFutureAllowed
			)

			return {
				...storageStats,
				repetitionCount: this.sessionDataHelper.getLearnedCardCount(
					storageStats.learnedCount
				),
				newCount: this.sessionDataHelper.getNewCardCount(
					storageStats.newCount
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

			const now = await this.sessionDataHelper.getNowTimestamp()

			const currentCardData = await this.getOrLoadCurrentCardData()
			if (!currentCardData) {
				throw new Error(`No current card data; Can't answer`)
			}

			const newCardData = this.transition.transitionCardData(
				now,
				answer,
				currentCardData
			)

			newCardData.syncData =
				await this.sessionDataHelper.makeCardDataSyncData()

			await this.history.push(currentCardData)
			await this.setEngineCardDataWithTransitionTracking(
				newCardData,
				CardDataChangeSource.ANSWER
			)
			await this.loadCurrentCardData()
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

			// TODO(teawithsand): update popped value's sync data here
			await this.setEngineCardDataWithTransitionTracking(
				res,
				CardDataChangeSource.UNDO
			)
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

			if (data.id !== id)
				throw new Error(`Data id does not match id provided`)

			await this.setEngineCardDataWithTransitionTracking(
				data,
				CardDataChangeSource.EXTERNAL
			)
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

			// TODO(teawithsand): throw if id already in use

			const syncData = await this.sessionDataHelper.makeCardDataSyncData()

			await this.cardStorage.appendNewCard({
				type: SM2CardType.NEW,
				id,
				syncData,
				userPriorityOffset: priority ?? 0,
				ndtscOffset: this.sessionDataHelper.sessionData.cardInsertNdtsc,
			})

			await this.sessionDataHelper.updateSessionData((draft) => {
				draft.cardInsertNdtsc += 1
			})
		})
	}

	public deleteCard = async (id: string): Promise<void> => {
		return await this.lowLevelStorage.transaction(async () => {
			await this.initialize()
			await this.cardStorage.deleteEngineCardData(id)
		})
	}

	public setRuntimeConfig = async (
		config: SM2EngineDailyConfig
	): Promise<void> => {
		await this.initialize()

		await this.sessionDataHelper.updateSessionData((draft) => {
			draft.dailyData.dailyConfig = config
		})
	}

	public updateRuntimeConfig = async (
		cb: (draft: WritableDraft<SM2EngineDailyConfig>) => void
	): Promise<void> => {
		await this.initialize()

		await this.sessionDataHelper.updateSessionData((draft) => {
			draft.dailyData.dailyConfig = produce(
				draft.dailyData.dailyConfig,
				cb
			)
		})
	}

	public getRuntimeConfig = (): Readonly<SM2EngineDailyConfig> =>
		this.sessionDataHelper.dailyConfig
}
