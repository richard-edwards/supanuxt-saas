import { sql, relations, } from "drizzle-orm"
import { account, user, membership, note } from "./schema"

export const userRelations = relations(user, ({ many }) => ({
  memberships: many(membership),
}));

export const accountRelations = relations(account, ({ many }) => ({
  notes: many(note),
  members: many(membership),
}));

export const membershipRelations = relations(membership, ({ one }) => ({
  user: one(user, {
    fields: [membership.userId],
    references: [user.id],
  }),
  account: one(account, {
    fields: [membership.accountId],
    references: [account.id],
  }),
}));

export const noteRelations = relations(note, ({ one }) => ({
  account: one(account, {
    fields: [note.accountId],
    references: [account.id],
  }),
}));