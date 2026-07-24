import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod";

/**
 * Cell storage for board custom columns. Any module table (leads, budgets,
 * tickets, …) can add a custom column without its own schema change: the
 * definition lives in `crm_custom_fields` and the per-row value lives here.
 */
export const boardFieldValues = pgTable(
  "board_field_values",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    fieldName: text("field_name").notNull(),
    value: text("value"),
    updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    cellUnique: uniqueIndex("board_field_values_cell_unique").on(
      table.tenantId,
      table.entityType,
      table.entityId,
      table.fieldName,
    ),
  }),
);

export const insertBoardFieldValueSchema = createInsertSchema(boardFieldValues).omit({
  id: true,
  updatedAt: true,
});

export type BoardFieldValue = typeof boardFieldValues.$inferSelect;
export type InsertBoardFieldValue = z.infer<typeof insertBoardFieldValueSchema>;
