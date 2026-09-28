import { AnyDataModel } from "convex/server";
import { GenericActionCtx, GenericMutationCtx, GenericQueryCtx } from "convex/server";

export type DataModel = AnyDataModel;
export type QueryCtx = GenericQueryCtx<AnyDataModel>;
export type MutationCtx = GenericMutationCtx<AnyDataModel>;
export type ActionCtx = GenericActionCtx<AnyDataModel>;
export type Id<TableName extends string> = string & { __tableName?: TableName };

export const query = (config: any) => config;
export const mutation = (config: any) => config;
export const action = (config: any) => config;
export const internalQuery = (config: any) => config;
export const internalMutation = (config: any) => config;
export const internalAction = (config: any) => config;
