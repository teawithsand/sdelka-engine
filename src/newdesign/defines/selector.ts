import { Card } from "./card";

export interface CardSelector<GI, GU, S, D> {
    selectCard: (
        globalUserState: Readonly<GU>,
        globalInternalState: Readonly<GI>,
    ) => Promise<Card<S, D> | null>
}