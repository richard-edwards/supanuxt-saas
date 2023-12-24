import { pgEnum } from "drizzle-orm/pg-core"
import { z } from 'zod';

export const accountAccess = pgEnum("ACCOUNT_ACCESS", ['OWNER', 'ADMIN', 'READ_WRITE', 'READ_ONLY'])

export const ACCOUNT_ACCESS = z.enum(accountAccess.enumValues).Enum
