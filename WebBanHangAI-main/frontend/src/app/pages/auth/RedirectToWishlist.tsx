import { useEffect } from "react";
import { useNavigate } from "react-router";

export function RedirectToWishlist() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/profile?tab=wishlist", { replace: true });
  }, [navigate]);

  return null;
}
