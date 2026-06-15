import { relations } from 'drizzle-orm';
import {
	cbo,
	cbos_aps,
	agrupamentos,
	estabelecimentos,
	profissionais_vinculos,
	procedimentos,
	producao_sia
} from './schema';

export const cboRelations = relations(cbo, ({ many }) => ({
	cbos_aps: many(cbos_aps),
	agrupamentos: many(agrupamentos),
	profissionais_vinculos: many(profissionais_vinculos),
	producao_sia: many(producao_sia)
}));

export const cbosApsRelations = relations(cbos_aps, ({ one }) => ({
	cbo: one(cbo, {
		fields: [cbos_aps.cod_cbo],
		references: [cbo.cod_cbo]
	})
}));

export const procedimentosRelations = relations(procedimentos, ({ many }) => ({
	agrupamentos: many(agrupamentos),
	producao_sia: many(producao_sia)
}));

export const agrupamentosRelations = relations(agrupamentos, ({ one }) => ({
	procedimento: one(procedimentos, {
		fields: [agrupamentos.cod_proced],
		references: [procedimentos.cod_proced]
	}),
	cbo: one(cbo, {
		fields: [agrupamentos.cod_cbo],
		references: [cbo.cod_cbo]
	})
}));

export const estabelecimentosRelations = relations(estabelecimentos, ({ many }) => ({
	profissionais_vinculos: many(profissionais_vinculos),
	producao_sia: many(producao_sia)
}));

export const profissionaisVinculosRelations = relations(profissionais_vinculos, ({ one }) => ({
	estabelecimento: one(estabelecimentos, {
		fields: [profissionais_vinculos.cod_cnes, profissionais_vinculos.competencia],
		references: [estabelecimentos.cod_cnes, estabelecimentos.competencia]
	}),
	cbo: one(cbo, {
		fields: [profissionais_vinculos.cod_cbo],
		references: [cbo.cod_cbo]
	})
}));

export const producaoSiaRelations = relations(producao_sia, ({ one }) => ({
	estabelecimento: one(estabelecimentos, {
		fields: [producao_sia.cod_cnes, producao_sia.competencia],
		references: [estabelecimentos.cod_cnes, estabelecimentos.competencia]
	}),
	procedimento: one(procedimentos, {
		fields: [producao_sia.cod_proced],
		references: [procedimentos.cod_proced]
	}),
	cbo: one(cbo, {
		fields: [producao_sia.cod_cbo],
		references: [cbo.cod_cbo]
	})
}));
