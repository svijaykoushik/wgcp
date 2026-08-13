import { createContext, useContext, ReactNode } from 'react';
import { useInputMode, InputMode } from '../hooks/useInputMode';

const InputContext = createContext<InputMode>('keyboard');

export function InputProvider({ children }: { children: ReactNode }) {
  const mode = useInputMode();
  return (
    <InputContext.Provider value={mode}>
      {children}
    </InputContext.Provider>
  );
}

export const useInput = () => useContext(InputContext);
export default InputContext;
