import { TimestampMs } from "../util/stl"
import { Clock, DebugClock, SystemClock } from "./clock"

const doTestClock = (clock: Clock, name: string) => {
	describe(name, () => {
		it("returns same day for start/end timestamps", () => {
			const now = clock.getNow()
			const day = clock.getDay(now)

			expect(day).toEqual(clock.getDay(clock.getStartDayTimestamp(day)))
		})
	})
}

doTestClock(new DebugClock(1000 as TimestampMs), "DebugClock")
doTestClock(new SystemClock(0), "SystemClock")
doTestClock(new SystemClock(1000 * 60 * 60 * 4), "SystemClock@4AM")
