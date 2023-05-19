import produce, { Draft } from "immer"
import { Clock } from "../../../pubutil"
import { TimestampMs, throwExpression } from "../../../util/stl"
import { EngineConfig, EngineSessionData } from "../../defines"
import { EngineStorage } from "../../storage"

export class EngineSessionDataHelper {
	constructor(
		private readonly storage: EngineStorage,
		private readonly clock: Clock,
		public readonly config: EngineConfig
	) {}

	private isInitialized = false
	private cachedSessionData: EngineSessionData | null = null

	/**
	 * @returns True, if called for the first time. False otherwise.
	 */
	public init = async (now: TimestampMs): Promise<boolean> => {
		if (!this.isInitialized) {
			this.cachedSessionData = await this.storage.getSessionData()
			if (!this.cachedSessionData) {
				this.cachedSessionData = {
					lastTimestampFetched: null,
					dailyData: {
						dayTimestamp: this.clock.getDay(now),
						dailyConfig: this.config.initialDailyConfig,
						processedLearnedCount: 0,
						processedNewCount: 0,
					},
				}
			}
			this.isInitialized = true

			return true
		}

		return false
	}

	private getData = () => {
		return (
			this.cachedSessionData ??
			throwExpression(new Error(`Data not loaded yet; call init first`))
		)
	}

	get sessionData() {
		return this.getData()
	}

	get dailyData() {
		return this.sessionData.dailyData
	}

	get dailyConfig() {
		return this.sessionData.dailyData.dailyConfig
	}

	public initializeDailyData = async (now: TimestampMs) => {
		await this.updateSessionData((draft) => {
			draft.dailyData = {
				dailyConfig: this.config.initialDailyConfig,
				dayTimestamp: this.clock.getDay(now),
				processedLearnedCount: 0,
				processedNewCount: 0,
			}
		})
	}

	public considerSwitchingDay = async (
		now: TimestampMs
	): Promise<boolean> => {
		const switched =
			this.sessionData.dailyData.dayTimestamp !== this.clock.getDay(now)
		if (switched) {
			await this.initializeDailyData(now)
		}

		return switched
	}

	public updateSessionData = async (
		callback: (draft: Draft<EngineSessionData>) => void
	) => {
		const newData = produce(this.getData(), callback)
		await this.storage.setSessionData(newData)
		this.cachedSessionData = newData
	}
}
