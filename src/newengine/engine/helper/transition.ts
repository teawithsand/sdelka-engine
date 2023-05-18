import produce from "immer"
import { TimestampMs } from "../../../util/stl"
import {
	EngineAnswer,
	EngineConfig,
	EngineEntryData,
	EngineEntryDataType,
} from "../../defines"

export interface EngineEntryTransition {
	transformData: (
		now: TimestampMs,
		currentData: EngineEntryData,
		answer: EngineAnswer
	) => Promise<EngineEntryData>
}

export class EngineEntryTransitionImpl implements EngineEntryTransition {
	constructor(protected readonly config: EngineConfig) {}

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

	public transformData = async (
		now: TimestampMs,
		data: EngineEntryData,
		answer: EngineAnswer
	): Promise<EngineEntryData> => {
		data = produce(data, (data) => {
			if (
				data.type === EngineEntryDataType.LEARNED ||
				data.type === EngineEntryDataType.RELEARNING
			) {
				data.easeFactor = this.boundEaseFactor(data.easeFactor)
			}

			if (data.type === EngineEntryDataType.LEARNED) {
				data.interval = this.boundInterval(data.interval)
			}
		})
		if (data.type === EngineEntryDataType.NEW) {
			if (
				answer === EngineAnswer.AGAIN ||
				answer === EngineAnswer.HARD ||
				answer === EngineAnswer.GOOD
			) {
				const interval = this.boundInterval(this.getLearningStep(0))
				return {
					type: EngineEntryDataType.LEARNING,
					desiredPresentationTimestamp: (now +
						interval) as TimestampMs,
					stepIndex: 0,
				}
			} else if (answer === EngineAnswer.EASY) {
				const interval = this.boundInterval(
					this.config.skipLearningInterval
				)
				return {
					type: EngineEntryDataType.LEARNED,
					desiredPresentationTimestamp: (now +
						interval) as TimestampMs,
					easeFactor: this.boundEaseFactor(
						this.config.skipLearningEaseFactor
					),
					interval: interval,
					lapCount: 0,
				}
			}
		} else if (data.type === EngineEntryDataType.LEARNED) {
			if (answer === EngineAnswer.AGAIN) {
				const interval = this.boundInterval(this.config.lapInterval)
				return {
					type: EngineEntryDataType.RELEARNING,
					desiredPresentationTimestamp: (now +
						interval) as TimestampMs,
					easeFactor: this.boundEaseFactor(
						data.easeFactor - this.config.lapEaseFactorDelta
					),
					lapCount: data.lapCount + 1,
					stepIndex: 0,
				}
			} else if (answer === EngineAnswer.HARD) {
				const ef = this.boundEaseFactor(
					data.easeFactor - this.config.hardEaseFactorDelta
				)
				const interval = this.boundInterval(data.interval * ef)
				return {
					type: EngineEntryDataType.LEARNED,
					desiredPresentationTimestamp: (now +
						interval) as TimestampMs,
					easeFactor: ef,
					lapCount: data.lapCount,
					interval,
				}
			} else if (answer === EngineAnswer.GOOD) {
				const ef = this.boundEaseFactor(data.easeFactor)
				const interval = this.boundInterval(data.interval * ef)
				return {
					type: EngineEntryDataType.LEARNED,
					desiredPresentationTimestamp: (now +
						interval) as TimestampMs,
					easeFactor: ef,
					lapCount: data.lapCount,
					interval,
				}
			} else if (answer === EngineAnswer.EASY) {
				const ef = this.boundEaseFactor(
					data.easeFactor + this.config.easyEaseFactorDelta
				)
				const interval = this.boundInterval(data.interval * ef)
				return {
					type: EngineEntryDataType.LEARNED,
					desiredPresentationTimestamp: (now +
						interval) as TimestampMs,
					easeFactor: ef,
					lapCount: data.lapCount,
					interval,
				}
			}
		} else if (data.type === EngineEntryDataType.LEARNING) {
			if (answer === EngineAnswer.AGAIN) {
				const interval = this.boundInterval(this.getLearningStep(0))

				return {
					type: EngineEntryDataType.LEARNING,
					desiredPresentationTimestamp: (now +
						interval) as TimestampMs,
					stepIndex: 0,
				}
			} else if (answer === EngineAnswer.HARD) {
				const interval = this.boundInterval(
					this.getLearningStep(data.stepIndex)
				)

				return {
					type: EngineEntryDataType.LEARNING,
					desiredPresentationTimestamp: (now +
						interval) as TimestampMs,
					stepIndex: data.stepIndex,
				}
			} else if (answer === EngineAnswer.GOOD) {
				if (data.stepIndex >= this.config.learningSteps.length) {
					const interval = this.boundInterval(
						this.config.graduatedInterval
					)
					const ef = this.boundEaseFactor(this.config.initEaseFactor)
					return {
						type: EngineEntryDataType.LEARNED,
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
						type: EngineEntryDataType.LEARNING,
						desiredPresentationTimestamp: (now +
							interval) as TimestampMs,
						stepIndex: data.stepIndex + 1,
					}
				}
			} else if (answer === EngineAnswer.EASY) {
				const interval = this.boundInterval(
					this.config.skipLearningInterval
				)

				return {
					type: EngineEntryDataType.LEARNED,
					desiredPresentationTimestamp: (now +
						interval) as TimestampMs,
					easeFactor: this.boundEaseFactor(
						this.config.skipLearningEaseFactor
					),
					interval: interval,
					lapCount: 0,
				}
			}
		} else if (data.type === EngineEntryDataType.RELEARNING) {
			if (answer === EngineAnswer.AGAIN) {
				const interval = this.boundInterval(this.getRelearningStep(0))
				return {
					type: EngineEntryDataType.RELEARNING,
					desiredPresentationTimestamp: (now +
						interval) as TimestampMs,
					easeFactor: data.easeFactor,
					lapCount: data.lapCount,
					stepIndex: 0,
				}
			} else if (answer === EngineAnswer.HARD) {
				const interval = this.boundInterval(
					this.getRelearningStep(data.stepIndex)
				)
				return {
					type: EngineEntryDataType.RELEARNING,
					desiredPresentationTimestamp: (now +
						interval) as TimestampMs,
					easeFactor: this.boundEaseFactor(data.easeFactor),
					lapCount: data.lapCount,
					stepIndex: data.stepIndex,
				}
			} else if (answer === EngineAnswer.GOOD) {
				if (data.stepIndex >= this.config.relearningSteps.length) {
					const interval = this.boundInterval(
						this.config.relearnedInterval
					)
					return {
						type: EngineEntryDataType.LEARNED,
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
						type: EngineEntryDataType.RELEARNING,
						desiredPresentationTimestamp: (now +
							interval) as TimestampMs,
						easeFactor: this.boundEaseFactor(data.easeFactor),
						lapCount: data.lapCount,
						stepIndex: data.stepIndex,
					}
				}
			} else if (answer === EngineAnswer.EASY) {
				const interval = this.boundInterval(
					this.config.skipLearningInterval
				)
				const ef = this.boundEaseFactor(
					data.easeFactor + this.config.easyEaseFactorDelta
				)
				return {
					type: EngineEntryDataType.LEARNED,
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
