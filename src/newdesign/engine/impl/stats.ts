import { EngineStatsLoader, SM2EngineGlobalState, SM2Statistics, SM2UserGlobalState } from "../defines";

export class SM2EngineStats implements EngineStatsLoader<
    SM2EngineGlobalState,
    SM2UserGlobalState,
    SM2Statistics
>{
    getStatistics = (
        engineGlobalState: SM2EngineGlobalState,
        userGlobalState: SM2UserGlobalState
    ): Promise<SM2Statistics> => {
        throw new Error("NIY")
    }

}