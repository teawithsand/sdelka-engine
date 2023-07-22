export type TransitionResult<GI, C> = {
    globalInternalState: GI,
    cardState: C
}

/**
 * Component responsible for computing global internal and card state transitions.
 */
export interface Transition<GU, GI, LU, CS, M> {
    transitionState: (
        globalInternalState: Readonly<GI>,
        message: M
    ) => Promise<GI>

    transitionCard: (
        globalUserState: Readonly<GU>,
        globalInternalState:Readonly< GI>,
        localUserState: Readonly<LU>,
        cardState: Readonly<CS>,
    ) => TransitionResult<GI, CS>
}