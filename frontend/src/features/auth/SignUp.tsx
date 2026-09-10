import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { AuthLayout, Form, FormFooter } from './AuthLayout';
import { signUp } from './authSlice';
import { selectSignUpRequest } from './selectors';
import { validateEmail, validateNewPassword } from './validation';

export function SignUp() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const request = useAppSelector(selectSignUpRequest);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const busy = request.status === 'pending';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const emailError = validateEmail(email);
    const passwordError = validateNewPassword(password);

    if (emailError || passwordError) {
      setErrors({ email: emailError ?? undefined, password: passwordError ?? undefined });
      return;
    }

    setErrors({});
    const result = await dispatch(signUp({ email: email.trim(), password }));

    if (signUp.fulfilled.match(result)) {
      // The thunk already chained register -> login, so there is nothing left to type.
      navigate('/dashboard', { replace: true });
      return;
    }

    setPassword('');
  }

  return (
    <AuthLayout title="Criar conta" subtitle="Crie sua conta para acessar o AgroHub.">
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
          autoComplete="new-password"
          value={password}
          error={errors.password}
          hint="No mínimo 8 caracteres, com pelo menos uma letra e um número."
          onChange={(event) => setPassword(event.target.value)}
        />

        <Button type="submit" busy={busy} fullWidth>
          Criar conta
        </Button>
      </Form>

      <FormFooter>
        Já tem conta? <Link to="/entrar">Entrar</Link>
      </FormFooter>
    </AuthLayout>
  );
}
