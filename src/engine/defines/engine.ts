import { DailyEntryStats, EngineAnswer, EngineDailyConfig, EngineEntryData, EngineEntryDataType } from "."

export interface EngineCurrentEntryData {
	id: string
	type: EngineEntryDataType
}

export interface Engine {
	getCurrentEntry: () => Promise<EngineCurrentEntryData | null>
	answer: (answer: EngineAnswer) => Promise<void>
	undo: () => Promise<void>

	setEntryData: (id: string, data: EngineEntryData) => Promise<void>
	getEntryData: (id: string) => Promise<EngineEntryData | null>

	refresh: () => Promise<void>
	setDailyConfig: (dailyConfig: EngineDailyConfig) => Promise<void>

	getQueuesStats: () => Promise<DailyEntryStats>
}
