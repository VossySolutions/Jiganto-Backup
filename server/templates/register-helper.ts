import * as tplService from "./service";
import type { TemplateModule } from "@shared/models/templates";

/** Register or update a platform template after a source-module save-as-template action. */
export async function registerFromSource(params: {
  tenantId: number;
  userId: string;
  userName?: string;
  module: TemplateModule;
  sourceModule: string;
  sourceId: number;
  name: string;
  description?: string;
  categoryTags?: string[];
}) {
  return tplService.registerTemplate({
    tenantId: params.tenantId,
    userId: params.userId,
    userName: params.userName,
    name: params.name,
    description: params.description,
    module: params.module,
    sourceModule: params.sourceModule,
    sourceId: params.sourceId,
    categoryTags: params.categoryTags,
    tier: "customer",
    status: "active",
  });
}
