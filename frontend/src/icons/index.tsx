import SpaceDashboardRounded from '@mui/icons-material/SpaceDashboardRounded';
import PeopleAltRounded from '@mui/icons-material/PeopleAltRounded';
import SpaRounded from '@mui/icons-material/SpaRounded';
import MenuRounded from '@mui/icons-material/MenuRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import EditOutlined from '@mui/icons-material/EditOutlined';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import AgricultureRounded from '@mui/icons-material/AgricultureRounded';
import LocalFloristRounded from '@mui/icons-material/LocalFloristRounded';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import type { ComponentType } from 'react';

/**
 * The application's icon set, from Material Icons.
 *
 * Every icon is re-exported behind this module rather than imported directly at call sites, so
 * the rest of the codebase names icons by *role* (`ProducersIcon`) rather than by glyph
 * (`GroupsRounded`). Swapping a glyph — or the whole library — is then a change to this file
 * alone.
 *
 * Imported one deep path at a time (`@mui/icons-material/BarChartRounded`) rather than as named
 * imports from the package root: the root barrel is ~2000 modules, and only per-icon paths keep
 * that out of the dev-server graph and the bundle.
 */

/** Preserves the `size` prop the rest of the codebase already passes. */
type IconProps = Omit<SvgIconProps, 'fontSize'> & { size?: number };

function withSize(Icon: ComponentType<SvgIconProps>, defaultSize = 20) {
  return function SizedIcon({ size = defaultSize, ...props }: IconProps) {
    return (
      <Icon
        {...props}
        // Icons here always sit beside a text label that carries the meaning, so they are
        // decorative; a caller that needs an announced icon passes its own aria-label.
        aria-hidden={props['aria-label'] ? undefined : true}
        sx={{ fontSize: size, ...props.sx }}
      />
    );
  };
}

export const DashboardIcon = withSize(SpaceDashboardRounded);
export const ProducersIcon = withSize(PeopleAltRounded);
export const HarvestIcon = withSize(SpaRounded);
export const FarmIcon = withSize(AgricultureRounded);

/** A marca. Aparece ao lado do nome, no canto superior esquerdo. */
export const BrandIcon = withSize(LocalFloristRounded);

export const MenuIcon = withSize(MenuRounded);
export const CloseIcon = withSize(CloseRounded);
export const ChevronLeftIcon = withSize(ChevronLeftRounded);
export const ChevronRightIcon = withSize(ChevronRightRounded);

export const PlusIcon = withSize(AddRounded);
export const PencilIcon = withSize(EditOutlined);
export const TrashIcon = withSize(DeleteOutlineRounded);
export const SearchIcon = withSize(SearchRounded);

export const AlertIcon = withSize(ErrorOutlineRounded);
export const CheckIcon = withSize(CheckCircleOutlineRounded);
export const SignOutIcon = withSize(LogoutRounded);
