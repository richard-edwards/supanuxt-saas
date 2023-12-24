import { defineEventHandler, parseCookies, setCookie, getCookie } from 'h3';
import { serverSupabaseUser } from '#supabase/server';
import AuthService from '~/lib/services/auth.service';
import { ACCOUNT_ACCESS } from '~~/lib/services/service.types';

import { User } from '@supabase/supabase-js';
import type { FullDBUser } from '~~/lib/services/service.types';

// Explicitly type our context by 'Merging' our custom types with the H3EventContext (https://stackoverflow.com/a/76349232/95242)
declare module 'h3' {
  interface H3EventContext {
    user?: User; // the Supabase User
    dbUser?: FullDBUser; // the corresponding Database User
    activeAccountId?: number; // the account ID that is active for the user
  }
}

export default defineEventHandler(async event => {
  if (
    !(event.path.startsWith('/api/trpc') || event.path.startsWith('/api/note'))
  ) {
    return; // only apply middleware to working routes
  }

  const cookies = parseCookies(event);
  if (cookies && cookies['sb-access-token']) {
    const user = await serverSupabaseUser(event);
    if (user) {
      event.context.user = user;

      const authService = new AuthService();
      let dbUser = await authService.getFullUserBySupabaseId(user.id);

      if (!dbUser && user) {
        dbUser = await authService.createUser(
          user.id,
          user.user_metadata.full_name
            ? user.user_metadata.full_name
            : 'no name supplied',
          user.email ? user.email : 'no@email.supplied'
        );
        console.log(`\n Created DB User \n ${JSON.stringify(dbUser)}\n`)
      }

      if (dbUser) {
        console.log(`\n Found DB User \n ${JSON.stringify(dbUser)}\n`)
        console.log(`\n Event \n ${JSON.stringify(event)}\n`)

        event.context.dbUser = dbUser;
        let activeAccountId;
        const preferredAccountId = getCookie(
          event,
          'preferred-active-account-id'
        );
        if (
          preferredAccountId &&
          dbUser?.memberships.find(
            m => m.accountId === +preferredAccountId && !m.pending
          )
        ) {
          activeAccountId = +preferredAccountId;
        } else {
          const defaultActive = dbUser.memberships[0].accountId.toString();
          setCookie(event, 'preferred-active-account-id', defaultActive, {
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10)
          });
          activeAccountId = +defaultActive;
        }
        if (activeAccountId) {
          event.context.activeAccountId = activeAccountId;
        }
      }
    }
  }
});
