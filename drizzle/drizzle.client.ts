import * as schema from './schema'
import * as relations from './relations'
import * as enums from './enums'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
const connectionString = process.env.DATABASE_URL as string
const client = postgres(connectionString)
export const db = drizzle(client, { schema: { ...schema, ...relations, ...enums } })