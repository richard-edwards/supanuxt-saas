import { ACCOUNT_ACCESS } from '~~/prisma/account-access-enum';
// drizzle
import { db as drizzleDB } from '~~/drizzle/drizzle.client';
import { account, membership, plan } from '~~/drizzle/schema'
import { eq } from 'drizzle-orm'

import type {
  AccountWithMembers,
  MembershipWithAccount,
  MembershipWithUser
} from './service.types';
import generator from 'generate-password-ts';

export default class AccountService {
  async getAccountById(account_id: number): Promise<AccountWithMembers> {
    const this_account = await drizzleDB.query.account.findFirst({
      where: eq(account.id, account_id),
      with: {
        members: true,
      },
    })
    return this_account as AccountWithMembers
  }

  async getAccountByJoinPassword(join_password: string): Promise<AccountWithMembers> {
    const this_account = await drizzleDB.query.account.findFirst({
      where: eq(account.joinPassword, join_password),
      with: {
        members: true,
      },
    })
    return this_account as AccountWithMembers
  }

  async getAccountMembers(account_id: number): Promise<MembershipWithUser[]> {
    return drizzleDB.query.membership.findMany({
      where: eq(account.id, account_id),
      with: {
        user: true,
      },
    })
  }

  async updateAccountStipeCustomerId(
    account_id: number,
    stripe_customer_id: string
  ) {

    return await drizzleDB.update(account)
      .set({ stripeCustomerId: stripe_customer_id })
      .where(eq(account.id, account_id))
      .returning()
  }

  async updateStripeSubscriptionDetailsForAccount(
    stripe_customer_id: string,
    stripe_subscription_id: string,
    current_period_ends: Date,
    stripe_product_id: string
  ) {
    const this_account = await drizzleDB.query.account.findFirst({
      where: eq(account.stripeCustomerId, stripe_customer_id),
    })

    if (!this_account) {
      throw new Error(`Account not found for customer id ${stripe_customer_id}`);
    }

    // const account = await prisma_client.account.findFirstOrThrow({
    //   where: { stripe_customer_id }
    // });

    const paid_plan = await drizzleDB.query.plan.findFirst({
      where: eq(plan.stripeProductId, stripe_product_id),
    })

    if (!paid_plan) {
      throw new Error(`Plan not found for product id ${stripe_product_id}`);
    }

    // const paid_plan = await prisma_client.plan.findFirstOrThrow({
    //   where: { stripe_product_id }
    // });


    if (paid_plan.id == this_account.planId) {
      // only update sub and period info
      return await drizzleDB.update(account)
        .set({
          stripeSubscriptionId: stripe_subscription_id,
          currentPeriodEnds: current_period_ends.toDateString(),
          aiGenCount: 0
        })
        .where(eq(account.id, this_account.id))
        .returning()

      // return await prisma_client.account.update({
      //   where: { id: account.id },
      //   data: {
      //     stripe_subscription_id,
      //     current_period_ends,
      //     ai_gen_count: 0
      //   }
      // });
    } else {
      // plan upgrade/downgrade... update everything, copying over plan features and perks

      return await drizzleDB.update(account)
        .set({
          stripeSubscriptionId: stripe_subscription_id,
          currentPeriodEnds: current_period_ends.toDateString(),
          planId: paid_plan.id,
          features: paid_plan.features,
          maxNotes: paid_plan.maxNotes,
          maxMembers: paid_plan.maxMembers,
          planName: paid_plan.name,
          aiGenMaxPm: paid_plan.aiGenMaxPm,
          aiGenCount: 0
        })
        .where(eq(account.id, this_account.id))
        .returning()

      // return await prisma_client.account.update({
      //   where: { id: account.id },
      //   data: {
      //     stripe_subscription_id,
      //     current_period_ends,
      //     plan_id: paid_plan.id,
      //     features: paid_plan.features,
      //     max_notes: paid_plan.max_notes,
      //     max_members: paid_plan.max_members,
      //     plan_name: paid_plan.name,
      //     ai_gen_max_pm: paid_plan.ai_gen_max_pm,
      //     ai_gen_count: 0 // I did vacillate on this point ultimately easier to just reset, discussion here https://www.reddit.com/r/SaaS/comments/16e9bew/should_i_reset_usage_counts_on_plan_upgrade/
      //   }
      // });
    }
  }

  async acceptPendingMembership(
    account_id: number,
    membership_id: number
  ): Promise<MembershipWithAccount> {

    const this_membership = await drizzleDB.query.membership.findFirst({
      where: (membership) => eq(membership.id, membership_id),
    })

    if (!this_membership) {
      throw new Error(`Membership does not exist`);
    }

    if (this_membership.accountId != account_id) {
      throw new Error(`Membership does not belong to current account`);
    }

    await drizzleDB.update(membership)
      .set({ pending: false })
      .where(eq(membership.id, membership_id))

    // Retrieve the updated user with related entities
    const updatedMembershipWithAccount = await drizzleDB.query.membership.findFirst({
      where: (membership) => eq(membership.id, membership_id),
      with: {
        account: true,
      }
    })

    return updatedMembershipWithAccount as MembershipWithAccount
  }

