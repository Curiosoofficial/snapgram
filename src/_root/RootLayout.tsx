import Bottombar from '@/components/ui/shared/Bottombar'
import LeftSidebar from '@/components/ui/shared/LeftSidebar'
import Loader from '@/components/ui/shared/Loader'
import Topbar from '@/components/ui/shared/Topbar'
import { useUserContext } from '@/context/AuthContext'

import { Navigate, Outlet } from 'react-router-dom'

const RootLayout = () => {
  const { isAuthenticated, isLoading } = useUserContext();

  // Protected routes: wait for the session check, then redirect guests
  if (!isAuthenticated) {
    return isLoading ? (
      <div className="flex-center w-full h-screen">
        <Loader />
      </div>
    ) : (
      <Navigate to="/sign-in" replace />
    );
  }

  return (
    <div className="w-full md:flex">
      <Topbar />
      <LeftSidebar />

      <section className="flex flex-1 h-full">
        <Outlet />
      </section>

      <Bottombar />
    </div>
  )
}

export default RootLayout
