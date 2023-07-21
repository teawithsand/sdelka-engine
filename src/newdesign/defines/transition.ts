export type TransitionResult<GI, C> = {
    globalInternalState: GI,
    cardState: C
}

/**
 * Component responsible for computing global internal and card state transitions.
 */
export interface Transition<GU, GI, LU, C> {
    transition: (
        globalUserState: Readonly<GU>,
        globalInternalState:Readonly< GI>,
        localUserState: Readonly<LU>,
        cardState: Readonly<C>,
    ) => TransitionResult<GI, C>
}