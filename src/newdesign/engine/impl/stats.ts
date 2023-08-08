import { EngineStatsLoader, SM2EngineState, SM2Statistics, SM2UserState } from "../defines";

export class SM2EngineStatsLoader implements EngineStatsLoader<
    SM2EngineState,
    SM2Statistics
>{
    getStatistics = (
        enginesState: SM2EngineState,
    ): Promise<SM2Statistics> => {
        throw new Error("NIY")
    }

}