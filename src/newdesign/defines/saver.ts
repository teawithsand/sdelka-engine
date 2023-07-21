import { IDBComparable } from "../../util";
import { TransitionResult } from "./transition";

/**
 * Component responsible for processing and saving transition results.
 * 
 * It's implementation ensures that writes are atomic.
 * 
 * It is CardDB specific in general.
 */
export interface Saver<GI, C> {
    saveInnerGlobalState: (state: GI) => Promise<void>
    saveTransitionResult: (cardId: IDBComparable, res: TransitionResult<GI, C>) => Promise<void>
}

/**
 * Component responsible for loading last global internal state or providing default one in case it wasn't there.
 */
export interface Loader<GI> {
    loadInternalState: () => Promise<GI> 
}