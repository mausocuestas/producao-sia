import {
	pgSchema,
	integer,
	text,
	boolean,
	date,
	numeric,
	index,
	uniqueIndex,
	unique,
	foreignKey,
	check
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const producaosia = pgSchema('producaosia');

// ─── Nível 0: Referência (não-temporal) ──────────────────────────────────────

export const cbo = producaosia.table('cbo', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	cod_cbo: text('cod_cbo').notNull().unique('uq_cbo_cod_cbo'),
	descricao: text('descricao').notNull()
});

export const procedimentos = producaosia.table('procedimentos', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	cod_proced: text('cod_proced').notNull().unique('uq_procedimentos_cod_proced'),
	descricao: text('descricao').notNull()
});

export const nomes_curtos = producaosia.table('nomes_curtos', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	cod_cnes: text('cod_cnes').notNull().unique('uq_nomes_curtos_cod_cnes'),
	nome_curto: text('nome_curto').notNull(),
	nome_oficial: text('nome_oficial')
});

export const cbos_aps = producaosia.table(
	'cbos_aps',
	{
		id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
		cod_cbo: text('cod_cbo').notNull().unique('uq_cbos_aps_cod_cbo'),
		descricao: text('descricao')
	},
	(t) => [
		foreignKey({
			columns: [t.cod_cbo],
			foreignColumns: [cbo.cod_cbo],
			name: 'fk_cbos_aps_cbo'
		}).onDelete('restrict')
	]
);

export const agrupamentos = producaosia.table(
	'agrupamentos',
	{
		id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
		cod_proced: text('cod_proced').notNull(),
		cod_cbo: text('cod_cbo').notNull(),
		natureza: text('natureza').notNull(),
		especialidade: text('especialidade'),
		nivel_atencao: text('nivel_atencao').notNull()
	},
	(t) => [
		uniqueIndex('uq_agrupamentos_proced_cbo').on(t.cod_proced, t.cod_cbo),
		index('idx_agrupamentos_cod_proced').on(t.cod_proced),
		index('idx_agrupamentos_cod_cbo').on(t.cod_cbo),
		foreignKey({
			columns: [t.cod_proced],
			foreignColumns: [procedimentos.cod_proced],
			name: 'fk_agrupamentos_procedimentos'
		}).onDelete('restrict'),
		foreignKey({
			columns: [t.cod_cbo],
			foreignColumns: [cbo.cod_cbo],
			name: 'fk_agrupamentos_cbo'
		}).onDelete('restrict'),
		check(
			'chk_agrupamentos_natureza',
			sql`natureza IN (
        'Procedimento',
        'Exame Laboratorial',
        'Exame de Imagem / Diagnóstico',
        'Consulta',
        'Testes Rápidos e POCT',
        'Procedimento Odontológico',
        'Ações Coletivas e Educativas',
        'Ações de Rede e Matriciamento',
        'Acolhimento, Visita e Intervenção Territorial',
        'Materiais e OPMEs'
      )`
		),
		check(
			'chk_agrupamentos_nivel_atencao',
			sql`nivel_atencao IN (
        'APS', 'ESPECIALIZADA', 'URGENCIA', 'HOSPITALAR',
        'APOIO_DIAGNOSTICO', 'VIGILANCIA', 'TFD', 'CONTEXTUAL'
      )`
		)
	]
);

// ─── Nível 0t: Temporal — foto mensal ─────────────────────────────────────────
// JOIN de produção usa vigência: competência mais recente ≤ competência da produção.

export const estabelecimentos = producaosia.table(
	'estabelecimentos',
	{
		id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
		cod_cnes: text('cod_cnes').notNull(),
		competencia: date('competencia').notNull(),
		nome_fantasia: text('nome_fantasia').notNull(),
		cnpj: text('cnpj'),
		tipo_estabelecimento: text('tipo_estabelecimento'),
		nivel_atencao: text('nivel_atencao'),
		status: text('status'),
		telefone: text('telefone'),
		diretor: text('diretor'),
		location: text('location')
	},
	(t) => [
		unique('uq_estabelecimentos_cnes_comp').on(t.cod_cnes, t.competencia),
		index('idx_estabelecimentos_cod_cnes').on(t.cod_cnes),
		index('idx_estabelecimentos_competencia').on(t.competencia)
	]
);

