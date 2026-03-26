import { createContext, type PropsWithChildren, useCallback, useContext, useMemo, useRef, useEffect } from "react";

type TabLeaveGuardHandler = () => Promise<boolean>;

type TabLeaveGuardContextValue = {
  confirmLeaveForRoute: (routeName: string | null) => Promise<boolean>;
  registerGuard: (
    routeName: string,
    guard: TabLeaveGuardHandler,
  ) => () => void;
};

const TabLeaveGuardContext = createContext<TabLeaveGuardContextValue | null>(null);

export function TabLeaveGuardProvider({ children }: PropsWithChildren) {
  const guardsRef = useRef(new Map<string, TabLeaveGuardHandler>());

  const registerGuard = useCallback(
    (routeName: string, guard: TabLeaveGuardHandler) => {
      guardsRef.current.set(routeName, guard);

      return () => {
        if (guardsRef.current.get(routeName) === guard) {
          guardsRef.current.delete(routeName);
        }
      };
    },
    [],
  );

  const confirmLeaveForRoute = useCallback(async (routeName: string | null) => {
    if (!routeName) {
      return true;
    }

    const guard = guardsRef.current.get(routeName);
    if (!guard) {
      return true;
    }

    return guard();
  }, []);

  const value = useMemo(
    () => ({
      confirmLeaveForRoute,
      registerGuard,
    }),
    [confirmLeaveForRoute, registerGuard],
  );

  return (
    <TabLeaveGuardContext.Provider value={value}>
      {children}
    </TabLeaveGuardContext.Provider>
  );
}

export function useTabLeaveGuard() {
  return useContext(TabLeaveGuardContext);
}

export function useRegisterTabLeaveGuard(
  routeName: string,
  guard: TabLeaveGuardHandler | null,
) {
  const context = useTabLeaveGuard();

  useEffect(() => {
    if (!context || !guard) {
      return undefined;
    }

    return context.registerGuard(routeName, guard);
  }, [context, guard, routeName]);
}
