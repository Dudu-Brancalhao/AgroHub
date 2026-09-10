import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { selectUserEmail } from '../features/auth/selectors';
import { signOut } from '../features/auth/authSlice';
import { sidebarToggled } from '../features/ui/uiSlice';
import { MenuIcon, SignOutIcon } from '../icons';
import { transitioned } from '../styles/motion';

/**
 * Fixed to the viewport (FR-001), with the product name on the left edge (FR-002).
 *
 * `position: fixed` rather than `sticky`: the main area is the scroll container, so the bar
 * genuinely never moves.
 */
const Bar = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: ${({ theme }) => theme.layout.headerHeight};
  z-index: ${({ theme }) => theme.zIndex.header};

  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.sm};
  padding: 0 ${({ theme }) => theme.space.md};

  background: ${({ theme }) => theme.colors.surface};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const MenuButton = styled.button`
  display: none;
  background: none;
  border: none;
  padding: ${({ theme }) => theme.space.xxs};
  line-height: 0;
  border-radius: ${({ theme }) => theme.radii.sm};
  color: ${({ theme }) => theme.colors.text};

  ${transitioned('background-color', '120ms')}

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceSunken};
  }

  @media (max-width: ${({ theme }) => theme.breakpoint.tablet}) {
    display: inline-flex;
  }
`;

const Brand = styled(Link)`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.bold};
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: none;
  letter-spacing: -0.01em;
`;

const Spacer = styled.div`
  flex: 1;
`;

const UserEmail = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  max-width: 30ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (max-width: ${({ theme }) => theme.breakpoint.tablet}) {
    display: none;
  }
`;

const SignOutButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.xxs};
  padding: ${({ theme }) => `${theme.space.xxs} ${theme.space.xs}`};
  background: none;
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.text};

  ${transitioned('background-color, border-color', '120ms')}

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceSunken};
    border-color: ${({ theme }) => theme.colors.border};
  }
`;

export function Header() {
  const dispatch = useAppDispatch();
  const email = useAppSelector(selectUserEmail);

  return (
    <Bar>
      <MenuButton type="button" aria-label="Abrir menu" onClick={() => dispatch(sidebarToggled())}>
        <MenuIcon />
      </MenuButton>

      <Brand to="/dashboard">AgroHub</Brand>

      <Spacer />

      <UserEmail title={email}>{email}</UserEmail>

      <SignOutButton type="button" onClick={() => dispatch(signOut())}>
        <SignOutIcon size={18} />
        Sair
      </SignOutButton>
    </Bar>
  );
}
