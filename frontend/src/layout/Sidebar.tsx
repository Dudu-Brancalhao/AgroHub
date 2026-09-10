import styled from 'styled-components';
import { NavLink } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { sidebarClosed } from '../features/ui/uiSlice';
import { DashboardIcon, HarvestIcon, ProducersIcon } from '../icons';
import { transitioned } from '../styles/motion';

/**
 * The three destinations, exactly as requested (FR-003).
 *
 * Paths use the pt-BR nouns shown in the menu, because a URL is user-facing surface
 * (Principle VIII). `end` only on Dashboard so `/produtores/:id` keeps Produtores marked —
 * the menu reflects the section, not the exact address (FR-004).
 */
const DESTINATIONS = [
  { to: '/dashboard', label: 'Dashboard', Icon: DashboardIcon, end: true },
  { to: '/produtores', label: 'Produtores', Icon: ProducersIcon, end: false },
  { to: '/safras', label: 'Safras', Icon: HarvestIcon, end: false },
] as const;

const Nav = styled.nav<{ $open: boolean }>`
  position: fixed;
  top: ${({ theme }) => theme.layout.headerHeight};
  bottom: 0;
  left: 0;
  width: ${({ theme }) => theme.layout.sidebarWidth};
  z-index: ${({ theme }) => theme.zIndex.sidebar};

  padding: ${({ theme }) => theme.space.md} ${({ theme }) => theme.space.sm};
  background: ${({ theme }) => theme.colors.surface};
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  overflow-y: auto;

  @media (max-width: ${({ theme }) => theme.breakpoint.tablet}) {
    transform: translateX(${({ $open }) => ($open ? '0' : '-100%')});
    box-shadow: ${({ theme, $open }) => ($open ? theme.shadow.lg : 'none')};
    ${transitioned('transform', '180ms', 'cubic-bezier(0.2, 0, 0.2, 1)')}
  }
`;

const Backdrop = styled.div`
  display: none;

  @media (max-width: ${({ theme }) => theme.breakpoint.tablet}) {
    display: block;
    position: fixed;
    inset: ${({ theme }) => theme.layout.headerHeight} 0 0 0;
    z-index: ${({ theme }) => theme.zIndex.sidebar - 1};
    background: rgba(30, 42, 33, 0.35);
  }
`;

const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.xxs};
`;

const Entry = styled(NavLink)`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.sm};
  padding: ${({ theme }) => `${theme.space.xs} ${theme.space.sm}`};
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.colors.textMuted};
  text-decoration: none;

  ${transitioned('background-color, color', '120ms')}

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceSunken};
    color: ${({ theme }) => theme.colors.text};
  }

  &.active {
    background: ${({ theme }) => theme.colors.primarySoft};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

export function Sidebar() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((state) => state.ui.sidebarOpen);

  return (
    <>
      {open && <Backdrop onClick={() => dispatch(sidebarClosed())} />}
      <Nav $open={open} aria-label="Navegação principal">
        <List>
          {DESTINATIONS.map(({ to, label, Icon, end }) => (
            <li key={to}>
              {/* NavLink sets aria-current="page" on the active entry by itself. */}
              <Entry to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
                <Icon />
                {label}
              </Entry>
            </li>
          ))}
        </List>
      </Nav>
    </>
  );
}
