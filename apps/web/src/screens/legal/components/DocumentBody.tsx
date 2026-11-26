import type { ReactNode } from 'react';
import type { LegalDocumentSection } from '@repo/shared/legal';
import type { LegalBlock, LegalHeadingBlock } from '../model/legalDocumentModel';
import { legalScreenCopy } from '../model/legalScreenCopy';
import { Notice } from './Notice';
import { ScrollRegion } from './ScrollRegion';

// The document body: every section in source order, text as written (G-LU1). Headings keep the source
// level (G-LU3) and stand apart by size and weight (G-LU4). A heading reached from the table of
// contents lands below the sticky header (G-LU8). The header sticks from lg only.
//
// The comparison table draws an article's sections with the same renderer: its headings carry no id
// (they are not contents entries) and move `headingShift` levels down so they sit under the
// comparison's own headings; their look follows the source level.
const sentence = 'break-keep wrap-anywhere';
// A heading focused after a table-of-contents jump shows no ring: it is a place, not a control.
export const headingJumpClass = 'scroll-mt-4 lg:scroll-mt-24 focus:outline-none';

type BodyBlock = LegalBlock | LegalDocumentSection;
type HeadingSection = Extract<LegalDocumentSection, { type: 'heading' }>;
type HeadingTag = 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

const headingTags: readonly HeadingTag[] = ['h2', 'h3', 'h4', 'h5', 'h6'];

const headingLook = {
  2: 'mt-12 text-title-3 font-bold text-balance first:mt-0',
  3: 'mt-8 text-body font-bold',
  4: 'mt-6 text-body font-medium',
} as const satisfies Record<HeadingSection['level'], string>;

function Heading({
  block,
  headingShift,
}: {
  block: HeadingSection | LegalHeadingBlock;
  headingShift: number;
}) {
  const Tag = headingTags[Math.min(block.level - 2 + headingShift, headingTags.length - 1)] ?? 'h6';
  const id = 'id' in block ? block.id : undefined;
  return (
    <Tag
      id={id}
      className={`${headingLook[block.level]} ${id ? headingJumpClass : ''} ${sentence}`}
    >
      {block.text}
    </Tag>
  );
}

function Table({
  block,
  captionId,
}: {
  block: Extract<LegalDocumentSection, { type: 'table' }>;
  captionId: string;
}) {
  return (
    <ScrollRegion
      labelledBy={block.caption ? captionId : undefined}
      label={block.caption ? undefined : block.headers.join(', ')}
      className="mt-6 overflow-x-auto rounded-control border border-stroke-subtle focus-visible:focus-ring print:overflow-visible"
    >
      <table className="w-full border-collapse text-left text-body-sm">
        {block.caption && (
          <caption id={captionId} className="px-4 pt-3 pb-2 text-left font-bold">
            {block.caption}
          </caption>
        )}
        <thead className="bg-layer-basement">
          <tr>
            {block.headers.map((header) => (
              <th
                key={header}
                scope="col"
                className={`min-w-32 px-4 py-3 align-bottom font-bold ${sentence}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-stroke-subtle">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={`min-w-32 px-4 py-3 align-top ${sentence}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}

function Block({
  block,
  index,
  headingShift,
  idPrefix,
}: {
  block: BodyBlock;
  index: number;
  headingShift: number;
  idPrefix: string;
}): ReactNode {
  switch (block.type) {
    case 'heading':
      return <Heading block={block} headingShift={headingShift} />;
    case 'paragraph':
      return <p className={`mt-4 text-body first:mt-0 ${sentence}`}>{block.text}</p>;
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <List
          className={`mt-4 space-y-2 pl-6 text-body first:mt-0 ${block.ordered ? 'list-decimal' : 'list-disc'}`}
        >
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex} className={sentence}>
              {item}
            </li>
          ))}
        </List>
      );
    }
    case 'table':
      return <Table block={block} captionId={`${idPrefix}-table-${index}-caption`} />;
    case 'callout':
      return (
        <Notice
          label={legalScreenCopy.noticeLabel[block.tone]}
          role="note"
          className="mt-4 first:mt-0"
        >
          {block.text}
        </Notice>
      );
  }
}

export function DocumentBody({
  blocks,
  headingShift = 0,
  idPrefix = 'body',
}: {
  blocks: readonly BodyBlock[];
  headingShift?: number;
  idPrefix?: string;
}) {
  return (
    <div>
      {blocks.map((block, index) => (
        <Block
          key={block.type === 'heading' && 'id' in block ? block.id : `${block.type}-${index}`}
          block={block}
          index={index}
          headingShift={headingShift}
          idPrefix={idPrefix}
        />
      ))}
    </div>
  );
}
