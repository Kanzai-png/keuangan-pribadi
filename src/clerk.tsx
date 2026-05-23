import { ClerkProvider } from '@clerk/clerk-react';

const CLERK_KEY = 'pk_test_c2FmZS1mZXJyZXQtODguY2xlcmsuYWNjb3VudHMuZGV2JA';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <ClerkProvider publishableKey={CLERK_KEY} >
      {children}
    </ClerkProvider>
  );
}
