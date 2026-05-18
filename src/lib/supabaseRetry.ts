/**
 * Helpers para tornar `update`/`insert` no Supabase resilientes a:
 *  - colunas que ainda não existem no banco (migração não aplicada): 42703
 *  - colunas indicadas em PGRST204 / "Could not find the 'xxx' column"
 *
 * Em vez de falhar o save inteiro, removemos a coluna problemática do payload
 * e tentamos de novo — e devolvemos a lista de colunas que foram ignoradas
 * para o caller poder avisar o usuário.
 */
import type { PostgrestError } from '@supabase/supabase-js';

const MISSING_COLUMN_CODES = new Set(['42703', 'PGRST204']);

function extractColumnFromMessage(message: string | undefined | null): string | null {
  if (!message) return null;
  // Postgres: column "xxx" does not exist
  const m1 = message.match(/column\s+"([^"]+)"\s+does not exist/i);
  if (m1) return m1[1];
  // PostgREST: Could not find the 'xxx' column of 'leads' in the schema cache
  const m2 = message.match(/find the '([^']+)' column/i);
  if (m2) return m2[1];
  // Generic: "xxx" column ...
  const m3 = message.match(/"([a-z0-9_]+)"\s+column/i);
  if (m3) return m3[1];
  return null;
}

function isMissingColumnError(error: PostgrestError | null | undefined): boolean {
  if (!error) return false;
  if (MISSING_COLUMN_CODES.has(error.code ?? '')) return true;
  const msg = error.message || '';
  return /does not exist|find the .* column/i.test(msg);
}

type RetryResult<T> = {
  data: T | null;
  error: PostgrestError | null;
  skippedColumns: string[];
  lastError: PostgrestError | null;
};

/** Mensagem quando colunas existem no SQL mas a API ainda não as enxerga (cache PostgREST). */
export function describeSkippedColumnsWarning(
  skippedColumns: string[],
  lastError?: PostgrestError | null,
): string {
  if (skippedColumns.length === 0) return '';
  const cols = skippedColumns.join(', ');
  const isSchemaCache =
    lastError?.code === 'PGRST204' ||
    /schema cache|find the .* column/i.test(lastError?.message ?? '');
  if (isSchemaCache) {
    return `A API do Supabase ainda não reconhece: ${cols}. No painel: Settings → API → Reload schema (ou rode NOTIFY pgrst, 'reload schema' no SQL Editor). As colunas já existem na tabela leads.`;
  }
  return `Estes campos não existem no banco e foram ignorados: ${cols}. Aplique a migração SQL no Supabase.`;
}

/**
 * Executa `runner(payload)` com possíveis retries removendo colunas que o banco
 * não conhece. Devolve as colunas removidas para que o caller exiba alerta.
 */
export async function runWithSchemaFallback<T>(
  payload: Record<string, unknown>,
  runner: (payload: Record<string, unknown>) => Promise<{ data: T | null; error: PostgrestError | null }>,
  maxAttempts = 6,
): Promise<RetryResult<T>> {
  let current: Record<string, unknown> = { ...payload };
  const skipped: string[] = [];
  let lastError: PostgrestError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await runner(current);

    if (!error) {
      return { data, error: null, skippedColumns: skipped, lastError: null };
    }

    lastError = error;

    if (!isMissingColumnError(error)) {
      return { data: null, error, skippedColumns: skipped, lastError };
    }

    const col = extractColumnFromMessage(error.message);
    if (!col || !(col in current)) {
      return { data: null, error, skippedColumns: skipped, lastError };
    }

    delete current[col];
    skipped.push(col);
  }

  // Tentou demais — devolve erro genérico
  return {
    data: null,
    error: {
      message: 'Não foi possível salvar mesmo removendo campos desconhecidos.',
      details: '',
      hint: '',
      code: 'SCHEMA_FALLBACK_EXHAUSTED',
      name: 'PostgrestError',
    } as unknown as PostgrestError,
    skippedColumns: skipped,
    lastError,
  };
}
