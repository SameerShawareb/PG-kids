import React, { createContext, useContext, useState } from 'react';

interface Child {
  _id: string;
  name: string;
  age: number;
  avatar: string;
  favoritedWorlds: string[]; // references world ids
}

interface ChildContextType {
  activeChild: Child | null;
  setActiveChild: (child: Child | null) => void;
}

const ACTIVE_CHILD_STORAGE_KEY = 'pgkids_active_child';

const ChildContext = createContext<ChildContextType | undefined>(undefined);

export const ChildProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeChild, setActiveChildState] = useState<Child | null>(() => {
    try {
      const raw = localStorage.getItem(ACTIVE_CHILD_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      localStorage.removeItem(ACTIVE_CHILD_STORAGE_KEY);
      return null;
    }
  });

  const setActiveChild = (child: Child | null) => {
    setActiveChildState(child);
    if (!child) {
      localStorage.removeItem(ACTIVE_CHILD_STORAGE_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_CHILD_STORAGE_KEY, JSON.stringify(child));
  };

  return (
    <ChildContext.Provider value={{ activeChild, setActiveChild }}>
      {children}
    </ChildContext.Provider>
  );
};

export const useChild = () => {
  const context = useContext(ChildContext);
  if (!context) throw new Error('useChild must be used within ChildProvider');
  return context;
};
