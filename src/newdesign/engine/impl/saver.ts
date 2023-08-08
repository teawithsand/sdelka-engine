import { ScopeDB } from "../../db/defines";
import { IDBScopeDBQuery, IDBScopeDBWrite, IDBScopeDBWriteType } from "../../db/impl";
import { CardStateTransitionResult, EngineCard, EngineSaver } from "../defines";

/**
 * EngineSaver designed to work with IDBScopeDB.
 */
export class IDBScopeDBEngineSaver<EG, CS, CD> implements EngineSaver<EG, CS, CD> {
    constructor(
        private readonly db: ScopeDB<
            EngineCard<CS, CD>,
            EG,
            IDBScopeDBWrite<EngineCard<CS, CD>, EG>,
            IDBScopeDBQuery
        >,
    ) { }

    saveEngineStateTransition = async (eg: EG) => {
        await this.db.write([{
            type: IDBScopeDBWriteType.STATE,
            state: eg,
        }])
    }

    saveStateCardTransitionResult = async (
        originalCard: EngineCard<CS, CD>,
        transitionResult: CardStateTransitionResult<EG, CS>
    ) => {
        await this.db.write([
            {
                type: IDBScopeDBWriteType.CARD_DATA_AND_STATE,
                cardData: {
                    data: originalCard.data,
                    state: transitionResult.cardState,
                },
                state: transitionResult.engineGlobalState,
            }
        ])
    }

    undo = async () => {
        await this.db.write([{
            type: IDBScopeDBWriteType.UNDO,
        }])
    }
}