  async deleteMembership(
    account_id: number,
    membership_id: number
  ): Promise<number> {
    const this_membership = await drizzleDB.query.membership.findFirst({
      where: (membership) => eq(membership.id, membership_id),
    })

    if (!this_membership) {
      throw new Error(`Membership does not exist`);
    }

    if (this_membership.accountId != account_id) {
      throw new Error(`Membership does not belong to current account or account does not exist`);
    }

    const deletedMembership = await drizzleDB.delete(membership)
      .where(eq(membership.id, membership_id))
      .returning()

    return deletedMembership[0].id

  }

  async joinUserToAccount(
    user_id: number,
    account_id: number,
    pending: boolean
  ): Promise<MembershipWithAccount> {

    const this_account = await drizzleDB.query.account.findFirst({
      where: (account) => eq(account.id, account_id),
      with: {
        members: true,
      }
    })

    // const account = await prisma_client.account.findUnique({
    //   where: {
    //     id: account_id
    //   },
    //   include: {
    //     members: true
    //   }
    // });

    if (this_account?.members && this_account?.members?.length >= this_account?.maxMembers) {
      throw new Error(
        `Too Many Members, Account only permits ${this_account?.maxMembers} members.`
      );
    }

    if (this_account?.members) {
      for (const member of this_account.members) {
        if (member.userId === user_id) {
          throw new Error(`User is already a member`);
        }
      }
    }

    const newMembership = await drizzleDB.insert(membership)
      .values({
        userId: user_id,
        accountId: account_id,
        access: ACCOUNT_ACCESS.READ_ONLY,
        pending
      })
      .returning()

    // Retrieve the updated membership
    const updatedMembershipWithAccount = await drizzleDB.query.membership.findFirst({
      where: (membership) => eq(membership.id, newMembership[0].id),
      with: {
        account: true,
      }
    })

    return updatedMembershipWithAccount as MembershipWithAccount

    // return prisma_client.membership.create({
    //   data: {
    //     user_id: user_id,
    //     account_id,
    //     access: ACCOUNT_ACCESS.READ_ONLY,
    //     pending
    //   },
    //   ...membershipWithAccount
    // });
  }

  async changeAccountName(account_id: number, new_name: string) {

    return await drizzleDB.update(account)
      .set({
        name: new_name
      })
      .where(eq(account.id, account_id))
      .returning()

    // return prisma_client.account.update({
    //   where: { id: account_id },
    //   data: {
    //     name: new_name
    //   }
    // });
  }

  async changeAccountPlan(account_id: number, plan_id: number) {

    const this_plan = await drizzleDB.query.plan.findFirst({
      where: eq(plan.id, plan_id),
    })

    if (!this_plan) {
      throw new Error(`Plan not found for plan id ${plan_id}`);
    }

    // const plan = await prisma_client.plan.findFirstOrThrow({
    //   where: { id: plan_id }
    // });

    return await drizzleDB.update(account)
      .set({
        planId: this_plan.id,
        features: this_plan.features,
        maxNotes: this_plan.maxNotes,
      })
      .where(eq(account.id, account.id))
      .returning()

    // return prisma_client.account.update({
    //   where: { id: account_id },
    //   data: {
    //     plan_id: plan_id,
    //     features: plan.features,
    //     max_notes: plan.max_notes
    //   }
    // });
  }

  async rotateJoinPassword(account_id: number) {
    const join_password: string = generator.generate({
      length: 10,
      numbers: true
    });

    return await drizzleDB.update(account)
      .set({
        joinPassword: join_password,
      })
      .where(eq(account.id, account_id))
      .returning()

    // return prisma_client.account.update({
    //   where: { id: account_id },
    //   data: { join_password }
    // });
  }

  // Claim ownership of an account.
  // User must already be an ADMIN for the Account
  // Existing OWNER memberships are downgraded to ADMIN
  // In future, some sort of Billing/Stripe tie in here e.g. changing email details on the Account, not sure.
  // async claimOwnershipOfAccount(
  //   user_id: number,
  //   account_id: number
  // ): Promise<MembershipWithUser[]> {
  //   const membership = await prisma_client.membership.findUniqueOrThrow({
  //     where: {
  //       user_id_account_id: {
  //         user_id: user_id,
  //         account_id: account_id
  //       }
  //     }
  //   });

  //   if (membership.access === ACCOUNT_ACCESS.OWNER) {
  //     throw new Error('BADREQUEST: user is already owner');
  //   } else if (membership.access !== ACCOUNT_ACCESS.ADMIN) {
  //     throw new Error('UNAUTHORISED: only Admins can claim ownership');
  //   }

  //   const existing_owner_memberships = await prisma_client.membership.findMany({
  //     where: {
  //       account_id: account_id,
  //       access: ACCOUNT_ACCESS.OWNER
  //     }
  //   });

  //   for (const existing_owner_membership of existing_owner_memberships) {
  //     await prisma_client.membership.update({
  //       where: {
  //         user_id_account_id: {
  //           user_id: existing_owner_membership.user_id,
  //           account_id: account_id
  //         }
  //       },
  //       data: {
  //         access: ACCOUNT_ACCESS.ADMIN // Downgrade OWNER to ADMIN
  //       }
  //     });
  //   }

