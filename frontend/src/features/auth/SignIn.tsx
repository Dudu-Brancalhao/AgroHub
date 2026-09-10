import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { AuthLayout, Form, FormFooter } from './AuthLayout';
import { signIn } from './authSlice';
import { selectSignInRequest } from './selectors';
import { validateEmail, validateRequiredPassword } from './validation';

type LocationState = { from?: { pathname: string } };

export function SignIn() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const request = useAppSelector(selectSignInRequest);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const busy = request.status === 'pending';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const emailError = validateEmail(email);
    const passwordError = validateRequiredPassword(password);

    if (emailError || passwordError) {
      setErrors({ email: emailError ?? undefined, password: passwordError ?? undefined });
      return;
    }

    setErrors({});
    const result = await dispatch(signIn({ email: email.trim(), password }));

    if (signIn.fulfilled.match(result)) {
      // FR-010: return to whatever the visitor originally asked for.
      const from = (location.state as LocationState | null)?.from?.pathname ?? '/dashboard';
      navigate(from, { replace: true });
      return;
    }

    // The password is cleared on failure so a shoulder-surfed or mistyped value is not left
    // sitting in the field, and the visitor retypes deliberately.
    setPassword('');
  }

  return (
    <AuthLayout title="Entrar" subtitle="Acesse o cadastro de produtores rurais.">
      <Form onSubmit={handleSubmit} noValidate>
        {request.status === 'failed' && request.error && <ErrorState message={request.error} />}

        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          error={errors.email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <TextField
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <Button type="submit" busy={busy} fullWidth>
          Entrar
        </Button>
      </Form>

      <FormFooter>
        Ainda não tem conta? <Link to="/criar-conta">Criar conta</Link>
      </FormFooter>
    </AuthLayout>
  );
}
