import type { FullDBUser } from './service.types';
import { UtilService } from './util.service';
import generator from 'generate-password-ts';

import { db as drizzleDB } from '~~/drizzle/drizzle.client';
import { membership, account, plan, user, ACCOUNT_ACCESS } from '~~/drizzle/schema'

import { eq } from 'drizzle-orm'

const config = useRuntimeConfig();

export default class AuthService {
  async getFullUserBySupabaseId(supabase_uid: string): Promise<FullDBUser | null> {
    const this_user = await drizzleDB.query.user.findFirst({
      where: eq(user.supabase_uid, supabase_uid),
      with: {
        memberships: {
          with: {
            account: true,
          }
        }
      },
    })
    return this_user as FullDBUser
    // return prisma_client.user.findFirst({
    //   where: { supabase_uid },
    //   ...fullDBUser
    // });
  }

  async getUserById(user_id: number): Promise<FullDBUser | null> {
    const this_user = await drizzleDB.query.user.findFirst({
      where: eq(user.id, user_id),
      with: {
        memberships: {
          with: {
            account: true,
          }
        }
      },
    })
    return this_user as FullDBUser
  }

  async createUser(supabase_uid: string, display_name: string, email: string): Promise<FullDBUser | null> {

    const trialPlan = await drizzleDB.query.plan.findFirst({
      where: eq(plan.name, config.initialPlanName)
    })

    if (!trialPlan) {
      throw new Error('Trial plan not found')
    }

    const join_password: string = generator.generate({
      length: 10,
      numbers: true
    });

    const endingDate = UtilService.addMonths(
      new Date(),
      config.initialPlanActiveMonths
    )

    const newAccountId: { insertedId: number }[] = await drizzleDB.insert(account)
      .values({
        name: display_name,
        current_period_ends: endingDate.toDateString(),
        plan_id: trialPlan.id,
        features: trialPlan.features,
        max_notes: trialPlan.max_notes,
        max_members: trialPlan.max_members,
        plan_name: trialPlan.name,
        join_password: join_password
      })
      .returning({ insertedId: account.id });

    const newUserId: { insertedId: number }[] = await drizzleDB.insert(user)
      .values({
        supabase_uid: supabase_uid,
        display_name: display_name,
        email: email,
      })
      .returning({ insertedId: user.id });

    const newMembershipId: { insertedId: number }[] = await drizzleDB.insert(membership)
      .values({
        account_id: newAccountId[0].insertedId,
        user_id: newUserId[0].insertedId,
        access: ACCOUNT_ACCESS.OWNER
      })
      .returning({ insertedId: membership.id });

    // Retrieve the new user
    const newUser = await drizzleDB.query.user.findFirst({
      where: (user) => eq(user.id, newUserId[0].insertedId),
      with: {
        memberships: {
          with: {
            account: true,
          }
        }
      },
    })

    return newUser as FullDBUser

    // return prisma_client.user.create({
    //   data: {
    //     supabase_uid: supabase_uid,
    //     display_name: display_name,
    //     email: email,
    //     memberships: {
    //       create: {
    //         account: {
    //           create: {
    //             name: display_name,
    //             current_period_ends: UtilService.addMonths(
    //               new Date(),
    //               config.initialPlanActiveMonths
    //             ),
    //             plan_id: trialPlan.id,
    //             features: trialPlan.features,
    //             max_notes: trialPlan.max_notes,
    //             max_members: trialPlan.max_members,
    //             plan_name: trialPlan.name,
    //             join_password: join_password
    //           }
    //         },
    //         access: ACCOUNT_ACCESS.OWNER
    //       }
    //     }
    //   },
    //   ...fullDBUser
    // });
  }

  async deleteUser(user_id: number): Promise<number> {

    await drizzleDB.delete(user)
      .where(eq(user.id, user_id))

    return user_id


  }
}
