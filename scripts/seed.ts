/**
 * Script de carga inicial dos CSVs no banco.
 * Ordem de dependência: Nível 0 → 0t → 1 → 2
 *
 * Uso:
 *   npx tsx scripts/seed.ts            (requer .env na raiz)
 *   node --env-file=.env --experimental-strip-types scripts/seed.ts
 */

import 'dotenv/config';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = resolve(__dirname, '..', 'seed');

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL não definida. Crie o arquivo .env e configure a URL do Neon.');
}

const sql = postgres(process.env.DATABASE_URL, {
	max: 1,
	ssl: 'require',
	connection: { search_path: 'producaosia' }
});

// ─── CSV parser ───────────────────────────────────────────────────────────────

type Row = Record<string, string | null>;

function parseCsvLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (ch === ',' && !inQuotes) {
			result.push(current);
			current = '';
		} else {
			current += ch;
		}
	}
	result.push(current);
	return result;
}

function parseCsv(filename: string): Row[] {
	const content = readFileSync(resolve(SEED_DIR, filename), 'utf-8');
	const lines = content.trim().split(/\r?\n/);
	if (lines.length < 2) return [];

	const headers = parseCsvLine(lines[0]);
	return lines
		.slice(1)
		.filter((line) => line.trim())
		.map((line) => {
			const values = parseCsvLine(line);
			return Object.fromEntries(
				headers.map((h, i) => {
					const v = values[i] ?? '';
					// Valores vazios → null (exceto campos onde '' tem semântica própria,
					// tratados individualmente nas funções de carga).
					return [h, v === '' ? null : v];
				})
			);
		});
}

// ─── Batch insert ─────────────────────────────────────────────────────────────

async function batchInsert(
	tableName: string,
	rows: Record<string, unknown>[],
	chunkSize = 500
): Promise<number> {
	if (!rows.length) return 0;
	let inserted = 0;

	for (let i = 0; i < rows.length; i += chunkSize) {
		const chunk = rows.slice(i, i + chunkSize);
		await sql`INSERT INTO ${sql(tableName)} ${sql(chunk)} ON CONFLICT DO NOTHING`;
		inserted += chunk.length;
	}
	return inserted;
}

// ─── Pré-voo anti-órfão ───────────────────────────────────────────────────────
// Verifica se todos os pares (cod_cnes, competencia) do CSV de entrada
// têm correspondência exata em estabelecimentos. Aborta se faltar algum.

async function checkOrphans(
	label: string,
	rows: { cod_cnes: string; competencia: string }[]
): Promise<void> {
	const pares = [...new Map(rows.map((r) => [`${r.cod_cnes}|${r.competencia}`, r])).values()];

	const cnes = pares.map((p) => p.cod_cnes);
	const comps = pares.map((p) => p.competencia);

	const orphans = await sql<{ cnes: string; comp: string }[]>`
    SELECT u.cnes, u.comp::text
    FROM   unnest(${sql.array(cnes)}::text[], ${sql.array(comps)}::date[]) AS u(cnes, comp)
    LEFT   JOIN estabelecimentos e
           ON  e.cod_cnes    = u.cnes
           AND e.competencia = u.comp::date
    WHERE  e.cod_cnes IS NULL
  `;

	if (orphans.length > 0) {
		console.error(`\n✗ PRÉ-VOO ${label}: ${orphans.length} par(es) sem registro em estabelecimentos:`);
		orphans.forEach((o) => console.error(`    CNES ${o.cnes} | ${o.comp}`));
		await sql.end();
		process.exit(1);
	}

	console.log(`  pré-voo ${label}: OK (${pares.length} par(es) verificado(s))`);
}

// ─── Nível 0: Referência ──────────────────────────────────────────────────────

async function seedCbo() {
	const rows = parseCsv('cbo.csv').map((r) => ({
		cod_cbo: r.cod_cbo!,
		descricao: r.descricao!
	}));
	const n = await batchInsert('cbo', rows);
	console.log(`  cbo: ${n} linha(s)`);
}

async function seedProcedimentos() {
	const rows = parseCsv('procedimentos.csv').map((r) => ({
		cod_proced: r.cod_proced!,
		descricao: r.descricao!
	}));
	const n = await batchInsert('procedimentos', rows);
	console.log(`  procedimentos: ${n} linha(s)`);
}

async function seedNomesCurtos() {
	const rows = parseCsv('nomes_curtos.csv').map((r) => ({
		cod_cnes: r.cod_cnes!,
		nome_curto: r.nome_curto!,
		nome_oficial: r.nome_oficial ?? null
	}));
	const n = await batchInsert('nomes_curtos', rows);
	console.log(`  nomes_curtos: ${n} linha(s)`);
}

