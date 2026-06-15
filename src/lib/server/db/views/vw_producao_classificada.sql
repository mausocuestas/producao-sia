-- vw_producao_classificada
-- Cada linha de producao_sia enriquecida com:
--   • nome do estabelecimento via vigência (foto mais recente ≤ competência)
--   • descrições de procedimento e CBO
--   • natureza e especialidade do agrupamento (NULL = par não classificado)
--   • nivel_atencao_efetivo segundo a cascata do dicionário:
--       1. agrupamentos.nivel_atencao se não for CONTEXTUAL
--       2. CONTEXTUAL + CBO em cbos_aps → APS
--       3. CONTEXTUAL + CBO fora de cbos_aps → ESPECIALIZADA
--       4. Sem agrupamento → piso do estabelecimento (CNES texto)
-- Colunas financeiras (val_*) EXCLUÍDAS intencionalmente.
CREATE OR REPLACE VIEW producaosia.vw_producao_classificada AS
SELECT
    p.id,
    p.cod_cnes,
    p.competencia,
    p.cod_proced,
    p.cod_cbo,
    p.qtd_apresentada,
    p.qtd_aprovada,
    p.situacao,
    p.is_glosada,

    -- Estabelecimento via vigência
    COALESCE(nc.nome_curto, e.nome_fantasia)  AS nome_estabelecimento,
    e.tipo_estabelecimento,

    -- Catálogos
    proc.descricao  AS desc_procedimento,
    c.descricao     AS desc_cbo,

    -- Agrupamento (LEFT JOIN — NULL quando par proc+CBO não classificado)
    ag.natureza,
    ag.especialidade,

    -- Nível de atenção efetivo (cascata)
    CASE
        -- Passo 1: nível intrínseco definido e não contextual → usa direto
        WHEN ag.nivel_atencao IS NOT NULL
         AND ag.nivel_atencao <> 'CONTEXTUAL'
            THEN ag.nivel_atencao

        -- Passo 2: CONTEXTUAL + CBO na lista branca APS → APS
        WHEN ag.nivel_atencao = 'CONTEXTUAL'
         AND ca.cod_cbo IS NOT NULL
            THEN 'APS'

        -- Passo 3: CONTEXTUAL + CBO fora da lista → ESPECIALIZADA
        WHEN ag.nivel_atencao = 'CONTEXTUAL'
         AND ca.cod_cbo IS NULL
            THEN 'ESPECIALIZADA'

        -- Passo 4: sem agrupamento → piso do estabelecimento (de-para CNES)
        WHEN e.nivel_atencao LIKE '%01 ATENCAO BASICA%'
            THEN 'APS'
        WHEN e.nivel_atencao LIKE '%HOSPITALAR%'
            THEN 'HOSPITALAR'
        WHEN e.nivel_atencao LIKE '%02%'
          OR e.nivel_atencao LIKE '%04%'
            THEN 'ESPECIALIZADA'

        ELSE 'NÃO CLASSIFICADO'
    END                                       AS nivel_atencao_efetivo

FROM producaosia.producao_sia p

-- Estabelecimento: foto mais recente disponível ≤ competência da produção
INNER JOIN LATERAL (
    SELECT
        e2.nome_fantasia,
        e2.tipo_estabelecimento,
        e2.nivel_atencao
    FROM   producaosia.estabelecimentos e2
    WHERE  e2.cod_cnes    = p.cod_cnes
      AND  e2.competencia <= p.competencia
    ORDER  BY e2.competencia DESC
    LIMIT  1
) e ON true

LEFT JOIN producaosia.nomes_curtos  nc   ON nc.cod_cnes    = p.cod_cnes
LEFT JOIN producaosia.procedimentos proc ON proc.cod_proced = p.cod_proced
LEFT JOIN producaosia.cbo           c    ON c.cod_cbo       = p.cod_cbo
LEFT JOIN producaosia.agrupamentos  ag   ON ag.cod_proced   = p.cod_proced
                                        AND ag.cod_cbo      = p.cod_cbo
LEFT JOIN producaosia.cbos_aps      ca   ON ca.cod_cbo      = p.cod_cbo;
