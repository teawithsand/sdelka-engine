import { ID } from "../../util"

/**
 * Connection to server used to exchange data in order to make it synchronized.
 */
export interface ClientSyncConn<C> {
    getOutOfSyncCardCount: () => Promise<number>
    getOutOfSyncCardIds: (offset: number, limit: number) => Promise<void>
    
    getCardCount: () => Promise<number>
    getIds: (offset: number, limit: number) => Promise<ID[]>
    getCards: (id: ID[]) => Promise<(C | null)[]>
    setCards: (cards: C[]) => Promise<void>

    keepAlive: () => Promise<void>
    close: () => Promise<void>
}

/**
 * Connector, which creates ClientSyncConns.
 */
export interface ClientSyncConnector<C, A> {
    connect: (baseUrl: URL, authAdapter: A) => Promise<ClientSyncConn<C>>
}