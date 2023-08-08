import { TimestampMs } from "../../../../internal"

export * from "./card"
export * from "./state"
export * from "./stats"
export * from "./config"

export type SM2UserState = {
     now: TimestampMs
	 
	// ignoreReviewLimit: boolean // TODO(teawithsand): implement it
	// ignoreNewLimit: boolean // TODO(teawithsand): implement it
}

export enum SM2EngineAnswer {
	EASY = 1,
	GOOD = 2,
	HARD = 3,
	AGAIN = 4,
}

export enum SM2EngineMessageType {

}

export type SM2EngineMessage = {}