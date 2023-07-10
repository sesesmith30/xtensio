export type Commands = "create" | "generate" | "build";

export enum ExtensionOptionsKey {
  Background,
  Contentscript,
  Popup,
  ExtensionPages,
}

export type CreateValues = string;
export type GenerateValues = "popup" | "page" | "contentscript" | "background";

export interface TemplateVariables {}; // TODO
