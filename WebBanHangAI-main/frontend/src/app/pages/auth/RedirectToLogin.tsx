import { useEffect } from "react";
import { useNavigate } from "react-router";

export function RedirectToLogin() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/portal-admin/login", { replace: true });
  }, [navigate]);

  return null;
}
