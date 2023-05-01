import produce from "immer"
import {
	SM2CardType,
	SM2EngineAnswer,
	SM2EngineCardData,
	SM2EngineConfig,
} from "./defines"
import { TimestampMs } from "../../util/stl"

export class SM2EngineCardDataTransition {
	constructor(protected readonly config: SM2EngineConfig) {}

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

	public transitionCardData = (
		now: TimestampMs,
		answer: SM2EngineAnswer,
		data: SM2EngineCardData
	): SM2EngineCardData => {
		data = produce(data, (data) => {
			if (
				data.type === SM2CardType.LEARNED ||
				data.type === SM2CardType.RELEARNING
			) {
				data.easeFactor = this.boundEaseFactor(data.easeFactor)
			}

			if (data.type === SM2CardType.LEARNED) {
				data.interval = this.boundInterval(data.interval)
			}
		})
		if (data.type === SM2CardType.NEW) {
			if (
				answer === SM2EngineAnswer.AGAIN ||
				answer === SM2EngineAnswer.HARD ||
				answer === SM2EngineAnswer.GOOD
			) {
				const interval = this.boundInterval(this.getLearningStep(0))
				return {
					id: data.id,
					syncData: data.syncData,
					type: SM2CardType.LEARNING,
					desiredPresentationTimestamp: (now +
						interval) as TimestampMs,
					stepIndex: 0,
				}
			} else if (answer === SM2EngineAnswer.EASY) {
				const interval = this.boundInterval(
					this.config.skipLearningInterval
				)
				return {
					id: data.id,
					syncData: data.syncData,
					type: SM2CardType.LEARNED,
					desiredPresentationTimestamp: (now +
						interval) as TimestampMs,
					easeFactor: this.boundEaseFactor(
						this.config.skipLearningEaseFactor
					),
					interval: interval,
					lapCount: 0,
				}
			}
		} else if (data.type === SM2CardType.LEARNED) {
			if (answer === SM2EngineAnswer.AGAIN) {
				const interval = this.boundInterval(this.config.lapInterval)
				return {
					id: data.id,
					syncData: data.syncData,
					type: SM2CardType.RELEARNING,
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
					id: data.id,
					syncData: data.syncData,
					type: SM2CardType.LEARNED,
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
					id: data.id,
					syncData: data.syncData,
					type: SM2CardType.LEARNED,
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
					id: data.id,
					syncData: data.syncData,
					type: SM2CardType.LEARNED,
					desiredPresentationTimestamp: (now +
						interval) as TimestampMs,
					easeFactor: ef,
					lapCount: data.lapCount,
					interval,
				}
			}
		} else if (data.type === SM2CardType.LEARNING) {
			if (answer === SM2EngineAnswer.AGAIN) {
				const interval = this.boundInterval(this.getLearningStep(0))

				return {
					id: data.id,
					syncData: data.syncData,
					type: SM2CardType.LEARNING,
					desiredPresentationTimestamp: (now +
						interval) as TimestampMs,
					stepIndex: 0,
				}
			} else if (answer === SM2EngineAnswer.HARD) {
				const interval = this.boundInterval(
					this.getLearningStep(data.stepIndex)
				)

				return {
					id: data.id,
					syncData: data.syncData,
					type: SM2CardType.LEARNING,
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
						id: data.id,
						syncData: data.syncData,
						type: SM2CardType.LEARNED,
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
						id: data.id,
						syncData: data.syncData,
						type: SM2CardType.LEARNING,
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
					id: data.id,
					syncData: data.syncData,
					type: SM2CardType.LEARNED,
					desiredPresentationTimestamp: (now +
						interval) as TimestampMs,
					easeFactor: this.boundEaseFactor(
						this.config.skipLearningEaseFactor
					),
					interval: interval,
					lapCount: 0,
				}
			}
		} else if (data.type === SM2CardType.RELEARNING) {
			if (answer === SM2EngineAnswer.AGAIN) {
				const interval = this.boundInterval(this.getRelearningStep(0))
				return {
					id: data.id,
					syncData: data.syncData,
					type: SM2CardType.RELEARNING,
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
					id: data.id,
					type: SM2CardType.RELEARNING,
					syncData: data.syncData,
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
						id: data.id,
						syncData: data.syncData,
						type: SM2CardType.LEARNED,
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
						id: data.id,
						syncData: data.syncData,
						type: SM2CardType.RELEARNING,
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
					id: data.id,
					syncData: data.syncData,
					type: SM2CardType.LEARNED,
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
