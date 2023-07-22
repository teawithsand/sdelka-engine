import { EngineCard } from "./card"
import { EngineCardLoader, EngineInitializer, EngineSaver, EngineStateTransition, EngineStats } from "./components"

/**
 * Handle, which represents card selected by card loader with possibility of giving an answer
 * to that query.
 */
export interface EngineCardHandle<UA, CS, CD> {
    readonly isClosed: boolean
    readonly card: EngineCard<CS, CD>

    answerAndSave: (userAnswer: UA) => Promise<void>
}

/**
 * End-user interface for whatever engine is used.
 */
export interface Engine<UG, UA, CD, CS, MSG, ST> {
    getCard: (userGlobalState: UG) => Promise<EngineCardHandle<UA, CS, CD> | null>
    passMessage: (userGlobalState: UG, msg: MSG) => Promise<void>
    undo: () => Promise<void>
    getStatistics: (userGlobalState: UG) => Promise<ST>
}

export class EngineImpl<EG, UG, UA, CD, CS, MSG, ST> implements Engine<UG, UA, CD, CS, MSG, ST> {
    constructor(
        private readonly initialize: EngineInitializer<EG>,
        private readonly stateTransition: EngineStateTransition<EG, UG, UA, CS, MSG>,
        private readonly saver: EngineSaver<EG, CS, CD>,
        private readonly loader: EngineCardLoader<EG, UG, CS, CD>,
        private readonly stats: EngineStats<EG, UG, ST>,
    ) { }

    private getEngineGlobalState = (): Promise<EG> => {
        throw new Error("NIY")
    }
    private storeEngineGlobalState = (eg: EG): void => {
        throw new Error("NIY")
    }

    getCard = async (userGlobalState: UG): Promise<EngineCardHandle<UA, CS, CD> | null> => {
        const engineGlobalState = await this.getEngineGlobalState()
        const card = await this.loader.loadCardState(engineGlobalState, userGlobalState)
        if (card === null) {
            return null
        }

        let isClosed = false
        return {
            card,
            get isClosed() {
                return isClosed
            },
            answerAndSave: async (userAnswer) => {
                if (isClosed) {
                    throw new Error(`This handle was used already`)
                }
                const result = this.stateTransition.transitionCardState(
                    engineGlobalState,
                    userGlobalState,
                    userAnswer,
                    card.state,
                )

                await this.saver.saveStateCardTransitionResult(
                    card,
                    result,
                )

                this.storeEngineGlobalState(result.engineGlobalState)
            }
        }
    }
    passMessage = async (userGlobalState: UG, message: MSG): Promise<void> => {
        const newEngineGlobalState = this.stateTransition.transitionEngineCommand(
            await this.getEngineGlobalState(),
            userGlobalState,
            message,
        )

        await this.saver.saveEngineStateTransition(newEngineGlobalState)
        this.storeEngineGlobalState(newEngineGlobalState)
    }

    undo = async () => {
        await this.saver.undo()
    }

    getStatistics = async (userGlobalState: UG): Promise<ST> => {
        return await this.stats.getStatistics(
            await this.getEngineGlobalState(),
            userGlobalState,
        )
    }
}