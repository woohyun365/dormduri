'use client';

import type { ReactNode } from 'react';
import type { LegalDocumentSection } from '@repo/shared/legal';
import { Button } from '@/ui/Button';
import { SelectField, TextAreaField, TextField } from '@/ui/fields';
import { TableRegion } from '@/ui/table';
import { SECTION_TYPE_LABELS, type EditableSection, type SectionType } from './draft-form';
import {
  addListItem,
  addTableColumn,
  addTableRow,
  appendSection,
  MAX_TABLE_COLUMNS,
  moveSection,
  removeListItem,
  removeSection,
  removeTableColumn,
  removeTableRow,
  replaceSection,
  setListItem,
  setTableCell,
  setTableHeader,
} from './section-editing';

// The body editor (D-LC10): one group per section, named `본문 n · <type>`, with its own fields and the buttons that
// move or delete it; the add buttons append a section of each type. The fieldset around the editor turns all of it off
// when the draft cannot be edited.

const ADD_ORDER: readonly SectionType[] = ['heading', 'paragraph', 'list', 'table', 'callout'];

type Table = Extract<LegalDocumentSection, { type: 'table' }>;
type List = Extract<LegalDocumentSection, { type: 'list' }>;

function TableFields({
  id,
  number,
  table,
  onChange,
}: {
  readonly id: string;
  readonly number: number;
  readonly table: Table;
  readonly onChange: (table: Table) => void;
}) {
  const columns = table.headers.length;
  return (
    <div className="flex flex-col gap-3">
      <TextField
        id={`${id}-caption`}
        label="표 제목(선택)"
        value={table.caption ?? ''}
        maxLength={160}
        onChange={(event) => onChange({ ...table, caption: event.target.value })}
      />
      <TableRegion label={`본문 ${number} 표 칸`}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {table.headers.map((header, column) => (
                <th key={column} scope="col" className="min-w-28 p-1 text-left align-bottom">
                  <TextField
                    id={`${id}-header-${column}`}
                    label={`머리 ${column + 1}`}
                    value={header}
                    maxLength={160}
                    onChange={(event) =>
                      onChange(setTableHeader(table, column, event.target.value))
                    }
                  />
                </th>
              ))}
              <td className="p-1" />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, column) => (
                  <td key={column} className="p-1 align-top">
                    <TextAreaField
                      id={`${id}-cell-${rowIndex}-${column}`}
                      label={`${rowIndex + 1}행 ${column + 1}열`}
                      value={cell}
                      rows={2}
                      maxLength={8000}
                      onChange={(event) =>
                        onChange(setTableCell(table, rowIndex, column, event.target.value))
                      }
                    />
                  </td>
                ))}
                <td className="p-1 align-bottom">
                  <Button
                    tone="danger"
                    size="sm"
                    disabled={table.rows.length <= 1}
                    onClick={() => onChange(removeTableRow(table, rowIndex))}
                  >
                    {rowIndex + 1}행 지우기
                  </Button>
                </td>
              </tr>
            ))}
            <tr>
              {table.headers.map((_, column) => (
                <td key={column} className="p-1">
                  <Button
                    tone="danger"
                    size="sm"
                    disabled={columns <= 1}
                    onClick={() => onChange(removeTableColumn(table, column))}
                  >
                    {column + 1}열 지우기
                  </Button>
                </td>
              ))}
              <td className="p-1" />
            </tr>
          </tbody>
        </table>
      </TableRegion>
      <div className="flex flex-wrap gap-2">
        <Button
          tone="secondary"
          size="sm"
          disabled={columns >= MAX_TABLE_COLUMNS}
          onClick={() => onChange(addTableColumn(table))}
        >
          열 더하기
        </Button>
        <Button tone="secondary" size="sm" onClick={() => onChange(addTableRow(table))}>
          행 더하기
        </Button>
      </div>
    </div>
  );
}

function ListFields({
  id,
  list,
  onChange,
}: {
  readonly id: string;
  readonly list: List;
  readonly onChange: (list: List) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-body text-fg-label">
        <input
          type="checkbox"
          checked={list.ordered}
          onChange={(event) => onChange({ ...list, ordered: event.target.checked })}
          className="size-4 focus-ring"
        />
        번호 목록
      </label>
      {list.items.map((item, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <TextAreaField
            id={`${id}-item-${index}`}
            label={`항목 ${index + 1}`}
            value={item}
            rows={2}
            maxLength={8000}
            onChange={(event) => onChange(setListItem(list, index, event.target.value))}
          />
          <Button
            tone="danger"
            size="sm"
            className="self-start"
            disabled={list.items.length <= 1}
            onClick={() => onChange(removeListItem(list, index))}
          >
            항목 {index + 1} 지우기
          </Button>
        </div>
      ))}
      <Button
        tone="secondary"
        size="sm"
        className="self-start"
        onClick={() => onChange(addListItem(list))}
      >
        항목 더하기
      </Button>
    </div>
  );
}

