import { Clock } from "../../engine"
import { TimestampMs } from "../../util/stl"
import {
	EngineAnswer,
	EngineConfig,
	EngineDailyConfig,
	EngineEntryData,
	EngineEntryDataType,
	EngineQueueType,
} from "../defines"
import { EngineStorage } from "../storage"
import { Engine } from "./engine"
import { EngineEntryTransitioner, EngineSessionDataHelper } from "./helper"

enum DataTansitionSource {
	EXTERNAL = 1,
	ANSWER = 2,
	HISTORY = 3,
}

export class EngineImpl implements Engine {
	constructor(
		private readonly storage: EngineStorage,
		private readonly clock: Clock,
		private readonly config: EngineConfig
	) {}

	private readonly sessionDataHelper = new EngineSessionDataHelper(
		this.storage,
		this.clock,
		this.config
	)

	private readonly transition!: EngineEntryTransitioner

	private isCurrentCardCacheValid: boolean = false
	private currentCardCache: string | null = null

	private prologue = async () => {
		const now = this.clock.getNow()
		const doInit = await this.sessionDataHelper.init(now)
		if (doInit) {
			await this.sessionDataHelper.considerSwitchingDay(now)
			await this.invalidateCurrentCardCache(now)
		}

		return { now }
	}

	private invalidateCurrentCardCache = async (
		candidateNow: TimestampMs | null
	): Promise<void> => {
		const now = candidateNow ?? this.clock.getNow()

		const getCandidateId = async () => {
			const shouldPollNew =
				this.sessionDataHelper.dailyData.processedNewCount <
				this.sessionDataHelper.dailyConfig.newCardLimit

			const shouldPollLearned =
				this.sessionDataHelper.dailyConfig.learnedCountLimit === null ||
				this.sessionDataHelper.dailyData.processedLearnedCount <
					this.sessionDataHelper.dailyConfig.learnedCountLimit

			let learnedCandidate = shouldPollLearned
				? await this.storage.getTopEntryOnQueue([
						EngineQueueType.LEARNED,
				  ])
				: null

			let newCandidate = shouldPollNew
				? await this.storage.getTopEntryOnQueue([EngineQueueType.NEW])
				: null

			let processingCandidate = await this.storage.getTopEntryOnQueue([
				EngineQueueType.LEARNING,
				EngineQueueType.RELEARNING,
			])

			const today = this.sessionDataHelper.dailyData.dayTimestamp

			if (
				newCandidate &&
				newCandidate.data.type !== EngineEntryDataType.NEW
			) {
				throw new Error(
					`new card candidate is not in NEW state; assertion filed`
				)
			}

			if (learnedCandidate) {
				if (
					learnedCandidate.data.type !== EngineEntryDataType.LEARNED
				) {
					throw new Error(
						`learnedCandidate is not in LEARNED state; assertion filed`
					)
				}

				const dayDeadline =
					today +
					this.sessionDataHelper.dailyConfig
						.learnedCardDaysFutureAllowed
				if (
					this.clock.getDay(
						learnedCandidate.data.desiredPresentationTimestamp
					) > dayDeadline
				) {
					learnedCandidate = null
				}
			}

			if (processingCandidate) {
				if (
					processingCandidate.data.type !==
						EngineEntryDataType.LEARNING &&
					processingCandidate.data.type !==
						EngineEntryDataType.RELEARNING
				) {
					throw new Error(
						`processingCandidate is neither LEARNING or RELEARNING; assertion filed`
					)
				}

				if (
					processingCandidate.data.desiredPresentationTimestamp < now
				) {
					return processingCandidate.id
				}
			}

			// learned first for now
			// TODO: teaiwthsand - here add random/
			if (learnedCandidate) {
				return learnedCandidate.id
			}

			if (newCandidate) {
				return newCandidate.id
			}

			if (processingCandidate) {
				return processingCandidate.id
			}

			return null
		}

		this.currentCardCache = await getCandidateId()
		this.isCurrentCardCacheValid = true
	}

