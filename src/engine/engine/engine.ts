import { EngineAnswer, EngineConfig, EngineDailyConfig, EngineEntryData } from "../defines"

export interface Engine {
	getCurrentCard: () => Promise<string | null>
	answer: (answer: EngineAnswer) => Promise<void>
	undo: () => Promise<void>

	setEntryData: (id: string, data: EngineEntryData) => Promise<void>
	refresh: () => Promise<void>
    setDailyConfig: (dailyConfig: EngineDailyConfig) => Promise<void>
}
