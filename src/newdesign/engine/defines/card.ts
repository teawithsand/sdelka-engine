
/**
 * Card, as understood by engine. Consists of two components: its state and data.
 */
export type EngineCard<CD, CS> = { 
    state: CS,
    data: CD,
}