import type { LegalDocumentSection } from '@repo/shared/legal';
import { sectionKey, type EditableSection, type SectionType } from './draft-form';

// Section edits of the structure editor (D-LC10): add, delete and reorder sections, and keep a table's header and every
// row the same length when a column comes or goes. Each function returns a new array.

type Table = Extract<LegalDocumentSection, { type: 'table' }>;
type List = Extract<LegalDocumentSection, { type: 'list' }>;

/** An empty section of a type, for the operator to fill (the contract refuses it until then). */
export function emptySection(type: SectionType): LegalDocumentSection {
  switch (type) {
    case 'heading':
      return { type: 'heading', level: 2, text: '' };
    case 'paragraph':
      return { type: 'paragraph', text: '' };
    case 'list':
      return { type: 'list', ordered: false, items: [''] };
    case 'table':
      return { type: 'table', caption: '', headers: [''], rows: [['']] };
    case 'callout':
      return { type: 'callout', tone: 'INFO', text: '' };
  }
}

export function appendSection(
  sections: readonly EditableSection[],
  type: SectionType,
): EditableSection[] {
  return [...sections, { key: sectionKey(), section: emptySection(type) }];
}

export function removeSection(
  sections: readonly EditableSection[],
  index: number,
): EditableSection[] {
  return sections.filter((_, position) => position !== index);
}

/** Moves a section one place up (-1) or down (+1); at an end it stays. */
export function moveSection(
  sections: readonly EditableSection[],
  index: number,
  delta: -1 | 1,
): EditableSection[] {
  const target = index + delta;
  if (target < 0 || target >= sections.length) return [...sections];
  const next = [...sections];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function replaceSection(
  sections: readonly EditableSection[],
  index: number,
  section: LegalDocumentSection,
): EditableSection[] {
  return sections.map((entry, position) => (position === index ? { ...entry, section } : entry));
}

/** The contract allows at most eight columns. */
export const MAX_TABLE_COLUMNS = 8;

export function addTableColumn(table: Table): Table {
  if (table.headers.length >= MAX_TABLE_COLUMNS) return table;
  return { ...table, headers: [...table.headers, ''], rows: table.rows.map((row) => [...row, '']) };
}

/** Deletes a column from the header and every row; the last column stays. */
export function removeTableColumn(table: Table, column: number): Table {
  if (table.headers.length <= 1) return table;
  return {
    ...table,
    headers: table.headers.filter((_, index) => index !== column),
    rows: table.rows.map((row) => row.filter((_, index) => index !== column)),
  };
}

export function addTableRow(table: Table): Table {
  return { ...table, rows: [...table.rows, table.headers.map(() => '')] };
}

/** Deletes a row; the last row stays. */
export function removeTableRow(table: Table, row: number): Table {
  if (table.rows.length <= 1) return table;
  return { ...table, rows: table.rows.filter((_, index) => index !== row) };
}

export function setTableHeader(table: Table, column: number, text: string): Table {
  return {
    ...table,
    headers: table.headers.map((value, index) => (index === column ? text : value)),
  };
}

export function setTableCell(table: Table, row: number, column: number, text: string): Table {
  return {
    ...table,
    rows: table.rows.map((cells, rowIndex) =>
      rowIndex === row
        ? cells.map((value, columnIndex) => (columnIndex === column ? text : value))
        : cells,
    ),
  };
}

export function addListItem(list: List): List {
  return { ...list, items: [...list.items, ''] };
}

/** Deletes an item; the last item stays. */
export function removeListItem(list: List, item: number): List {
  if (list.items.length <= 1) return list;
  return { ...list, items: list.items.filter((_, index) => index !== item) };
}

export function setListItem(list: List, item: number, text: string): List {
  return { ...list, items: list.items.map((value, index) => (index === item ? text : value)) };
}
