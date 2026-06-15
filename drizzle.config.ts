import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: ['./src/lib/server/db/schema.ts', './src/lib/server/db/relations.ts'],
	out: './drizzle',
	dialect: 'postgresql',
	// '' permite rodar db:generate sem .env (generate não precisa conectar ao banco).
	// db:push e db:migrate falharão com URL inválida — é o comportamento correto.
	dbCredentials: { url: process.env.DATABASE_URL ?? '' },
	schemaFilter: ['producaosia'],
	verbose: true,
	strict: true
});
