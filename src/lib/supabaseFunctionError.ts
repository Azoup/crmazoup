/** Extrai mensagem legível de erro do supabase.functions.invoke */
export async function getFunctionInvokeErrorMessage(
  error: unknown,
  fallback = 'Erro ao chamar a função',
): Promise<string> {
  if (error && typeof error === 'object') {
    const err = error as {
      message?: string;
      context?: Response & { json?: () => Promise<unknown> };
    };
    if (err.context?.json) {
      try {
        const body = (await err.context.json()) as {
          error?: string;
          detail?: string;
          hint?: string;
          message?: string;
        };
        const parts = [body.error || body.message, body.detail, body.hint].filter(Boolean);
        if (parts.length) return parts.join(' — ');
      } catch {
        /* ignore */
      }
    }
    if (err.message && !err.message.includes('non-2xx')) {
      return err.message;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
