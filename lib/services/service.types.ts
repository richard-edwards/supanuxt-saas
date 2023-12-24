import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { membership, account, user } from '~~/drizzle/schema'

const membershipSelect = createSelectSchema(membership)

export const membershipWithAccount = membershipSelect
  .merge(z.object({ account: createSelectSchema(account) }));
export type MembershipWithAccount = z.infer<typeof membershipWithAccount>

export const membershipWithUser = membershipSelect
  .merge(z.object({ user: createSelectSchema(user) }));
export type MembershipWithUser = z.infer<typeof membershipWithUser>

const userSelect = createSelectSchema(user)
export const fullDBUser = userSelect
  .merge(z.object({ memberships: z.array(membershipWithAccount) }))
export type FullDBUser = z.infer<typeof fullDBUser>

const accountSelect = createSelectSchema(account)
export const accountWithMembers = accountSelect
  .merge(z.object({ members: z.array(membershipWithUser) }))
export type AccountWithMembers = z.infer<typeof accountWithMembers>
