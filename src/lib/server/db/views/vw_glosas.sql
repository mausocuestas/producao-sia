-- vw_glosas
-- Somente registros com motivo de glosa preenchido (is_glosada = true,
-- equivalente a situacao IS NOT NULL AND situacao <> '').
-- Inclui nome do estabelecimento por vigência e descrições dos catálogos.
-- Colunas financeiras (val_*) EXCLUÍDAS intencionalmente.
CREATE OR REPLACE VIEW producaosia.vw_glosas AS
SELECT
    p.id,
    p.cod_cnes,
    p.competencia,
    p.cod_proced,
    p.cod_cbo,
    p.qtd_apresentada,
    p.qtd_aprovada,
    p.situacao,

    COALESCE(nc.nome_curto, e.nome_fantasia)  AS nome_estabelecimento,
    proc.descricao  AS desc_procedimento,
    c.descricao     AS desc_cbo

FROM producaosia.producao_sia p

INNER JOIN LATERAL (
    SELECT e2.nome_fantasia
    FROM   producaosia.estabelecimentos e2
    WHERE  e2.cod_cnes    = p.cod_cnes
      AND  e2.competencia <= p.competencia
    ORDER  BY e2.competencia DESC
    LIMIT  1
) e ON true

LEFT JOIN producaosia.nomes_curtos  nc   ON nc.cod_cnes    = p.cod_cnes
LEFT JOIN producaosia.procedimentos proc ON proc.cod_proced = p.cod_proced
LEFT JOIN producaosia.cbo           c    ON c.cod_cbo       = p.cod_cbo

WHERE p.is_glosada = true;
