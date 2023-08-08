import { ScopeDB } from "../../db/defines";
import { EngineInitializer } from "../defines";

export class IDBScopeDBEngineInitializer<EP> implements EngineInitializer<EP> {
    constructor(
        private readonly db: ScopeDB<any, EP, any, any>,
        public readonly fallback: EP,
    ) { }

    loadEngineGlobalState = async (): Promise<EP> => {
        return (await this.db.getState()) ?? this.fallback
    }
}