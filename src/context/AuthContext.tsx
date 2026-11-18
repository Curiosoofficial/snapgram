import { getCurrentUser } from '@/lib/api';
import { IContextType, IUser } from '@/types'
import { createContext, useContext, useEffect, useState } from 'react'

export const INITIAL_USER: IUser = {
    id: '',
    name: '',
    username: '',
    email: '',
    imageUrl: '',
    bio: ''
}

const INITIAL_STATE = {
    user: INITIAL_USER,
    isLoading: true,
    isAuthenticated: false,
    setUser: () => {},
    setIsAuthenticated: () => {},
    checkAuthUser: async () => false as boolean,
}

const AuthContext = createContext<IContextType>(INITIAL_STATE);

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<IUser>(INITIAL_USER)
  // true until the first session check is done, so protected pages
  // show a loader instead of redirecting too early
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuthUser = async () => {
    setIsLoading(true);
    try {
      const currentAccount = await getCurrentUser();

      if (currentAccount) {
        setUser({
            id: currentAccount.$id,
            name: currentAccount.name,
            username: currentAccount.username,
            email: currentAccount.email,
            // was "currentAccount.ImageUrl" (capital I) -> always undefined,
            // so the profile picture never showed up in the sidebar/topbar
            imageUrl: currentAccount.imageUrl,
            bio: currentAccount.bio
        })

        setIsAuthenticated(true);

        return true;
      }

      return false;
    } catch (error) {
        console.log(error)
        return false;
    } finally {
        setIsLoading(false);
    }
  };

  // Check once on page load whether a session exists. The redirect to
  // /sign-in now happens in RootLayout. The old check read
  // localStorage "coockieFallback" (typo) and only worked with Appwrite.
  useEffect(() => {
    checkAuthUser();
  }, []);

  const value = {
    user,
    setUser,
    isLoading,
    isAuthenticated,
    setIsAuthenticated,
    checkAuthUser
  }

  return (
    <AuthContext.Provider value={value}>
        {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider;

export const useUserContext = () => useContext(AuthContext)
