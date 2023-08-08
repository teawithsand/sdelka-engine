import { ScopeDB } from "../../db/defines";
import { IDBScopeDBQuery, IDBScopeDBWrite, IDBScopeDBWriteType } from "../../db/impl";
import { CardStateTransitionResult, EngineCard, EngineSaver } from "../defines";

/**
 * EngineSaver designed to work with IDBScopeDB.
 */
export class IDBScopeDBEngineSaver<EP, CS, CD> implements EngineSaver<EP, CS, CD> {
    constructor(
        private readonly db: ScopeDB<
            EngineCard<CS, CD>,
            EP,
            IDBScopeDBWrite<EngineCard<CS, CD>, EP>,
            IDBScopeDBQuery
        >,
    ) { }

    saveEngineStateTransition = async (eg: EP) => {
        await this.db.write([{
            type: IDBScopeDBWriteType.STATE,
            state: eg,
        }])
    }

    saveStateCardTransitionResult = async (
        originalCard: EngineCard<CS, CD>,
        transitionResult: CardStateTransitionResult<EP, CS>
    ) => {
        await this.db.write([
            {
                type: IDBScopeDBWriteType.CARD_DATA_AND_STATE,
                cardData: {
                    data: originalCard.data,
                    state: transitionResult.cardState,
                },
                state: transitionResult.engineState,
            }
        ])
    }

    undo = async () => {
        await this.db.write([{
            type: IDBScopeDBWriteType.UNDO,
        }])
    }
}