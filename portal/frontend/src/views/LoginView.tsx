import { useState, useEffect } from 'react';

interface LoginViewProps {
  onLogin: (username: string) => Promise<void>;
  loginError?: string;
  isLoggingIn?: boolean;
}

export function LoginView({ onLogin, loginError, isLoggingIn }: LoginViewProps) {
  const [usernameInput, setUsernameInput] = useState('testuser');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (loginError) {
      setLocalError(loginError);
    }
  }, [loginError]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLocalError('');
    if (!usernameInput.trim()) {
      setLocalError('Username cannot be empty');
      return;
    }
    onLogin(usernameInput);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-bg-primary select-none animate-fade-in">
      <div
        id="login-container"
        className="w-full max-w-md p-8 bg-bg-secondary/80 border border-card-border rounded-3xl backdrop-blur-xl shadow-2xl text-center animate-fade-in-up"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-accent-purple text-xs font-semibold uppercase tracking-wider mb-6">
          <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse"></span>
          Authentication Required
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-white">Arcade Portal</h1>
        <p className="text-text-muted text-sm mb-6 leading-relaxed">
          Access your secure containerized game environment.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-left text-xs font-semibold text-text-muted uppercase tracking-wider mb-2"
            >
              Username
            </label>
            <input
              id="username"
              data-focusable="username-input"
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="w-full px-4 py-3 bg-bg-primary border border-card-border rounded-xl text-white transition-all console-focusable focus:border-focus-ring focus:ring-2 focus:ring-focus-ring"
              placeholder="Enter username"
              disabled={isLoggingIn}
              autoFocus
            />
          </div>
          {localError && <p className="text-red-400 text-xs text-left animate-pulse">{localError}</p>}
          
          <button
            type="submit"
            data-focusable="login-btn"
            onClick={handleSubmit}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg active:scale-95 console-focusable cursor-pointer"
            disabled={isLoggingIn}
          >
            {isLoggingIn ? 'Logging In...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}
export default LoginView;