function SectionFields({
  id,
  number,
  section,
  onChange,
}: {
  readonly id: string;
  readonly number: number;
  readonly section: LegalDocumentSection;
  readonly onChange: (section: LegalDocumentSection) => void;
}): ReactNode {
  switch (section.type) {
    case 'heading':
      return (
        <div className="grid gap-3 sm:grid-cols-label-value">
          <SelectField
            id={`${id}-level`}
            label="수준"
            value={section.level}
            onChange={(event) =>
              onChange({ ...section, level: Number(event.target.value) as 2 | 3 | 4 })
            }
          >
            <option value={2}>조(2단계)</option>
            <option value={3}>3단계</option>
            <option value={4}>4단계</option>
          </SelectField>
          <TextField
            id={`${id}-text`}
            label="제목 글"
            value={section.text}
            maxLength={160}
            onChange={(event) => onChange({ ...section, text: event.target.value })}
          />
        </div>
      );
    case 'paragraph':
      return (
        <TextAreaField
          id={`${id}-text`}
          label="문단"
          value={section.text}
          rows={4}
          maxLength={8000}
          onChange={(event) => onChange({ ...section, text: event.target.value })}
        />
      );
    case 'list':
      return <ListFields id={id} list={section} onChange={onChange} />;
    case 'table':
      return <TableFields id={id} number={number} table={section} onChange={onChange} />;
    case 'callout':
      return (
        <div className="flex flex-col gap-3">
          <SelectField
            id={`${id}-tone`}
            label="종류"
            value={section.tone}
            onChange={(event) =>
              onChange({ ...section, tone: event.target.value as 'INFO' | 'WARNING' })
            }
          >
            <option value="INFO">안내</option>
            <option value="WARNING">주의</option>
          </SelectField>
          <TextAreaField
            id={`${id}-text`}
            label="안내 글"
            value={section.text}
            rows={3}
            maxLength={8000}
            onChange={(event) => onChange({ ...section, text: event.target.value })}
          />
        </div>
      );
  }
}

export function SectionsEditor({
  sections,
  onChange,
}: {
  readonly sections: readonly EditableSection[];
  readonly onChange: (sections: EditableSection[]) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ol aria-label="본문 section" className="flex flex-col gap-4">
        {sections.map(({ key, section }, index) => {
          const number = index + 1;
          const legendId = `${key}-legend`;
          return (
            <li key={key}>
              <fieldset
                aria-labelledby={legendId}
                className="flex min-w-0 flex-col gap-3 rounded-card border border-stroke-subtle p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id={legendId} className="text-label font-semibold text-fg-label">
                    본문 {number} · {SECTION_TYPE_LABELS[section.type]}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      tone="secondary"
                      size="sm"
                      aria-label={`본문 ${number} 위로`}
                      disabled={index === 0}
                      onClick={() => onChange(moveSection(sections, index, -1))}
                    >
                      위로
                    </Button>
                    <Button
                      tone="secondary"
                      size="sm"
                      aria-label={`본문 ${number} 아래로`}
                      disabled={index === sections.length - 1}
                      onClick={() => onChange(moveSection(sections, index, 1))}
                    >
                      아래로
                    </Button>
                    <Button
                      tone="danger"
                      size="sm"
                      aria-label={`본문 ${number} 지우기`}
                      disabled={sections.length <= 1}
                      onClick={() => onChange(removeSection(sections, index))}
                    >
                      지우기
                    </Button>
                  </div>
                </div>
                <SectionFields
                  id={key}
                  number={number}
                  section={section}
                  onChange={(next) => onChange(replaceSection(sections, index, next))}
                />
              </fieldset>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        {ADD_ORDER.map((type) => (
          <Button
            key={type}
            tone="secondary"
            size="sm"
            onClick={() => onChange(appendSection(sections, type))}
          >
            {SECTION_TYPE_LABELS[type]} 더하기
          </Button>
        ))}
      </div>
    </div>
  );
}
