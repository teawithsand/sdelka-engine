import { ScopeDB } from "../../db/defines";
import { EngineInitializer } from "../defines";

export class IDBScopeDBEngineInitializer<EG> implements EngineInitializer<EG> {
    constructor(
        private readonly db: ScopeDB<any, EG, any, any>,
        public readonly fallback: EG,
    ) { }

    loadEngineGlobalState = async (): Promise<EG> => {
        return (await this.db.getState()) ?? this.fallback
    }
}