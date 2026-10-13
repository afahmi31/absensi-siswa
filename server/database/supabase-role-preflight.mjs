export async function hasAllDatabaseRoles(database, requiredRoles) {
  const [result] = await database`
    select not exists (
      select 1
      from jsonb_array_elements_text(${database.json(requiredRoles)}) as required(role_name)
      where not exists (
        select 1 from pg_catalog.pg_roles where rolname = required.role_name
      )
    ) as roles_exist
  `

  return result.roles_exist
}
