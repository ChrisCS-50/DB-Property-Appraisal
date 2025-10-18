-- Create/replace a summary view that joins several tables
DROP VIEW IF EXISTS "v_property_summary";

CREATE OR REPLACE VIEW "v_property_summary" AS
SELECT
  p.id,
  p.folio,
  p.address,
  p."landValue"      AS land_value,
  p."buildingValue"  AS building_value,
  p."updatedAt"      AS updated_at,
  o.name             AS owner_name,
  o.email            AS owner_email,
  n.code             AS neighborhood_code,
  n.name             AS neighborhood_name,
  a."year"           AS latest_year,
  a."marketValue"    AS latest_market_value,
  a."assessedVal"    AS latest_assessed_value,
  a."landVal"        AS latest_land_value,
  a."bldgVal"        AS latest_building_value
FROM "Property" p
LEFT JOIN "Owner"        o ON o.id = p."ownerId"
LEFT JOIN "Neighborhood" n ON n.id = p."neighborhoodId"
LEFT JOIN LATERAL (
  SELECT "year", "marketValue", "assessedVal", "landVal", "bldgVal"
  FROM "Assessment" a
  WHERE a."propertyId" = p.id
  ORDER BY "year" DESC
  LIMIT 1
) a ON TRUE;
