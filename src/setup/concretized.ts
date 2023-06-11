import { CollectionData, EntryUserData } from "../card";
import { EngineEntryData, EngineSessionData } from "../engine";
import { CollectionEntity, EntryEntity } from "../store";

export type ConcreteCollectionEntity = CollectionEntity<CollectionData, EngineSessionData>
export type ConcreteEntryEntity = EntryEntity<EngineEntryData, EntryUserData>