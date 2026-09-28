export type Id<TableName extends string> = string & { __tableName?: TableName };
export type DataModel = any;
