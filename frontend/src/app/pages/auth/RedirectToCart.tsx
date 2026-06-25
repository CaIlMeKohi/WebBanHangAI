import { useEffect } from "react";
import { useNavigate } from "react-router";

export function RedirectToCart() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/profile?tab=cart", { replace: true });
  }, [navigate]);

  return null;
}
