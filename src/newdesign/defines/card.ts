import { IDBComparable } from "../../util"

export type Card<S, D> = {
    id: IDBComparable,
    state: S,
    data: D
}