async function seedCbosAps() {
	const rows = parseCsv('cbos_aps.csv').map((r) => ({
		cod_cbo: r.cod_cbo!,
		descricao: r.descricao ?? null
	}));
	const n = await batchInsert('cbos_aps', rows);
	console.log(`  cbos_aps: ${n} linha(s)`);
}

// ─── Nível 0t: Estabelecimentos (temporal) ────────────────────────────────────

async function seedEstabelecimentos() {
	const rows = parseCsv('estabelecimentos.csv').map((r) => ({
		cod_cnes: r.cod_cnes!,
		competencia: r.competencia!,
		nome_fantasia: r.nome_fantasia!,
		cnpj: r.cnpj ?? null,
		tipo_estabelecimento: r.tipo_estabelecimento ?? null,
		nivel_atencao: r.nivel_atencao ?? null,
		status: r.status ?? null,
		telefone: r.telefone ?? null,
		diretor: r.diretor ?? null,
		location: r.location ?? null
	}));
	const n = await batchInsert('estabelecimentos', rows);
	console.log(`  estabelecimentos: ${n} linha(s)`);
}

// ─── Nível 1: Agrupamentos + vínculos ─────────────────────────────────────────

async function seedAgrupamentos() {
	const rows = parseCsv('agrupamentos_limpo.csv').map((r) => ({
		cod_proced: r.cod_proced!,
		cod_cbo: r.cod_cbo!,
		natureza: r.natureza!,
		especialidade: r.especialidade ?? null,
		nivel_atencao: r.nivel_atencao!
	}));
	const n = await batchInsert('agrupamentos', rows);
	console.log(`  agrupamentos: ${n} linha(s)`);
}

async function seedProfissionaisVinculos() {
	const rawRows = parseCsv('profissionais_vinculos.csv');

	const forCheck = rawRows.map((r) => ({
		cod_cnes: r.cod_cnes!,
		competencia: r.competencia!
	}));
	await checkOrphans('profissionais_vinculos', forCheck);

	const rows = rawRows.map((r) => ({
		cod_cnes: r.cod_cnes!,
		competencia: r.competencia!,
		profissional_nome: r.profissional_nome!,
		cns: r.cns!,
		cod_cbo: r.cod_cbo!,
		ch_ambulatorial_sus: r.ch_ambulatorial_sus != null ? parseInt(r.ch_ambulatorial_sus) : null,
		ch_hospitalar_sus: r.ch_hospitalar_sus != null ? parseInt(r.ch_hospitalar_sus) : null,
		ch_outros: r.ch_outros != null ? parseInt(r.ch_outros) : null,
		vinculo: r.vinculo ?? null,
		equipe_nome: r.equipe_nome ?? null,
		equipe_ine: r.equipe_ine ?? null,
		equipe_tipo: r.equipe_tipo ?? null
	}));
	const n = await batchInsert('profissionais_vinculos', rows);
	console.log(`  profissionais_vinculos: ${n} linha(s)`);
}

// ─── Nível 2: Produção (fato) ─────────────────────────────────────────────────

async function seedProducaoSia() {
	const rawRows = parseCsv('producao_sia.csv');

	const forCheck = rawRows.map((r) => ({
		cod_cnes: r.cod_cnes!,
		competencia: r.competencia!
	}));
	await checkOrphans('producao_sia', forCheck);

	const rows = rawRows.map((r) => ({
		cod_cnes: r.cod_cnes!,
		competencia: r.competencia!,
		cod_proced: r.cod_proced!,
		cod_cbo: r.cod_cbo!,
		qtd_apresentada: parseInt(r.qtd_apresentada!),
		qtd_aprovada: parseInt(r.qtd_aprovada!),
		val_apresentado: r.val_apresentado ?? null,
		val_aprovado: r.val_aprovado ?? null,
		// null do parser → '' (aprovado totalmente; '' é a sentinela de não-glosa)
		situacao: r.situacao ?? ''
		// is_glosada: omitido — coluna GENERATED ALWAYS
	}));
	const n = await batchInsert('producao_sia', rows);
	console.log(`  producao_sia: ${n} linha(s)`);
}

// ─── Orquestração ─────────────────────────────────────────────────────────────

async function main() {
	console.log('\n▶ Carga — Nível 0: referência');
	await seedCbo();
	await seedProcedimentos();
	await seedNomesCurtos();
	await seedCbosAps();

	console.log('\n▶ Carga — Nível 0t: estabelecimentos');
	await seedEstabelecimentos();

	console.log('\n▶ Carga — Nível 1: agrupamentos + vínculos');
	await seedAgrupamentos();
	await seedProfissionaisVinculos();

	console.log('\n▶ Carga — Nível 2: produção');
	await seedProducaoSia();

	console.log('\n✓ Carga concluída.\n');
	await sql.end();
}

main().catch(async (err) => {
	console.error('\n✗', err.message);
	await sql.end();
	process.exit(1);
});
