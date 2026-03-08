import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./Login";
import AdminDashboard from "./AdminDashboard";
import BarberDashboard from "./BarberDashboard";
import ProtectedRoute from "./ProtectedRoute";
import Register from "./Register";
import ClientDashboard from "./ClientDashboard";
import ForgotPassword from "./ForgotPassword";
import PaymentSuccess from "./PaymentSuccess";
import PaymentCancel from "./PaymentCancel";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Admin dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["admin", "barbero", "recepcionista"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Barber dashboard */}
        <Route
          path="/barbero"
          element={
            <ProtectedRoute allowedRoles={["barbero"]}>
              <BarberDashboard />
            </ProtectedRoute>
          }
        />

        {/* Client dashboard */}
        <Route
          path="/cliente"
          element={
            <ProtectedRoute allowedRoles={["cliente"]}>
              <ClientDashboard />
            </ProtectedRoute>
          }
        />

        {/* Payment pages */}
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/payment-cancel" element={<PaymentCancel />} />
      </Routes>
    </BrowserRouter>
  );
}