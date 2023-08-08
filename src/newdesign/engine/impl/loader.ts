import { ScopeDB } from "../../db/defines";
import { IDBScopeDBQuery, IDBScopeDBWrite } from "../../db/impl";
import { EngineCard, EngineCardLoader, SM2CardState, SM2EngineGlobalState, SM2UserGlobalState } from "../defines";

export class SM2IDBScopeDBEngineCardLoader<CD> implements EngineCardLoader<
    SM2EngineGlobalState,
    SM2UserGlobalState,
    SM2CardState,
    CD
> {
    constructor(
        private readonly db: ScopeDB<
            EngineCard<SM2CardState, CD>,
            SM2EngineGlobalState,
            IDBScopeDBWrite<EngineCard<SM2CardState, CD>, SM2EngineGlobalState>,
            IDBScopeDBQuery
        >,
    ) { }

    loadCardState = async (
        engineGlobalState: SM2EngineGlobalState,
        userGlobalState: SM2UserGlobalState,
    ): Promise<EngineCard<SM2CardState, CD> | null> => {
        return null
    }
}