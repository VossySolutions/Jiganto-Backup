import {
  eq,
  type SQL
} from "drizzle-orm";
import { crmAccounts } from "@shared/models/crm";

/** Join filter: CRM row's account must belong to client workspace. */
export function crmAccountClientCondition(clientId: number): SQL {
  return eq(crmAccounts.clientId, clientId);
}
