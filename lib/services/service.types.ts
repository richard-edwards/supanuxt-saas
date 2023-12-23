import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { membership, account, user } from '~~/drizzle/schema'
import { Prisma } from '@prisma/client';

export const membershipWithAccount = createSelectSchema(membership)
  .merge(z.object({ account: createSelectSchema(account) }));
// .and(z.object({ account: createSelectSchema(account) }));

export type MembershipWithAccount = z.infer<typeof membershipWithAccount>

// export const membershipWithAccount = Prisma.validator<Prisma.MembershipArgs>()({
//   include: { account: true }
// });
// export type MembershipWithAccount = Prisma.MembershipGetPayload<
//   typeof membershipWithAccount
// >;

export const membershipWithUser = createSelectSchema(membership)
  .merge(z.object({ user: createSelectSchema(user) }));

export type MembershipWithUser = z.infer<typeof membershipWithUser>

// export const membershipWithUser = Prisma.validator<Prisma.MembershipArgs>()({
//   include: { user: true }
// });
// export type MembershipWithUser = Prisma.MembershipGetPayload<
//   typeof membershipWithUser
// >;

export const fullDBUser = Prisma.validator<Prisma.UserArgs>()({
  include: {
    memberships: {
      include: {
        account: true
      }
    }
  }
});
export type FullDBUser = Prisma.UserGetPayload<typeof fullDBUser>; //TODO - I wonder if this could be replaced by just user level info

export const accountWithMembers = Prisma.validator<Prisma.AccountArgs>()({
  include: {
    members: {
      include: {
        user: true
      }
    }
  }
});
export type AccountWithMembers = Prisma.AccountGetPayload<
  typeof accountWithMembers
>; //TODO - I wonder if this could just be a list of full memberships
