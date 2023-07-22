
/**
 * Card, as understood by engine. Consists of two components: its state and data.
 */
export type EngineCard<CS, CD> = { 
    state: CS,
    data: CD,
}