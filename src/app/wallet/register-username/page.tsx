'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/providers/AuthProvider';
import { 
  checkUsernameAvailability, 
  validateUsernameFormat, 
  registerUsername 
} from '@/lib/username';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, CheckCircle, XCircle, User, Loader2, Sparkles } from 'lucide-react';

export default function RegisterUsernamePage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [username, setUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!username) {
      setIsAvailable(null);
      setValidationError(null);
      return;
    }

    const formatResult = validateUsernameFormat(username);
    if (!formatResult.valid) {
      setValidationError(formatResult.error || 'Invalid username');
      setIsAvailable(null);
      return;
    }

    setValidationError(null);
    const timeoutId = setTimeout(async () => {
      setIsChecking(true);
      try {
        const available = await checkUsernameAvailability(username);
        setIsAvailable(available.available ?? null);
      } catch (error) {
        console.error('Error checking availability:', error);
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleRegister = async () => {
    if (!user) {
      setErrorMessage('You must be logged in to register a username');
      return;
    }

    if (!isAvailable) {
      setErrorMessage('This username is not available');
      return;
    }

    setIsRegistering(true);
    setErrorMessage(null);
    
    try {
      await registerUsername(username, '');
      setSuccessMessage(`Success! Your username @${username} has been registered.`);
      setTimeout(() => {
        router.push('/wallet');
      }, 2000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to register username');
    } finally {
      setIsRegistering(false);
    }
  };

  const getStatusIcon = () => {
    if (isChecking) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
    if (validationError) return <XCircle className="h-5 w-5 text-destructive" />;
    if (isAvailable === true) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (isAvailable === false) return <XCircle className="h-5 w-5 text-destructive" />;
    return null;
  };

  const getStatusText = () => {
    if (isChecking) return 'Checking availability...';
    if (validationError) return validationError;
    if (isAvailable === true) return ' Available!';
    if (isAvailable === false) return ' Already taken';
    return 'Enter a username to check availability';
  };

  const getStatusColor = () => {
    if (validationError || isAvailable === false) return 'text-destructive';
    if (isAvailable === true) return 'text-green-500';
    return 'text-muted-foreground';
  };

  if (!user) {
    return (
      <div className="container max-w-2xl mx-auto py-16 px-4">
        <Alert>
          <AlertDescription>
            You must be logged in to register a username. Please <a href="/auth/login" className="underline">log in</a> first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Button variant="ghost" onClick={() => router.push('/wallet')} className="mb-6 -ml-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Wallet
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-3xl">Register Username</CardTitle>
          </div>
          <CardDescription className="text-lg">
            Create a unique username for your wallet. Others can send you SOL using @username instead of your long wallet address.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {successMessage ? (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-900 dark:text-green-200">
                {successMessage}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    placeholder="satoshi"
                    className="pl-8 pr-12"
                    maxLength={20}
                    disabled={isRegistering}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {getStatusIcon()}
                  </div>
                </div>
                <p className={`text-sm ${getStatusColor()}`}>
                  {getStatusText()}
                </p>
              </div>

              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  <strong>Username Requirements:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>3-20 characters long</li>
                    <li>Lowercase letters, numbers, underscores only</li>
                    <li>Must start with a letter</li>
                    <li>Cannot end with underscore</li>
                    <li>No consecutive underscores</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {errorMessage && (
                <Alert className="bg-destructive/10 border-destructive/20">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-destructive">
                    {errorMessage}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleRegister}
                disabled={!isAvailable || isRegistering || isChecking}
                className="w-full"
                size="lg"
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Register @{username || 'username'}
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
