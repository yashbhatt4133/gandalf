import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const PageTitleContext = createContext<{ title: string; setTitle: (t: string) => void }>({ title: '', setTitle: () => {} });

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('');
  return <PageTitleContext.Provider value={{ title, setTitle }}>{children}</PageTitleContext.Provider>;
}

/** Read the current breadcrumb title (used by the top bar). */
export function usePageTitleValue() {
  return useContext(PageTitleContext).title;
}

/** Set the breadcrumb title for the mounted screen; clears on unmount. */
export function usePageTitle(title: string) {
  const { setTitle } = useContext(PageTitleContext);
  useEffect(() => {
    setTitle(title);
    return () => setTitle('');
  }, [title, setTitle]);
}
