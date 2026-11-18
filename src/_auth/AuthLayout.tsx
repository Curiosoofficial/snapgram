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
          {/* my-auto instead of justify-center: if the form is taller than the
              window (e.g. in a small iframe), it starts at the top and can be
              scrolled, instead of the logo being cut off above the visible area */}
          <section className="flex flex-1 items-center flex-col py-10 px-5 overflow-y-auto custom-scrollbar">
            <div className="my-auto w-full flex justify-center">
              <Outlet />
            </div>
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
