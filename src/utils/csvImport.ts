import { TransactionType } from '../lib/enums';

export interface ParsedCsvTransaction {
  id: string;
  date: Date;
  dateStr: string;
  description: string;
  rawAmount: number;
  amount: number;
  type: TransactionType.INCOME | TransactionType.EXPENSE;
  suggestedCategoryName?: string;
}

/**
 * Parse a single CSV line respecting quoted fields and escaped double quotes ("").
 */
export function parseCsvLine(line: string, delimiter = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Parse Brazilian or standard numeric amount strings from Nubank CSV.
 * Examples:
 * - "8,94" -> 8.94
 * - "- 68,97" -> -68.97
 * - "- 3.181,57" -> -3181.57
 * - "1234.56" -> 1234.56
 */
export function parseCsvAmount(raw: string): number | null {
  if (!raw) return null;
  let cleaned = raw.replace(/R\$/gi, '').replace(/\s+/g, '').trim();
  if (!cleaned) return null;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    // Brazilian format: 1.234,56 -> remove dots, replace comma with dot
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,234.56
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Brazilian decimal: 8,94 or -68,97
    cleaned = cleaned.replace(',', '.');
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parse date string (YYYY-MM-DD or DD/MM/YYYY) into a local midnight Date.
 */
export function parseCsvDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      date.setHours(0, 0, 0, 0);
      return date;
    }
    return null;
  }

  // DD/MM/YYYY
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (brMatch) {
    const day = Number(brMatch[1]);
    const month = Number(brMatch[2]);
    const year = Number(brMatch[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      date.setHours(0, 0, 0, 0);
      return date;
    }
    return null;
  }

  return null;
}

/**
 * Parse Nubank CSV content into structured transactions.
 * Supports Nubank Credit Card (`date,title,amount`) and Nubank Account (`Data,Valor,Identificador,Descrição`).
 */
export function parseNubankCsv(content: string): ParsedCsvTransaction[] {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error('O arquivo CSV está vazio ou não possui transações.');
  }

  const firstLine = lines[0];
  const delimiter =
    firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

  const normalizeHeader = (h: string) =>
    h
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const headerFields = parseCsvLine(firstLine, delimiter).map(normalizeHeader);

  const dateIdx = headerFields.findIndex((h) => h === 'date' || h === 'data');
  const titleIdx = headerFields.findIndex(
    (h) => h === 'title' || h === 'descricao' || h === 'description' || h.startsWith('descri')
  );
  const amountIdx = headerFields.findIndex(
    (h) => h === 'amount' || h === 'valor' || h === 'value'
  );
  const idIdx = headerFields.findIndex(
    (h) => h === 'identificador' || h === 'id'
  );

  if (dateIdx === -1 || titleIdx === -1 || amountIdx === -1) {
    throw new Error(
      'Formato de CSV não reconhecido. Esperado cabeçalho da Nubank (date, title, amount ou Data, Valor, Identificador, Descrição).'
    );
  }

  const isNuContaFormat =
    idIdx !== -1 ||
    headerFields[dateIdx] === 'data' ||
    headerFields[amountIdx] === 'valor';
  const rows: ParsedCsvTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i], delimiter);
    if (fields.length <= Math.max(dateIdx, titleIdx, amountIdx)) {
      continue;
    }

    const rawDate = fields[dateIdx];
    const rawTitle = fields[titleIdx];
    const rawAmountStr = fields[amountIdx];
    const externalId = idIdx !== -1 ? fields[idIdx]?.trim() : '';

    const date = parseCsvDate(rawDate);
    const rawAmount = parseCsvAmount(rawAmountStr);

    if (!date || rawAmount === null || rawAmount === 0) {
      continue;
    }

    // Nubank Credit Card CSV: positive = purchase (EXPENSE), negative = payment/refund (INCOME)
    // Nubank Account CSV: negative = outgoing (EXPENSE), positive = incoming (INCOME)
    const isIncome = isNuContaFormat ? rawAmount > 0 : rawAmount < 0;
    const desc = rawTitle || 'Transação importada';

    rows.push({
      id: externalId || `csv-${i}-${rawDate}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      dateStr: rawDate,
      description: desc,
      rawAmount,
      amount: Math.abs(rawAmount),
      type: isIncome ? TransactionType.INCOME : TransactionType.EXPENSE,
    });
  }

  if (rows.length === 0) {
    throw new Error('Nenhuma transação válida encontrada no arquivo CSV.');
  }

  return rows;
}
