import { SM2Config, SM2DailyConfig } from "./config"

export type SM2GlobalUserState = {
    timestampMs: number
    config: SM2Config
}

export type SM2GlobalInternalState = {
    dailyConfig: SM2DailyConfig
}