import { Outlet, Navigate } from 'react-router-dom';
import { useUserContext } from '@/context/AuthContext';

const AuthLayout = () => {
  // was hard-coded to false, so logged-in users still saw the sign-in page
  const { isAuthenticated } = useUserContext();

  return (
    <>
      {isAuthenticated ? (
        <Navigate to="/" replace />
      ) : (
        <>
          <section className="flex flex-1 justify-center items-center flex-col py-10 px-5 overflow-y-auto custom-scrollbar">
            <Outlet />
          </section>

          {/* 3.3 MB image, lazy so it is not downloaded on small screens where it is hidden */}
          <img
            src="/assets/images/side-img.svg"
            alt="logo"
            loading="lazy"
            className="hidden xl:block h-screen w-1/2 object-cover bg-no-repeat"
          />
        </>
      )}
    </>
  )
}

export default AuthLayout
