import { EngineCard } from "./card"
import { EngineCardLoader, EngineInitializer, EngineSaver, EngineStateManager, EngineStateTransition, EngineStatsLoader } from "./components"

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

export class EngineImpl<ES, EP, UG, UA, CD, CS, MSG, ST> implements Engine<UG, UA, CD, CS, MSG, ST> {
    private persistentEngineState: EP | null = null

    constructor(
        private readonly initializer: EngineInitializer<EP>,
        private readonly stateTransition: EngineStateTransition<ES, UA, CS, MSG>,
        private readonly saver: EngineSaver<EP, CS, CD>,
        private readonly loader: EngineCardLoader<ES, CS, CD>,
        private readonly stats: EngineStatsLoader<ES, ST>,
        private readonly manager: EngineStateManager<ES, EP, UG>,
    ) { }

    private getEnginePersistentState = async (): Promise<EP> => {
        if (this.persistentEngineState === null) {
            this.persistentEngineState = await this.initializer.loadEngineGlobalState()
        }

        return this.persistentEngineState
    }

    getCard = async (userGlobalState: UG): Promise<EngineCardHandle<UA, CS, CD> | null> => {
        const enginePersistentState = await this.getEnginePersistentState()
        const engineState = this.manager.getEngineState(enginePersistentState, userGlobalState)

        const card = await this.loader.loadCardState(engineState)

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
                try {
                    const result = this.stateTransition.transitionCardState(
                        engineState,
                        userAnswer,
                        card.state,
                    )

                    const newPersistentEngineState = this.manager.getPersistentState(result.engineState)

                    await this.saver.saveStateCardTransitionResult(
                        card,
                        {
                            cardState: result.cardState,
                            engineState: newPersistentEngineState,
                        },
                    )
                    this.persistentEngineState = newPersistentEngineState
                } finally {
                    isClosed = true
                }
            }
        }
    }

    passMessage = async (userGlobalState: UG, message: MSG): Promise<void> => {
        const enginePersistentState = await this.getEnginePersistentState()
        const engineState = this.manager.getEngineState(enginePersistentState, userGlobalState)

        const newEngineGlobalState = this.stateTransition.transitionEngineCommand(
            engineState,
            message,
        )

        const newPersistentEngineState = this.manager.getPersistentState(newEngineGlobalState)

        await this.saver.saveEngineStateTransition(newPersistentEngineState)
        this.persistentEngineState = newPersistentEngineState
    }

    undo = async () => {
        await this.saver.undo()
    }

    getStatistics = async (userGlobalState: UG): Promise<ST> => {
        return await this.stats.getStatistics(
            this.manager.getEngineState(await this.getEnginePersistentState(), userGlobalState),
        )
    }
}