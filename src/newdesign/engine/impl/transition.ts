import produce from "immer";
import { TimestampMs } from "../../../internal";
import { CardStateTransitionResult, EngineStateTransition, SM2CardState, SM2CardStateType, SM2EngineAnswer, SM2EngineConfig, SM2EngineMessage, SM2EngineState } from "../defines";

export class SM2EngineStateTransition implements EngineStateTransition<
    SM2EngineState,
    SM2EngineAnswer,
    SM2CardState,
    SM2EngineMessage
> {
    transitionEngineCommand = (
        engineState: SM2EngineState,
        message: SM2EngineMessage
    ): SM2EngineState => {
        return engineState
    }

    transitionCardState = (
        engineGlobalState: SM2EngineState,
        userAnswer: SM2EngineAnswer,
        cardState: SM2CardState
    ): CardStateTransitionResult<SM2EngineState, SM2CardState> => {

        const helper = new InnerCardTransitionHelper(
            engineGlobalState.config,
        )

        const state = helper.transformData(
            engineGlobalState.now,
            cardState,
            userAnswer,
        )

        engineGlobalState = produce(engineGlobalState, draft => {
            if (cardState.type === SM2CardStateType.NEW) {
                draft.dailyState.processedNewCount += 1
            } else if (cardState.type === SM2CardStateType.LEARNED) {
                draft.dailyState.processedLearnedCount += 1
            }
        })

        return {
            cardState: state,
            engineState: engineGlobalState,
        }
    }

}

class InnerCardTransitionHelper {
    constructor(private readonly config: SM2EngineConfig) { }

    private boundEaseFactor = (ef: number) => {
        if (ef < this.config.minEaseFactor) {
            return this.config.minEaseFactor
        } else if (ef > this.config.maxEaseFactor) {
            return this.config.maxEaseFactor
        }

        return ef
    }

    private boundInterval = (interval: number) => {
        if (interval > this.config.maxInterval) {
            return this.config.maxInterval
        }

        return interval
    }

    private getLearningStep = (i: number) => {
        if (i < this.config.learningSteps.length)
            return this.config.learningSteps[i]
        return this.config.learningSteps[this.config.learningSteps.length - 1]
    }

    private getRelearningStep = (i: number) => {
        if (i < this.config.relearningSteps.length)
            return this.config.relearningSteps[i]
        return this.config.relearningSteps[
            this.config.relearningSteps.length - 1
        ]
    }

