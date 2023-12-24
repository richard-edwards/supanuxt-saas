import { pgTable, pgEnum, serial, text, uniqueIndex, foreignKey, timestamp, integer, boolean } from "drizzle-orm/pg-core"
import { sql, relations, } from "drizzle-orm"

export const accountAccess = pgEnum("ACCOUNT_ACCESS", ['OWNER', 'ADMIN', 'READ_WRITE', 'READ_ONLY'])

export const user = pgTable("users", {
	id: serial("id").primaryKey().notNull(),
	supabase_uid: text("supabase_uid").notNull(),
	email: text("email"),
	display_name: text("display_name"),
});

export const account = pgTable("account", {
	id: serial("id").primaryKey().notNull(),
	name: text("name").notNull(),
	current_period_ends: timestamp("current_period_ends", { precision: 3, mode: 'string' }).defaultNow().notNull(),
	features: text("features").array(),
	plan_id: integer("plan_id").notNull().references(() => plan.id, { onDelete: "restrict", onUpdate: "cascade" }),
	plan_name: text("plan_name").notNull(),
	max_notes: integer("max_notes").default(100).notNull(),
	stripe_subscription_id: text("stripe_subscription_id"),
	stripe_customer_id: text("stripe_customer_id"),
	max_members: integer("max_members").default(1).notNull(),
	join_password: text("join_password").notNull(),
	ai_gen_max_pm: integer("ai_gen_max_pm").default(7).notNull(),
	ai_gen_count: integer("ai_gen_count").default(0).notNull(),
},
	(table) => {
		return {
			join_passwordKey: uniqueIndex("account_join_password_key").on(table.join_password),
		}
	});

export const membership = pgTable("membership", {
	id: serial("id").primaryKey().notNull(),
	user_id: integer("user_id").notNull().references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" }),
	account_id: integer("account_id").notNull().references(() => account.id, { onDelete: "restrict", onUpdate: "cascade" }),
	access: accountAccess("access").default('READ_ONLY').notNull(),
	pending: boolean("pending").default(false).notNull(),
},
	(table) => {
		return {
			user_idAccountIdKey: uniqueIndex("membership_user_id_account_id_key").on(table.user_id, table.account_id),
		}
	});

export const plan = pgTable("plan", {
	id: serial("id").primaryKey().notNull(),
	name: text("name").notNull(),
	features: text("features").array(),
	max_notes: integer("max_notes").default(100).notNull(),
	stripe_product_id: text("stripe_product_id"),
	max_members: integer("max_members").default(1).notNull(),
	ai_gen_max_pm: integer("ai_gen_max_pm").default(7).notNull(),
},
	(table) => {
		return {
			nameKey: uniqueIndex("plan_name_key").on(table.name),
		}
	});

export const note = pgTable("note", {
	id: serial("id").primaryKey().notNull(),
	account_id: integer("account_id").references(() => account.id, { onDelete: "set null", onUpdate: "cascade" }),
	note_text: text("note_text").notNull(),
});