// ─── Nível 1: Temporal — depende de estabelecimentos + cbo ───────────────────

export const profissionais_vinculos = producaosia.table(
	'profissionais_vinculos',
	{
		id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
		cod_cnes: text('cod_cnes').notNull(),
		competencia: date('competencia').notNull(),
		profissional_nome: text('profissional_nome').notNull(),
		cns: text('cns').notNull(),
		cod_cbo: text('cod_cbo').notNull(),
		ch_ambulatorial_sus: integer('ch_ambulatorial_sus'),
		ch_hospitalar_sus: integer('ch_hospitalar_sus'),
		ch_outros: integer('ch_outros'),
		vinculo: text('vinculo'),
		equipe_nome: text('equipe_nome'),
		equipe_ine: text('equipe_ine'),
		equipe_tipo: text('equipe_tipo')
	},
	(t) => [
		uniqueIndex('uq_profissionais_vinculos').on(t.cod_cnes, t.cod_cbo, t.cns, t.competencia),
		index('idx_profissionais_vinculos_cnes_comp').on(t.cod_cnes, t.competencia),
		index('idx_profissionais_vinculos_cns').on(t.cns),
		index('idx_profissionais_vinculos_cod_cbo').on(t.cod_cbo),
		foreignKey({
			columns: [t.cod_cnes, t.competencia],
			foreignColumns: [estabelecimentos.cod_cnes, estabelecimentos.competencia],
			name: 'fk_profissionais_vinculos_estabelecimentos'
		}).onDelete('restrict'),
		foreignKey({
			columns: [t.cod_cbo],
			foreignColumns: [cbo.cod_cbo],
			name: 'fk_profissionais_vinculos_cbo'
		}).onDelete('restrict')
	]
);

// ─── Nível 2: Fato — produção ─────────────────────────────────────────────────
// FK só para procedimentos e cbo — NUNCA para agrupamentos.
// situacao = '' para aprovado totalmente; motivo de glosa para demais.
// is_glosada é calculada pelo banco; nunca enviar no INSERT.

export const producao_sia = producaosia.table(
	'producao_sia',
	{
		id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
		cod_cnes: text('cod_cnes').notNull(),
		competencia: date('competencia').notNull(),
		cod_proced: text('cod_proced').notNull(),
		cod_cbo: text('cod_cbo').notNull(),
		qtd_apresentada: integer('qtd_apresentada').notNull(),
		qtd_aprovada: integer('qtd_aprovada').notNull(),
		val_apresentado: numeric('val_apresentado', { precision: 12, scale: 2 }),
		val_aprovado: numeric('val_aprovado', { precision: 12, scale: 2 }),
		situacao: text('situacao'),
		is_glosada: boolean('is_glosada').generatedAlwaysAs(
			sql`situacao IS NOT NULL AND situacao <> ''`,
			{ mode: 'stored' }
		)
	},
	(t) => [
		uniqueIndex('uq_producao_sia').on(
			t.cod_cnes,
			t.cod_proced,
			t.cod_cbo,
			t.competencia,
			t.situacao
		),
		index('idx_producao_sia_cnes_comp').on(t.cod_cnes, t.competencia),
		index('idx_producao_sia_cod_proced').on(t.cod_proced),
		index('idx_producao_sia_cod_cbo').on(t.cod_cbo),
		index('idx_producao_sia_competencia').on(t.competencia),
		foreignKey({
			columns: [t.cod_cnes, t.competencia],
			foreignColumns: [estabelecimentos.cod_cnes, estabelecimentos.competencia],
			name: 'fk_producao_sia_estabelecimentos'
		}).onDelete('restrict'),
		foreignKey({
			columns: [t.cod_proced],
			foreignColumns: [procedimentos.cod_proced],
			name: 'fk_producao_sia_procedimentos'
		}).onDelete('restrict'),
		foreignKey({
			columns: [t.cod_cbo],
			foreignColumns: [cbo.cod_cbo],
			name: 'fk_producao_sia_cbo'
		}).onDelete('restrict')
	]
);
