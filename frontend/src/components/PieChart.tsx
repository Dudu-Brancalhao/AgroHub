import { useId } from 'react';
import styled, { useTheme } from 'styled-components';
import { transitioned } from '../styles/motion';

/**
 * A pizza chart for part-to-whole, hand-written in SVG.
 *
 * Solid wedges from the centre, not a donut — the dashboard requirement asks for a "gráfico de
 * pizza" (specs/003-dashboard-api), and a ring with a hole in it is a different form.
 *
 * No charting library: the server returns each breakdown pre-aggregated, so the work left is arc
 * geometry. Drawing it here keeps the marks on the theme, keeps the labels as real text, and
 * costs nothing at runtime.
 *
 * Two rules from the chart guidance are load-bearing rather than decorative:
 *
 *   - **A surface-coloured gap separates neighbouring wedges**, so two similar hues never touch
 *     edge to edge.
 *   - **Identity is never colour alone.** Every wedge repeats in the legend as label + value,
 *     which is what discharges the palette's contrast warning — three of the six hues sit below
 *     3:1 on white. The share is shown once, on the wedge itself, and the full breakdown
 *     including every share stays in the chart's accessible description.
 *
 * The whole that the parts add up to closes the legend as a total row. In the donut this number
 * lived in the hole; a pizza has no hole, and the foot of the legend is where a reader looks for
 * a sum anyway.
 */

const SIZE = 200;
const CENTRE = SIZE / 2;
const RADIUS = 94;
/** Degrees of surface showing between neighbours. */
const GAP = 1.2;
/** Where a wedge's own label sits, as a fraction of the radius. */
const LABEL_RADIUS = RADIUS * 0.64;

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

const Wedge = styled.path`
  ${transitioned('opacity', '120ms')}

  &:hover {
    opacity: 0.82;
  }
`;

const WedgeLabel = styled.text`
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

const TotalRow = styled(LegendRow)`
  margin-top: ${({ theme }) => theme.space.xxs};
  padding-top: ${({ theme }) => theme.space.xs};
  border-top: 1px solid ${({ theme }) => theme.colors.surfaceSunken};
  font-weight: ${({ theme }) => theme.font.weight.medium};
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

const TotalValue = styled(LegendValue)`
  color: ${({ theme }) => theme.colors.text};
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

/** A wedge runs centre → rim → arc → back to centre. */
function wedgePath(startDeg: number, endDeg: number): string {
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;

  const from = polar(startDeg, RADIUS);
  const to = polar(endDeg, RADIUS);

  return [
    `M ${CENTRE} ${CENTRE}`,
    `L ${from.x} ${from.y}`,
    `A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${to.x} ${to.y}`,
    'Z',
  ].join(' ');
}

/**
 * One category covering the whole pizza has no two edges to separate, and a 360° arc collapses
 * to nothing — so it is drawn as a plain circle instead.
 */
function fullCircle(): string {
  return [
    `M ${CENTRE} ${CENTRE - RADIUS}`,
    `A ${RADIUS} ${RADIUS} 0 1 1 ${CENTRE - 0.01} ${CENTRE - RADIUS}`,
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
  /** The whole the parts add up to. Closes the legend as a total row. */
  total: string;
  totalLabel: string;
  emptyMessage?: string;
}) {
  const theme = useTheme();
  const titleId = useId();

  if (slices.length === 0) {
    return <LegendValue>{emptyMessage}</LegendValue>;
  }

  const isSingle = slices.length === 1;
  const gap = isSingle ? 0 : GAP;

  let cursor = 0;
  const drawn = slices.map((slice) => {
    const sweep = (slice.share / 100) * 360;
    const start = cursor;
    cursor += sweep;

    return {
      ...slice,
      // A wedge thinner than the gap itself would invert into a negative arc.
      path: isSingle
        ? fullCircle()
        : wedgePath(start + gap / 2, Math.max(start + gap / 2, cursor - gap / 2)),
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
          <Wedge
            key={slice.key}
            d={slice.path}
            fill={slice.color}
            // The surface-coloured hairline is the gap: it keeps neighbouring hues from touching,
            // which is what makes similar colours separable.
            stroke={theme.colors.surface}
            strokeWidth={1}
          />
        ))}

        {drawn
          .filter((slice) => slice.showLabel)
          .map((slice) => {
            const at = polar(slice.mid, LABEL_RADIUS);
            return (
              <WedgeLabel
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
              </WedgeLabel>
            );
          })}
      </Svg>

      <Legend>
        {slices.map((slice) => (
          <LegendRow key={slice.key}>
            <Swatch $color={slice.color} aria-hidden="true" />
            <LegendLabel title={slice.label}>{slice.label}</LegendLabel>
            <LegendValue>{slice.value}</LegendValue>
          </LegendRow>
        ))}

        <TotalRow>
          <span aria-hidden="true" />
          <LegendLabel>Total</LegendLabel>
          <TotalValue>{total}</TotalValue>
        </TotalRow>
      </Legend>
    </Figure>
  );
}
