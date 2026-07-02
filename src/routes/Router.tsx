import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "../pages/Home/Home";
import Search from "../pages/Search/Search";
import AccommodationDetail from "../pages/AccommodationDetail/AccommodationDetail";
import AccommodationEdit from "../pages/AccommodationEdit/AccommodationEdit";
import Wishlist from "../pages/Wishlist/Wishlist";
import Profile from "../pages/Profile/Profile";
import ReservationDetail from "../pages/Reservations/ReservationDetail";
import HostReservationDetail from "../pages/Profile/HostReservationDetail/HostReservationDetail";
import ReservationConfirm from "../pages/Reservations/ReservationConfirm";
import ReviewCreate from "../pages/Reservations/ReviewCreate";
import PaymentSuccess from "../pages/Reservations/PaymentSuccess";
import PaymentFail from "../pages/Reservations/PaymentFail";
import Login from "../pages/Auth/Login/Login";
import Signup from "../pages/Auth/Signup/Signup";
import NotFound from "../pages/NotFound/NotFound";
import { ROUTE_PATHS } from "./paths";
import RequireAuth from "./RequireAuth";

const Router = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTE_PATHS.home} element={<Home />} />
        <Route path={ROUTE_PATHS.search} element={<Search />} />
        <Route path={ROUTE_PATHS.accommodationDetail} element={<AccommodationDetail />} />
        <Route path={ROUTE_PATHS.accommodationConfirm} element={<ReservationConfirm />} />
        <Route
          path={ROUTE_PATHS.accommodationEdit}
          element={
            <RequireAuth>
              <AccommodationEdit />
            </RequireAuth>
          }
        />
        <Route
          path={ROUTE_PATHS.wishlist}
          element={
            <RequireAuth>
              <Wishlist />
            </RequireAuth>
          }
        />
        <Route
          path={ROUTE_PATHS.profile}
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />
        <Route
          path={ROUTE_PATHS.hostReservationDetail}
          element={
            <RequireAuth>
              <HostReservationDetail />
            </RequireAuth>
          }
        />
        <Route
          path={ROUTE_PATHS.reservationDetail}
          element={
            <RequireAuth>
              <ReservationDetail />
            </RequireAuth>
          }
        />
        <Route
          path={ROUTE_PATHS.reviewCreate}
          element={
            <RequireAuth>
              <ReviewCreate />
            </RequireAuth>
          }
        />
        <Route
          path={ROUTE_PATHS.paymentSuccess}
          element={
            <RequireAuth>
              <PaymentSuccess />
            </RequireAuth>
          }
        />
        <Route
          path={ROUTE_PATHS.paymentFail}
          element={
            <RequireAuth>
              <PaymentFail />
            </RequireAuth>
          }
        />
        <Route path={ROUTE_PATHS.login} element={<Login />} />
        <Route path={ROUTE_PATHS.signup} element={<Signup />} />
        <Route path={ROUTE_PATHS.notFound} element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default Router;
