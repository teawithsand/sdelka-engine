import { Card } from "./card"

export interface EngineSelectedCard<CS, CD, LU> {
    readonly card: Card<CS, CD>

    answerAndSave: (localUserData: LU) => Promise<Card<CS, CD>>
}

/**
 * Component, which manages other minor ones like selector, transition, saver and loader 
 * in order to provide end-user interface.
 * 
 * It does not handle statistics.
 */
export interface Engine<GI, GU, LU, CS, CD> {
    readonly globalInternalState: GI
    loadInternalState: () => Promise<GI>

    selectCard: (
        globalUserState: GU
    ) => Promise<EngineSelectedCard<CS, CD, LU> | null>
}