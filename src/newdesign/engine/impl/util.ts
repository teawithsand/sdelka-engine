import { TimestampMs } from "../../../internal";
import { DayTimestamp } from "../../../util";
import { SM2EngineState } from "../defines";

export class SM2EngineGlobalStateUtil {
    constructor() { }

    getDayTimestamp = (ts: TimestampMs): DayTimestamp => {
        return Math.floor(ts / (24 * 3600 * 1000))
    }
}

export class SM2EngineStateUtil {
    constructor(
        public readonly state: SM2EngineState,
    ) { }

    get newCardsLimit() {
        return Math.max(0, this.state.config.newLimitBase + this.state.dailyState.newLimitDelta)
    }

    get learnedCardsLimit() {
        return Math.max(0, this.state.config.learnedLimitBase + this.state.dailyState.learnedLimitDelta)
    }

    isCardForToday = (desiredPresentationTimestamp: TimestampMs): boolean => {
        return desiredPresentationTimestamp < (
            (this.state.dailyState.dayTimestamp + 1) * 1000 * 60 * 60 * 24 + this.state.config.newDayDelta
        )
    }
}