	private onDataTransition = async (
		_id: string,
		oldData: EngineEntryData,
		newData: EngineEntryData,
		source: DataTansitionSource
	) => {
		const isHistoryOrAnswer =
			source === DataTansitionSource.HISTORY ||
			source === DataTansitionSource.ANSWER

		if (
			oldData.type === EngineEntryDataType.NEW &&
			newData.type !== EngineEntryDataType.NEW &&
			isHistoryOrAnswer
		) {
			await this.sessionDataHelper.updateSessionData((draft) => {
				draft.dailyData.processedNewCount += 1
			})
		}

		if (
			newData.type === EngineEntryDataType.NEW &&
			oldData.type !== EngineEntryDataType.NEW &&
			isHistoryOrAnswer
		) {
			await this.sessionDataHelper.updateSessionData((draft) => {
				draft.dailyData.processedNewCount = Math.max(
					0,
					draft.dailyData.processedNewCount - 1
				)
			})
		}

		if (
			oldData.type === EngineEntryDataType.LEARNED &&
			source === DataTansitionSource.ANSWER
		) {
			await this.sessionDataHelper.updateSessionData((draft) => {
				draft.dailyData.processedLearnedCount += 1
			})
		}

		if (
			newData.type === EngineEntryDataType.LEARNED &&
			source === DataTansitionSource.HISTORY
		) {
			await this.sessionDataHelper.updateSessionData((draft) => {
				draft.dailyData.processedLearnedCount = Math.max(
					0,
					draft.dailyData.processedLearnedCount - 1
				)
			})
		}
	}

	getCurrentCard = async (): Promise<string | null> => {
		const { now } = await this.prologue()

		if (!this.isCurrentCardCacheValid) {
			await this.invalidateCurrentCardCache(now)
		}

		return this.currentCardCache
	}

	answer = async (answer: EngineAnswer): Promise<void> => {
		const { now } = await this.prologue()

		if (!this.isCurrentCardCacheValid) {
			await this.invalidateCurrentCardCache(now)
		}

		const currentCardId = this.currentCardCache

		if (currentCardId === null) {
			throw new Error(`Can't answer if there is no card`)
		}

		await this.storage.transaction(async () => {
			// answering code code goes here

			const oldData = await this.storage.getEngineData(currentCardId)
			if (!oldData) {
				throw new Error(
					`Data was removed while it was presented; there is no card with id ${currentCardId}`
				)
			}

			const newData = await this.transition.transformData(
				now,
				oldData.data,
				answer
			)

			await this.storage.setEngineData(currentCardId, newData)
			await this.storage.pushHistoryEntry(oldData)

			await this.onDataTransition(
				currentCardId,
				oldData.data,
				newData,
				DataTansitionSource.ANSWER
			)

			await this.sessionDataHelper.considerSwitchingDay(now)
			this.isCurrentCardCacheValid = false
		})
	}

	refresh = async (): Promise<void> => {
		const { now } = await this.prologue()

		await this.storage.transaction(async () => {
			await this.sessionDataHelper.considerSwitchingDay(now)
			await this.invalidateCurrentCardCache(now)
		})
	}

	undo = async (): Promise<void> => {
		await this.prologue()

		await this.storage.transaction(async () => {
			for (;;) {
				const historyData = await this.storage.peekHistoryEntry()
				if (!historyData) return

				// If entry was removed for some reason, ignore that one in history
				// although, set shouldn't allow for creating new entry anyway
				const oldData = await this.storage.getEngineData(historyData.id)
				if (!oldData) {
					await this.storage.popHistoryEntry()
					continue
				}

				// this is how undo works under the hood
				// quite rudimentary, it should do though
				await this.storage.setEngineData(
					historyData.id,
					historyData.data
				)
				await this.onDataTransition(
					oldData.id,
					oldData.data,
					historyData.data,
					DataTansitionSource.HISTORY
				)

				await this.storage.popHistoryEntry()
				return
			}
		})

		this.isCurrentCardCacheValid = false
	}

	setDailyConfig = async (dailyConfig: EngineDailyConfig): Promise<void> => {
		await this.prologue()

		await this.sessionDataHelper.updateSessionData((draft) => {
			draft.dailyData.dailyConfig = dailyConfig
		})

		this.isCurrentCardCacheValid = false
	}

	setEntryData = async (id: string, data: EngineEntryData): Promise<void> => {
		await this.prologue()

		await this.storage.transaction(async () => {
			const oldData = await this.storage.getEngineData(id)
			if (!oldData) {
				throw new Error(`Entry with id ${id} does not exist`)
			}

			await this.storage.setEngineData(id, data)
			await this.onDataTransition(
				id,
				oldData.data,
				data,
				DataTansitionSource.EXTERNAL
			)
		})

		this.isCurrentCardCacheValid = false
	}
}
