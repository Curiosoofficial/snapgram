import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { INITIAL_USER, useUserContext } from "@/context/AuthContext";
import { useSignOutAccount } from "@/lib/react-query/queriesAndMutations";

// Used by the left sidebar (desktop) and the topbar (mobile).
// Before, both did signOut() + navigate('/sign-in') + a full page reload.
export default function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setUser, setIsAuthenticated } = useUserContext();
  const { mutateAsync: signOutAccount, isPending } = useSignOutAccount();

  const signOut = async () => {
    await signOutAccount();
    setUser(INITIAL_USER);
    setIsAuthenticated(false);
    navigate("/sign-in");
    // Remove the cached data of this user, so the next login starts clean
    queryClient.removeQueries();
  };

  return { signOut, isSigningOut: isPending };
}
