import { screen } from '@testing-library/react';
import { PieChart } from './PieChart';
import { renderWithTheme } from '../test/renderWithTheme';
import type { PieSlice } from './PieChart';

const slices: PieSlice[] = [
  { key: 'mg', label: 'MG', value: '3.000,22 ha', share: 50, color: '#2a78d6' },
  { key: 'ba', label: 'BA', value: '2.300,00 ha', share: 38, color: '#eb6834' },
  { key: 'sp', label: 'SP', value: '700,00 ha', share: 12, color: '#1baf7a' },
];

function render(props: Partial<Parameters<typeof PieChart>[0]> = {}) {
  return renderWithTheme(
    <PieChart slices={slices} total="6.000,22 ha" totalLabel="hectares" {...props} />,
  );
}

describe('PieChart', () => {
  it('draws one slice per category', () => {
    const { container } = render();

    // Three slices, and the label/centre text are <text>, not <path>.
    expect(container.querySelectorAll('path')).toHaveLength(3);
  });

  /**
   * The requirement is a "gráfico de pizza" (specs/003-dashboard-api), so the wedges are solid:
   * each one runs from the exact centre out to the rim. A donut would leave a hole, and the
   * paths would start on the inner rim instead.
   */
  it('draws solid wedges from the centre, with no hole', () => {
    const { container } = render();

    for (const path of Array.from(container.querySelectorAll('path'))) {
      expect(path.getAttribute('d')).toMatch(/^M 100 100 L /);
    }
  });

  it('closes the legend with the total the parts add up to', () => {
    render();

    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('6.000,22 ha')).toBeInTheDocument();
  });

  /**
   * The rule that discharges the palette's contrast warning: identity is never colour alone.
   * Every slice repeats as label + value in text.
   */
  it('repeats every slice in the legend as text', () => {
    render();

    expect(screen.getByText('MG')).toBeInTheDocument();
    expect(screen.getByText('3.000,22 ha')).toBeInTheDocument();
    expect(screen.getByText('BA')).toBeInTheDocument();
    expect(screen.getByText('2.300,00 ha')).toBeInTheDocument();
    expect(screen.getByText('SP')).toBeInTheDocument();
    expect(screen.getByText('700,00 ha')).toBeInTheDocument();
  });

  /** The share belongs on the slice; repeating it in the legend only reads as ambiguity. */
  it('does not repeat the share in the legend', () => {
    render();

    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
    expect(screen.queryByText('3.000,22 ha · 50%')).not.toBeInTheDocument();
  });

  it('gives the whole chart one accessible description', () => {
    render();

    expect(screen.getByRole('img')).toHaveAccessibleName(
      'hectares: 6.000,22 ha. MG 3.000,22 ha, 50%. BA 2.300,00 ha, 38%. SP 700,00 ha, 12%',
    );
  });

  it('labels slices in place only when there is arc enough to hold the number', () => {
    render({
      slices: [
        { key: 'big', label: 'Grande', value: '95', share: 95, color: '#2a78d6' },
        { key: 'sliver', label: 'Fatia fina', value: '5', share: 5, color: '#eb6834' },
      ],
    });

    // The wide slice carries its share; the sliver has no arc to hold one, so it goes unlabelled
    // on the chart and is identified by name and value in the legend.
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.queryByText('5%')).not.toBeInTheDocument();
    expect(screen.getByText('Fatia fina')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('draws a single category as a full circle rather than a degenerate wedge', () => {
    const { container } = render({
      slices: [{ key: 'only', label: 'Única', value: '100', share: 100, color: '#2a78d6' }],
    });

    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(1);
    // A 360-degree arc collapses to nothing, so this one case is drawn as a circle instead.
    expect(paths[0]!.getAttribute('d')).toMatch(/^M 100 6 A 94 94 /);
    expect(screen.getByText('Única')).toBeInTheDocument();
  });

  it('separates neighbouring slices with a surface-coloured hairline', () => {
    const { container } = render();

    // What keeps two similar hues from touching edge to edge.
    for (const path of Array.from(container.querySelectorAll('path'))) {
      expect(path).toHaveAttribute('stroke', '#ffffff');
    }
  });

  it('explains an empty breakdown instead of drawing an empty circle', () => {
    render({ slices: [], total: '0', totalLabel: 'hectares' });

    expect(screen.getByText('Nada registrado ainda.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
