import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, allowedRoles }) {
  const isAuth = localStorage.getItem("auth") === "true";

  if (!isAuth) {
    return <Navigate to="/login" />;
  }

  // If roles are specified, check the user's role
  if (allowedRoles && allowedRoles.length > 0) {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (!allowedRoles.includes(user.rol)) {
        // Redirect to the appropriate dashboard
        if (user.rol === "cliente") {
          return <Navigate to="/cliente" />;
        }
        return <Navigate to="/dashboard" />;
      }
    } catch {
      return <Navigate to="/login" />;
    }
  }

  return children;
}