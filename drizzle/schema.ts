import { pgTable, pgEnum, serial, text, uniqueIndex, foreignKey, timestamp, integer, boolean } from "drizzle-orm/pg-core"
import { sql, relations, } from "drizzle-orm"

export const keyStatus = pgEnum("key_status", ['expired', 'invalid', 'valid', 'default'])
export const keyType = pgEnum("key_type", ['stream_xchacha20', 'secretstream', 'secretbox', 'kdf', 'generichash', 'shorthash', 'auth', 'hmacsha256', 'hmacsha512', 'aead-det', 'aead-ietf'])
export const requestStatus = pgEnum("request_status", ['ERROR', 'SUCCESS', 'PENDING'])
export const factorType = pgEnum("factor_type", ['webauthn', 'totp'])
export const factorStatus = pgEnum("factor_status", ['verified', 'unverified'])
export const aalLevel = pgEnum("aal_level", ['aal3', 'aal2', 'aal1'])
export const codeChallengeMethod = pgEnum("code_challenge_method", ['plain', 's256'])
export const accountAccess = pgEnum("ACCOUNT_ACCESS", ['OWNER', 'ADMIN', 'READ_WRITE', 'READ_ONLY'])

export const user = pgTable("users", {
	id: serial("id").primaryKey().notNull(),
	supabaseUid: text("supabase_uid").notNull(),
	email: text("email"),
	displayName: text("display_name"),
});

export const account = pgTable("account", {
	id: serial("id").primaryKey().notNull(),
	name: text("name").notNull(),
	currentPeriodEnds: timestamp("current_period_ends", { precision: 3, mode: 'string' }).defaultNow().notNull(),
	features: text("features").array(),
	planId: integer("plan_id").notNull().references(() => plan.id, { onDelete: "restrict", onUpdate: "cascade" }),
	planName: text("plan_name").notNull(),
	maxNotes: integer("max_notes").default(100).notNull(),
	stripeSubscriptionId: text("stripe_subscription_id"),
	stripeCustomerId: text("stripe_customer_id"),
	maxMembers: integer("max_members").default(1).notNull(),
	joinPassword: text("join_password").notNull(),
	aiGenMaxPm: integer("ai_gen_max_pm").default(7).notNull(),
	aiGenCount: integer("ai_gen_count").default(0).notNull(),
},
	(table) => {
		return {
			joinPasswordKey: uniqueIndex("account_join_password_key").on(table.joinPassword),
		}
	});

export const membership = pgTable("membership", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id").notNull().references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" }),
	accountId: integer("account_id").notNull().references(() => account.id, { onDelete: "restrict", onUpdate: "cascade" }),
	access: accountAccess("access").default('READ_ONLY').notNull(),
	pending: boolean("pending").default(false).notNull(),
},
	(table) => {
		return {
			userIdAccountIdKey: uniqueIndex("membership_user_id_account_id_key").on(table.userId, table.accountId),
		}
	});

export const plan = pgTable("plan", {
	id: serial("id").primaryKey().notNull(),
	name: text("name").notNull(),
	features: text("features").array(),
	maxNotes: integer("max_notes").default(100).notNull(),
	stripeProductId: text("stripe_product_id"),
	maxMembers: integer("max_members").default(1).notNull(),
	aiGenMaxPm: integer("ai_gen_max_pm").default(7).notNull(),
},
	(table) => {
		return {
			nameKey: uniqueIndex("plan_name_key").on(table.name),
		}
	});

export const note = pgTable("note", {
	id: serial("id").primaryKey().notNull(),
	accountId: integer("account_id").references(() => account.id, { onDelete: "set null", onUpdate: "cascade" }),
	note_text: text("note_text").notNull(),
});

