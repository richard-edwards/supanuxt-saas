import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { membership, account, user } from '~~/drizzle/schema'
import { Prisma } from '@prisma/client';

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

// export const fullDBUser = Prisma.validator<Prisma.UserArgs>()({
//   include: {
//     memberships: {
//       include: {
//         account: true
//       }
//     }
//   }
// });
// export type FullDBUser = Prisma.UserGetPayload<typeof fullDBUser>; //TODO - I wonder if this could be replaced by just user level info

const accountSelect = createSelectSchema(account)
export const accountWithMembers = accountSelect
  .merge(z.object({ members: z.array(membershipWithUser) }))
export type AccountWithMembers = z.infer<typeof accountWithMembers>

// export const accountWithMembers = Prisma.validator<Prisma.AccountArgs>()({
//   include: {
//     members: {
//       include: {
//         user: true
//       }
//     }
//   }
// });
// export type AccountWithMembers = Prisma.AccountGetPayload<
//   typeof accountWithMembers
// >; //TODO - I wonder if this could just be a list of full memberships
