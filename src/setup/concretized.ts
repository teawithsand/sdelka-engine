import { UserCollectionData, UserEntryData } from "../card";
import { EngineEntryData, EngineCollectionData } from "../engine";
import { CollectionEntity, EntryEntity } from "../store";

export type ConcreteCollectionEntity = CollectionEntity<UserCollectionData, EngineCollectionData>
export type ConcreteEntryEntity = EntryEntity<EngineEntryData, UserEntryData>