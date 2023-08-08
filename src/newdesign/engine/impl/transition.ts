import { CardStateTransitionResult, EngineStateTransition, SM2CardState, SM2EngineAnswer, SM2EngineGlobalState, SM2EngineMessage, SM2UserGlobalState } from "../defines";

export class SM2EngineStateTransition implements EngineStateTransition<
    SM2EngineGlobalState,
    SM2UserGlobalState,
    SM2EngineAnswer,
    SM2CardState,
    SM2EngineMessage>
{
    transitionEngineCommand = (
        engineGlobalState: SM2EngineGlobalState,
        userGlobalState: SM2UserGlobalState,
        message: SM2EngineMessage
    ): SM2EngineGlobalState => {
        throw new Error("NIY")
    }
    
    transitionCardState = (
        engineGlobalState: SM2EngineGlobalState,
        userGlobalState: SM2UserGlobalState,
        userAnswer: SM2EngineAnswer,
        cardState: SM2CardState
    ): CardStateTransitionResult<SM2EngineGlobalState, SM2CardState> => {
        throw new Error("NIY")
    }
}