/**
 * Aplica (ou recria) as VIEWs no banco a partir dos arquivos SQL versionados.
 * Rodar após cada migração de schema e sempre que uma VIEW for alterada.
 *
 * Uso:
 *   npx tsx scripts/apply-views.ts
 */

import 'dotenv/config';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VIEWS_DIR = resolve(__dirname, '..', 'src', 'lib', 'server', 'db', 'views');

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL não definida. Crie o arquivo .env e configure a URL do Neon.');
}

const sql = postgres(process.env.DATABASE_URL, {
	max: 1,
	ssl: 'require',
	connection: { search_path: 'producaosia' }
});

const VIEW_FILES = [
	'vw_estabelecimentos_exibicao.sql',
	'vw_producao_classificada.sql',
	'vw_glosas.sql'
];

async function main() {
	console.log('\n▶ Aplicando VIEWs...\n');

	for (const file of VIEW_FILES) {
		const path = resolve(VIEWS_DIR, file);
		const ddl = readFileSync(path, 'utf-8');
		await sql.unsafe(ddl);
		console.log(`  ✓ ${file}`);
	}

	console.log('\n✓ VIEWs aplicadas.\n');
	await sql.end();
}

main().catch(async (err) => {
	console.error('\n✗', err.message);
	await sql.end();
	process.exit(1);
});
