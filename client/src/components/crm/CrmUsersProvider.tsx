import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  type CrmTenantUser,
  type CrmOwnerDisplay,
  buildUserMap,
  resolveOwner,
} from "@/lib/crm-users";

type CrmUsersContextValue = {
  users: CrmTenantUser[];
  userMap: Map<string, CrmTenantUser>;
  resolveOwner: (ownerUserId: string | null | undefined) => CrmOwnerDisplay;
  isLoading: boolean;
};

const CrmUsersContext = createContext<CrmUsersContextValue | null>(null);

export function CrmUsersProvider({ children }: { children: ReactNode }) {
  const { data: users = [], isLoading } = useQuery<CrmTenantUser[]>({
    queryKey: ["/api/chat/users"],
  });

  const value = useMemo(() => {
    const userMap = buildUserMap(users);
    return {
      users,
      userMap,
      resolveOwner: (ownerUserId: string | null | undefined) => resolveOwner(ownerUserId, userMap),
      isLoading,
    };
  }, [users, isLoading]);

  return (
    <CrmUsersContext.Provider value={value}>
      {children}
    </CrmUsersContext.Provider>
  );
}

export function useCrmUsers() {
  const ctx = useContext(CrmUsersContext);
  if (!ctx) throw new Error("useCrmUsers must be used within CrmUsersProvider");
  return ctx;
}
