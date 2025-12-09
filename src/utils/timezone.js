// Utilitário para resolver timezone IANA a partir de uma Academia
// Preferência: campo `timezone`; fallback por estado (UF) do endereço

export function resolveIanaTimezoneFromAcademia(academia) {
  if (!academia) return process.env.APP_TIMEZONE || 'America/Sao_Paulo';
  const explicit = academia.timezone && String(academia.timezone).trim();
  if (explicit) return explicit;

  const country = String(academia?.endereco?.country || '').toUpperCase();
  const region = String(academia?.endereco?.region || academia?.endereco?.estado || '').toUpperCase();
  if (country && country !== 'BR') {
    // Fora do Brasil, manter APP_TIMEZONE por enquanto
    return process.env.APP_TIMEZONE || 'America/Sao_Paulo';
  }

  const uf = region;
  // Mapeamento aproximado de UF -> IANA timezone para Brasil
  // Referências gerais, podem ser ajustadas conforme necessidade operacional
  const map = {
    // Sudeste/Sul/Centro-Oeste (UTC-3 ou UTC-4 em MT/MS)
    'SP': 'America/Sao_Paulo', 'RJ': 'America/Sao_Paulo', 'MG': 'America/Sao_Paulo', 'ES': 'America/Sao_Paulo',
    'PR': 'America/Sao_Paulo', 'SC': 'America/Sao_Paulo', 'RS': 'America/Sao_Paulo',
    'GO': 'America/Sao_Paulo', 'DF': 'America/Sao_Paulo', 'TO': 'America/Sao_Paulo',
    'MS': 'America/Cuiaba', 'MT': 'America/Cuiaba',
    // Nordeste
    'BA': 'America/Bahia', 'SE': 'America/Recife', 'AL': 'America/Recife', 'PE': 'America/Recife',
    'PB': 'America/Fortaleza', 'RN': 'America/Fortaleza', 'CE': 'America/Fortaleza', 'PI': 'America/Fortaleza',
    'MA': 'America/Fortaleza',
    // Norte
    'PA': 'America/Belem', 'AP': 'America/Belem',
    'AM': 'America/Manaus', 'RO': 'America/Porto_Velho', 'RR': 'America/Boa_Vista',
    'AC': 'America/Rio_Branco',
  };

  return map[uf] || (process.env.APP_TIMEZONE || 'America/Sao_Paulo');
}

export function resolveTimezoneOrDefault(timezoneCandidate) {
  return timezoneCandidate || process.env.APP_TIMEZONE || 'America/Sao_Paulo';
}