    public transformData = (
        now: TimestampMs,
        data: SM2CardState,
        answer: SM2EngineAnswer,
    ): SM2CardState => {
        data = produce(data, (data) => {
            if (
                data.type === SM2CardStateType.LEARNED ||
                data.type === SM2CardStateType.RELEARNING
            ) {
                data.easeFactor = this.boundEaseFactor(data.easeFactor)
            }

            if (data.type === SM2CardStateType.LEARNED) {
                data.interval = this.boundInterval(data.interval)
            }
        })
        if (data.type === SM2CardStateType.NEW) {
            if (
                answer === SM2EngineAnswer.AGAIN ||
                answer === SM2EngineAnswer.HARD ||
                answer === SM2EngineAnswer.GOOD
            ) {
                const interval = this.boundInterval(this.getLearningStep(0))
                return {
                    type: SM2CardStateType.LEARNING,
                    desiredPresentationTimestamp: (now +
                        interval) as TimestampMs,
                    stepIndex: 0,
                }
            } else if (answer === SM2EngineAnswer.EASY) {
                const interval = this.boundInterval(
                    this.config.skipLearningInterval
                )
                return {
                    type: SM2CardStateType.LEARNED,
                    desiredPresentationTimestamp: (now +
                        interval) as TimestampMs,
                    easeFactor: this.boundEaseFactor(
                        this.config.skipLearningEaseFactor
                    ),
                    interval: interval,
                    lapCount: 0,
                }
            }
        } else if (data.type === SM2CardStateType.LEARNED) {
            if (answer === SM2EngineAnswer.AGAIN) {
                const interval = this.boundInterval(this.config.lapInterval)
                return {
                    type: SM2CardStateType.RELEARNING,
                    desiredPresentationTimestamp: (now +
                        interval) as TimestampMs,
                    easeFactor: this.boundEaseFactor(
                        data.easeFactor - this.config.lapEaseFactorDelta
                    ),
                    lapCount: data.lapCount + 1,
                    stepIndex: 0,
                }
            } else if (answer === SM2EngineAnswer.HARD) {
                const ef = this.boundEaseFactor(
                    data.easeFactor - this.config.hardEaseFactorDelta
                )
                const interval = this.boundInterval(data.interval * ef)
                return {
                    type: SM2CardStateType.LEARNED,
                    desiredPresentationTimestamp: (now +
                        interval) as TimestampMs,
                    easeFactor: ef,
                    lapCount: data.lapCount,
                    interval,
                }
            } else if (answer === SM2EngineAnswer.GOOD) {
                const ef = this.boundEaseFactor(data.easeFactor)
                const interval = this.boundInterval(data.interval * ef)
                return {
                    type: SM2CardStateType.LEARNED,
                    desiredPresentationTimestamp: (now +
                        interval) as TimestampMs,
                    easeFactor: ef,
                    lapCount: data.lapCount,
                    interval,
                }
            } else if (answer === SM2EngineAnswer.EASY) {
                const ef = this.boundEaseFactor(
                    data.easeFactor + this.config.easyEaseFactorDelta
                )
                const interval = this.boundInterval(data.interval * ef)
                return {
                    type: SM2CardStateType.LEARNED,
                    desiredPresentationTimestamp: (now +
                        interval) as TimestampMs,
                    easeFactor: ef,
                    lapCount: data.lapCount,
                    interval,
                }
            }
        } else if (data.type === SM2CardStateType.LEARNING) {
            if (answer === SM2EngineAnswer.AGAIN) {
                const interval = this.boundInterval(this.getLearningStep(0))

                return {
                    type: SM2CardStateType.LEARNING,
                    desiredPresentationTimestamp: (now +
                        interval) as TimestampMs,
                    stepIndex: 0,
                }
            } else if (answer === SM2EngineAnswer.HARD) {
                const interval = this.boundInterval(
                    this.getLearningStep(data.stepIndex)
                )

                return {
                    type: SM2CardStateType.LEARNING,
                    desiredPresentationTimestamp: (now +
                        interval) as TimestampMs,
                    stepIndex: data.stepIndex,
                }
            } else if (answer === SM2EngineAnswer.GOOD) {
                if (data.stepIndex >= this.config.learningSteps.length) {
                    const interval = this.boundInterval(
                        this.config.graduatedInterval
                    )
                    const ef = this.boundEaseFactor(this.config.initEaseFactor)
                    return {
                        type: SM2CardStateType.LEARNED,
                        desiredPresentationTimestamp: (now +
                            interval) as TimestampMs,
                        easeFactor: ef,
                        interval: interval,
                        lapCount: 0,
                    }
                } else {
                    const interval = this.boundInterval(
                        this.getLearningStep(data.stepIndex + 1)
                    )

                    return {
                        type: SM2CardStateType.LEARNING,
                        desiredPresentationTimestamp: (now +
                            interval) as TimestampMs,
                        stepIndex: data.stepIndex + 1,
                    }
                }
            } else if (answer === SM2EngineAnswer.EASY) {
                const interval = this.boundInterval(
                    this.config.skipLearningInterval
                )

                return {
                    type: SM2CardStateType.LEARNED,
                    desiredPresentationTimestamp: (now +
                        interval) as TimestampMs,
                    easeFactor: this.boundEaseFactor(
                        this.config.skipLearningEaseFactor
                    ),
                    interval: interval,
                    lapCount: 0,
                }
            }
        } else if (data.type === SM2CardStateType.RELEARNING) {
            if (answer === SM2EngineAnswer.AGAIN) {
                const interval = this.boundInterval(this.getRelearningStep(0))
                return {
                    type: SM2CardStateType.RELEARNING,
                    desiredPresentationTimestamp: (now +
                        interval) as TimestampMs,
                    easeFactor: data.easeFactor,
                    lapCount: data.lapCount,
                    stepIndex: 0,
                }
            } else if (answer === SM2EngineAnswer.HARD) {
                const interval = this.boundInterval(
                    this.getRelearningStep(data.stepIndex)
                )
                return {
                    type: SM2CardStateType.RELEARNING,
                    desiredPresentationTimestamp: (now +
                        interval) as TimestampMs,
                    easeFactor: this.boundEaseFactor(data.easeFactor),
                    lapCount: data.lapCount,
                    stepIndex: data.stepIndex,
                }
            } else if (answer === SM2EngineAnswer.GOOD) {
                if (data.stepIndex >= this.config.relearningSteps.length) {
                    const interval = this.boundInterval(
                        this.config.relearnedInterval
                    )
                    return {
                        type: SM2CardStateType.LEARNED,
                        desiredPresentationTimestamp: (now +
                            interval) as TimestampMs,
                        easeFactor: this.boundEaseFactor(data.easeFactor),
                        interval: interval,
                        lapCount: data.lapCount,
                    }
                } else {
                    const interval = this.boundInterval(
                        this.getRelearningStep(data.stepIndex)
                    )

                    return {
                        type: SM2CardStateType.RELEARNING,
                        desiredPresentationTimestamp: (now +
                            interval) as TimestampMs,
                        easeFactor: this.boundEaseFactor(data.easeFactor),
                        lapCount: data.lapCount,
                        stepIndex: data.stepIndex,
                    }
                }
            } else if (answer === SM2EngineAnswer.EASY) {
                const interval = this.boundInterval(
                    this.config.skipLearningInterval
                )
                const ef = this.boundEaseFactor(
                    data.easeFactor + this.config.easyEaseFactorDelta
                )
                return {
                    type: SM2CardStateType.LEARNED,
                    desiredPresentationTimestamp: (now +
                        interval) as TimestampMs,
                    easeFactor: ef,
                    interval: interval,
                    lapCount: data.lapCount,
                }
            }
        }

        throw new Error("Unreachable code")
    }

}