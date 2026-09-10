import type { RootState } from '../../app/store';

export const selectSession = (state: RootState) => state.auth.session;
export const selectIsAuthenticated = (state: RootState) => state.auth.session !== null;
export const selectUserEmail = (state: RootState) => state.auth.session?.user.email ?? '';
export const selectIsBootstrapping = (state: RootState) => state.auth.bootstrap.status === 'pending';
export const selectSignInRequest = (state: RootState) => state.auth.signIn;
export const selectSignUpRequest = (state: RootState) => state.auth.signUp;
