import dotenv from 'dotenv'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extrairCidadesLopesul } from './sswAreas.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env') })

function sqlStr(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

const extraido = await extrairCidadesLopesul(process.env.SSW_LOPESUL_DOMINIO || 'LSU')
const values = extraido.cidades
  .map((row) => `  (${['lopesul', row.uf, row.cidade].map(sqlStr).join(', ')})`)
  .join(',\n')

const sql = `-- Cobertura Lopesul extraída da página pública de áreas atendidas do SSW.
insert into public.cobertura_cidades (transportadora_id, uf, cidade)
values
${values}
on conflict (transportadora_id, uf, cidade_norm) do update
set cidade = excluded.cidade, updated_at = now();
`

const dest = path.join(root, 'supabase', 'seed-cobertura-lopesul.sql')
writeFileSync(dest, sql, 'utf8')

console.log(JSON.stringify({ total: extraido.total, porUf: extraido.porUf, origens: extraido.origens, dest }, null, 2))
