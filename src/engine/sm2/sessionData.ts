import produce, { Draft } from "immer"
import { TimestampMs } from "../../util/stl"
import { NDTSC_BASE, SyncData } from "../../util/sync"
import {
	SM2EngineCardData,
	SM2EngineConfig,
	SM2EngineDailyConfig,
	SM2EngineDailyDailyData,
	SM2EngineSessionData,
} from "./defines"
import { EngineStorage } from "../../storage"
import { Clock } from "../clock"

export class SM2EngineSessionDataHelper {
	private isInitialized = false

	constructor(
		private innerConfig: SM2EngineConfig,
		private readonly lowLevelStorage: EngineStorage<
			SM2EngineCardData,
			SM2EngineSessionData
		>,
		public readonly clock: Clock
	) {}

	private innerSessionData: Readonly<SM2EngineSessionData> = {
		lastTimestampFetched: 0 as TimestampMs,
		dailyData: {
			// TODO(teawithsand): store only delta here, so if config changes it's ok
			dayTimestamp: NaN,

			dailyConfig: this.innerConfig.initialDailyConfig,

			processedLearnedCount: 0,
			processedNewCardsCount: 0,
		},
		cardDataNdtsc: NDTSC_BASE,
		cardInsertNdtsc: NDTSC_BASE,
	}

	get config(): Readonly<SM2EngineConfig> {
		if (!this.isInitialized) throw new Error("Not initialized yet")

		return this.innerConfig
	}

	get sessionData(): Readonly<SM2EngineSessionData> {
		if (!this.isInitialized) throw new Error("Not initialized yet")

		return this.innerSessionData
	}

	get dailyData(): Readonly<SM2EngineDailyDailyData> {
		return this.sessionData.dailyData
	}

	get dailyConfig(): Readonly<SM2EngineDailyConfig> {
		return this.sessionData.dailyData.dailyConfig
	}

	initialize = async () => {
		if (this.isInitialized) return

		this.innerSessionData =
			(await this.lowLevelStorage.getSessionData()) ??
			this.innerSessionData

		this.isInitialized = true
	}

	updateSessionData = async (
		callback: (draft: Draft<SM2EngineSessionData>) => void
	) => {
		if (!this.isInitialized)
			throw new Error("Not initialized yet; can't update")

		this.innerSessionData = produce(this.innerSessionData, callback)
		Object.freeze(this.innerSessionData)
		await this.lowLevelStorage.setSessionData(this.innerSessionData)
	}

	updateConfig = async (config: SM2EngineConfig) => {
		this.innerConfig = config
	}

	// Derived value setters/getters below

	get shouldPollNewCardIfAvailable(): boolean {
		return (
			this.sessionData.dailyData.processedNewCardsCount <
			this.newCardLimit
		)
	}

	get shouldPollLearnedCardIfAvailable(): boolean {
		const limit = this.learnedCardLimit
		if (limit === null) return true

		return this.sessionData.dailyData.processedLearnedCount < limit
	}

	get newCardLimit(): number {
		return Math.max(
			0,
			this.config.maxNewCardsPerDay +
				this.dailyConfig.additionalNewCardsToProcess
		)
	}

	get learnedCardLimit(): number | null {
		const override =
			this.sessionData.dailyData.dailyConfig.learnedCountOverride

		if (override.limitIsRelative) {
			if (this.config.maxLearnedReviewsPerDay === null) {
				return override.limit
			} else if (override.limit === null) {
				return this.config.maxLearnedReviewsPerDay
			} else {
				return this.config.maxLearnedReviewsPerDay + override.limit
			}
		} else {
			return override.limit
		}
	}

	get learnedCardsDaysFutureAllowed(): number {
		return this.dailyConfig.learnedCardDaysFutureAllowed
	}

	/**
	 * This call is exposed manually to outside world, since it should in general be called once during initialization.
	 *
	 * For testing though it's useful to have it.
	 */
	checkIfAlreadyTomorrow = async () => {
		const now = await this.getNowTimestamp()
		if (
			this.sessionData.dailyData.dayTimestamp !== this.clock.getDay(now)
		) {
			await this.resetDay()
		}
	}

	resetDay = async () => {
		const now = await this.getNowTimestamp()

		await this.updateSessionData((draft) => {
			draft.dailyData = {
				dayTimestamp: this.clock.getDay(now),

				dailyConfig: this.config.initialDailyConfig,

				processedLearnedCount: 0,
				processedNewCardsCount: 0,
			}
		})
	}

	getNewCardCount = (leftNewCards: number) => {
		return Math.max(
			0,
			Math.min(this.newCardLimit, leftNewCards) -
				this.sessionData.dailyData.processedNewCardsCount
		)
	}

	getLearnedCardCount = (leftLearnedCardsWithDaysForwardAllowed: number) => {
		return Math.min(
			this.learnedCardLimit ?? Infinity,
			leftLearnedCardsWithDaysForwardAllowed
		)
	}

	getNowTimestamp = async (): Promise<TimestampMs> => {
		const ts = this.clock.getNow()
		if (ts < this.sessionData.lastTimestampFetched) {
			throw new Error("Time went backwards; can't operate")
		}

		await this.updateSessionData((draft) => {
			draft.lastTimestampFetched = ts
		})

		return ts
	}

	makeCardDataSyncData = async (now?: TimestampMs): Promise<SyncData> => {
		const res: SyncData = {
			ndtsc: this.sessionData.cardDataNdtsc,
			timestamp: now ?? (await this.getNowTimestamp()),
		}
		await this.updateSessionData((draft) => {
			draft.cardDataNdtsc += 1
		})

		return res
	}
}
