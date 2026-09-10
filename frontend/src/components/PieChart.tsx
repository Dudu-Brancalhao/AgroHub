import { useId } from 'react';
import styled, { useTheme } from 'styled-components';
import { transitioned } from '../styles/motion';

/**
 * A donut chart for part-to-whole, hand-written in SVG.
 *
 * No charting library: the server returns each breakdown pre-aggregated, so the work left is arc
 * geometry. Drawing it here keeps the marks on the theme, keeps the labels as real text, and
 * costs nothing at runtime.
 *
 * Three rules from the chart guidance are load-bearing rather than decorative:
 *
 *   - **A 2px surface-coloured gap separates neighbouring slices**, so two similar hues never
 *     touch edge to edge.
 *   - **Identity is never colour alone.** Every slice repeats in a legend as label + value +
 *     share, and slices big enough to hold one are labelled in place. This is what discharges
 *     the palette's contrast warning — three of the six hues sit below 3:1 on white.
 *   - **A donut, not a full pie**, because the hole holds the total. The number a reader most
 *     often wants is then in the middle of the thing they are already looking at.
 */

const SIZE = 200;
const CENTRE = SIZE / 2;
const OUTER = 92;
const INNER = 58;
/** Degrees of surface showing between neighbours — roughly 2px at this radius. */
const GAP = 1.4;

const Figure = styled.figure`
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.md};
  align-items: center;
`;

const Svg = styled.svg`
  overflow: visible;
  flex-shrink: 0;
`;

const Slice = styled.path`
  ${transitioned('opacity', '120ms')}

  &:hover {
    opacity: 0.82;
  }
`;

const CentreValue = styled.text`
  font-size: 17px;
  font-weight: ${({ theme }) => theme.font.weight.bold};
  fill: ${({ theme }) => theme.colors.text};
`;

const CentreLabel = styled.text`
  font-size: 10px;
  fill: ${({ theme }) => theme.colors.textMuted};
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const SliceLabel = styled.text`
  font-size: 11px;
  font-weight: ${({ theme }) => theme.font.weight.medium};
  fill: ${({ theme }) => theme.colors.textInverted};
  paint-order: stroke;
`;

const Legend = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.xxs};
  width: 100%;
`;

const LegendRow = styled.li`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: baseline;
  gap: ${({ theme }) => theme.space.xs};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const Swatch = styled.span<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: ${({ $color }) => $color};
  align-self: center;
  flex-shrink: 0;
`;

const LegendLabel = styled.span`
  color: ${({ theme }) => theme.colors.text};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const LegendValue = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-variant-numeric: tabular-nums;
`;

export type PieSlice = {
  key: string;
  label: string;
  /** Already formatted for display — the chart never formats numbers itself. */
  value: string;
  share: number;
  color: string;
};

function polar(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTRE + radius * Math.cos(rad), y: CENTRE + radius * Math.sin(rad) };
}

function donutSegment(startDeg: number, endDeg: number): string {
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;

  const outerStart = polar(startDeg, OUTER);
  const outerEnd = polar(endDeg, OUTER);
  const innerEnd = polar(endDeg, INNER);
  const innerStart = polar(startDeg, INNER);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER} ${OUTER} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${INNER} ${INNER} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

/** A single slice covering the whole circle has no start/end to join, so it is drawn as a ring. */
function fullRing(): string {
  return [
    `M ${CENTRE} ${CENTRE - OUTER}`,
    `A ${OUTER} ${OUTER} 0 1 1 ${CENTRE - 0.01} ${CENTRE - OUTER}`,
    'Z',
    `M ${CENTRE} ${CENTRE - INNER}`,
    `A ${INNER} ${INNER} 0 1 0 ${CENTRE - 0.01} ${CENTRE - INNER}`,
    'Z',
  ].join(' ');
}

export function PieChart({
  slices,
  total,
  totalLabel,
  emptyMessage = 'Nada registrado ainda.',
}: {
  slices: PieSlice[];
  /** The figure shown in the hole — the whole that the parts are part of. */
  total: string;
  totalLabel: string;
  emptyMessage?: string;
}) {
  const theme = useTheme();
  const titleId = useId();

  if (slices.length === 0) {
    return <LegendValue>{emptyMessage}</LegendValue>;
  }

  // The gap is only meaningful between two neighbours; one slice is a continuous ring.
  const gap = slices.length > 1 ? GAP : 0;

  let cursor = 0;
  const drawn = slices.map((slice) => {
    const sweep = (slice.share / 100) * 360;
    const start = cursor;
    cursor += sweep;

    return {
      ...slice,
      start,
      end: cursor,
      // A slice thinner than the gap itself would invert into a negative arc.
      path:
        slices.length === 1
          ? fullRing()
          : donutSegment(start + gap / 2, Math.max(start + gap / 2, cursor - gap / 2)),
      mid: start + sweep / 2,
      // Below ~9% there is not enough arc to hold a legible number; the legend carries it.
      showLabel: slice.share >= 9,
    };
  });

  return (
    <Figure>
      <Svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>
          {`${totalLabel}: ${total}. ` +
            drawn.map((s) => `${s.label} ${s.value}, ${Math.round(s.share)}%`).join('. ')}
        </title>

        {drawn.map((slice) => (
          <Slice
            key={slice.key}
            d={slice.path}
            fill={slice.color}
            // The surface-coloured hairline is the 2px gap: it keeps neighbouring hues from
            // touching, which is what makes similar colours separable.
            stroke={theme.colors.surface}
            strokeWidth={1}
          />
        ))}

        {drawn
          .filter((slice) => slice.showLabel)
          .map((slice) => {
            const at = polar(slice.mid, (OUTER + INNER) / 2);
            return (
              <SliceLabel
                key={`${slice.key}-label`}
                x={at.x}
                y={at.y}
                textAnchor="middle"
                dominantBaseline="central"
                // A dark halo keeps the white number legible on the lighter fills.
                stroke="rgba(0,0,0,0.35)"
                strokeWidth={2.5}
              >
                {Math.round(slice.share)}%
              </SliceLabel>
            );
          })}

        <CentreValue x={CENTRE} y={CENTRE - 2} textAnchor="middle" dominantBaseline="central">
          {total}
        </CentreValue>
        <CentreLabel x={CENTRE} y={CENTRE + 16} textAnchor="middle" dominantBaseline="central">
          {totalLabel}
        </CentreLabel>
      </Svg>

      <Legend>
        {slices.map((slice) => (
          <LegendRow key={slice.key}>
            <Swatch $color={slice.color} aria-hidden="true" />
            <LegendLabel title={slice.label}>{slice.label}</LegendLabel>
            <LegendValue>
              {slice.value} · {Math.round(slice.share)}%
            </LegendValue>
          </LegendRow>
        ))}
      </Legend>
    </Figure>
  );
}
