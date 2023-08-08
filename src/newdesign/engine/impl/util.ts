import { TimestampMs } from "../../../internal";
import { DayTimestamp } from "../../../util";
import { SM2EngineState } from "../defines";

export class SM2EngineGlobalStateUtil {
    constructor(){}

    getDayTimestamp = (ts: TimestampMs): DayTimestamp => {
        return Math.floor(ts / (24 * 3600 * 1000))
    }
}

export class SM2EngineStateUtil {
    constructor(
        public readonly state: SM2EngineState,
    ){}

    get newCardsLimit() {
        return this.state.config.newLimitBase + this.state.dailyState.newLimitDelta
    }

    get learnedCardsLimit() {
        return this.state.config.learnedLimitBase + this.state.dailyState.learnedLimitDelta
    }
}