  //   // finally update the ADMIN member to OWNER
  //   await prisma_client.membership.update({
  //     where: {
  //       user_id_account_id: {
  //         user_id: user_id,
  //         account_id: account_id
  //       }
  //     },
  //     data: {
  //       access: ACCOUNT_ACCESS.OWNER
  //     }
  //   });

  //   // return the full membership list because 2 members have changed.
  //   // return prisma_client.membership.findMany({
  //   //   where: { account_id },
  //   //   ...membershipWithUser
  //   // });
  //   console.error('TODO: return the full membership list because 2 members have changed.');
  // }

  // Upgrade access of a membership.  Cannot use this method to upgrade to or downgrade from OWNER access
  async changeUserAccessWithinAccount(
    user_id: number,
    account_id: number,
    access: ACCOUNT_ACCESS
  ) {
    if (access === ACCOUNT_ACCESS.OWNER) {
      throw new Error(
        'UNABLE TO UPDATE MEMBERSHIP: use claimOwnershipOfAccount method to change ownership'
      );
    }

    const this_membership = await drizzleDB.query.membership.findFirst({
      where: (membership) => eq(membership.userId, user_id) && eq(membership.accountId, account_id),
    })
    if (!this_membership) {
      throw new Error(`Membership does not exist for user ${user_id} and account ${account_id}`);
    }

    // const membership = await prisma_client.membership.findUniqueOrThrow({
    //   where: {
    //     user_id_account_id: {
    //       user_id: user_id,
    //       account_id: account_id
    //     }
    //   }
    // });

    if (this_membership.access === ACCOUNT_ACCESS.OWNER) {
      throw new Error(
        'UNABLE TO UPDATE MEMBERSHIP: use claimOwnershipOfAccount method to change ownership'
      );
    }
    // if (membership.access === ACCOUNT_ACCESS.OWNER) {
    //   throw new Error(
    //     'UNABLE TO UPDATE MEMBERSHIP: use claimOwnershipOfAccount method to change ownership'
    //   );
    // }

    const updatedMembershipId: { updatedId: number }[] = await drizzleDB.update(membership)
      .set({ access })
      .where(eq(membership.userId, user_id) && eq(membership.accountId, account_id))
      .returning({ updatedId: membership.id });

    // Retrieve the updated membership
    const updatedMembershipWithAccount = await drizzleDB.query.membership.findFirst({
      where: (membership) => eq(membership.id, updatedMembershipId[0].updatedId),
      with: {
        account: true,
      }
    })

    return updatedMembershipWithAccount as MembershipWithAccount

    // return prisma_client.membership.update({
    //   where: {
    //     user_id_account_id: {
    //       user_id: user_id,
    //       account_id: account_id
    //     }
    //   },
    //   data: {
    //     access: access
    //   },
    //   include: {
    //     account: true
    //   }
    // });
  }

  /*
  **** Usage Limit Checking *****
  This is trickier than you might think at first.  Free plan users don't get a webhook from Stripe
  that we can use to tick over their period end date and associated usage counts.  I also didn't
  want to require an additional background thread to do the rollover processing.

  getAccountWithPeriodRollover: retrieves an account record and does the rollover checking returning up to date account info
  checkAIGenCount: retrieves the account using getAccountWithPeriodRollover, checks the count and returns the account
  incrementAIGenCount: increments the counter using the account.  Note that passing in the account avoids another db fetch for the account.

  Note.. for each usage limit, you will need another pair of check/increment methods and of course the count and max limit in the account schema

  How to use in a service method....
  async someServiceMethod(account_id: number, .....etc) {
    const accountService = new AccountService();
    const account = await accountService.checkAIGenCount(account_id);
    ... User is under the limit so do work
    await accountService.incrementAIGenCount(account);
  }
  */

  // async getAccountWithPeriodRollover(account_id: number) {
  //   const account = await prisma_client.account.findFirstOrThrow({
  //     where: { id: account_id }
  //   });

  //   if (
  //     account.plan_name === config.initialPlanName &&
  //     account.current_period_ends < new Date()
  //   ) {
  //     return await prisma_client.account.update({
  //       where: { id: account.id },
  //       data: {
  //         current_period_ends: UtilService.addMonths(
  //           account.current_period_ends,
  //           1
  //         ),
  //         // reset anything that is affected by the rollover
  //         ai_gen_count: 0
  //       }
  //     });
  //   }

  //   return account;
  // }

  // async checkAIGenCount(account_id: number) {
  //   const account = await this.getAccountWithPeriodRollover(account_id);

  //   if (account.ai_gen_count >= account.ai_gen_max_pm) {
  //     throw new AccountLimitError(
  //       'Monthly AI gen limit reached, no new AI Generations can be made'
  //     );
  //   }

  //   return account;
  // }

  // async incrementAIGenCount(account: any) {
  //   return await prisma_client.account.update({
  //     where: { id: account.id },
  //     data: {
  //       ai_gen_count: account.ai_gen_count + 1
  //     }
  //   });
  // }
}
