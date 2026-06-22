import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AlertCircle, ArrowLeft, CheckCircle2, CreditCard, Loader2, MapPin, QrCode } from "lucide-react";

import {
  addAddress,
  confirmMockPayment,
  createOrder,
  fetchAddresses,
  fetchCart,
  type ApiAddress,
  type ApiCartItem,
  type ApiOrder,
} from "../../lib/api";
import { CART_UPDATED_EVENT } from "../../lib/cartStorage";
import { useAdminAuth } from "../../context/AdminAuthContext";

type PaymentMethod = "cod" | "bank_transfer";
type ShippingMethod = "standard" | "express";
type FieldErrors = Partial<Record<keyof CheckoutForm | "items" | "submit", string>>;

interface CheckoutForm {
  full_name: string;
  phone: string;
  address_line: string;
  ward: string;
  district: string;
  province: string;
  postal_code: string;
}

const emptyForm: CheckoutForm = {
  full_name: "",
  phone: "",
  address_line: "",
  ward: "",
  district: "",
  province: "",
  postal_code: "",
};

function parseSelectedIds(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function formFromAddress(address?: ApiAddress): CheckoutForm {
  if (!address) return emptyForm;
  return {
    full_name: address.full_name,
    phone: address.phone,
    address_line: address.address_line,
    ward: address.ward,
    district: address.district,
    province: address.province,
    postal_code: address.postal_code ?? "",
  };
}

function sameAddress(form: CheckoutForm, address?: ApiAddress) {
  if (!address) return false;
  const current = formFromAddress(address);
  return (Object.keys(current) as Array<keyof CheckoutForm>).every(
    (key) => current[key].trim() === form[key].trim(),
  );
}

function itemPrice(item: ApiCartItem) {
  return item.unit_price ?? item.product.price;
}

function itemLineTotal(item: ApiCartItem) {
  return item.line_total ?? itemPrice(item) * item.quantity;
}

export function Checkout() {
  const { isAuthReady, userId } = useAdminAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<ApiCartItem[]>([]);
  const [addresses, setAddresses] = useState<ApiAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [form, setForm] = useState<CheckoutForm>(emptyForm);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("standard");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<ApiOrder | null>(null);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);

  const selectedIds = useMemo(() => parseSelectedIds(searchParams.get("items")), [searchParams]);
  const selectedItems = useMemo(() => {
    if (selectedIds.length === 0) return cartItems;
    return cartItems.filter((item) => selectedIds.includes(item.cart_item_id));
  }, [cartItems, selectedIds]);
  const selectedAddress = addresses.find((address) => address.address_id === selectedAddressId);
  const subtotal = selectedItems.reduce((sum, item) => sum + itemLineTotal(item), 0);
  const shippingFee =
    shippingMethod === "express" ? 50_000 : subtotal > 1_000_000 || subtotal === 0 ? 0 : 30_000;
  const total = subtotal + shippingFee;
  const gatewayUrl = createdOrder
    ? `${window.location.origin}/payment-gateway?orderId=${createdOrder.order_id}&amount=${createdOrder.final_amount}&returnTo=${encodeURIComponent("/checkout")}`
    : "";
  const qrUrl = gatewayUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(gatewayUrl)}`
    : "";

  useEffect(() => {
    if (!isAuthReady) return;
    if (!userId) {
      navigate(`/login?next=${encodeURIComponent(`/checkout?${searchParams.toString()}`)}`, { replace: true });
      return;
    }

    const activeUserId = userId;
    let isMounted = true;
    async function loadCheckout() {
      setIsLoading(true);
      setErrors({});
      try {
        const [nextCart, nextAddresses] = await Promise.all([fetchCart(activeUserId), fetchAddresses(activeUserId)]);
        if (!isMounted) return;
        setCartItems(nextCart);
        setAddresses(nextAddresses);
        const defaultAddress = nextAddresses.find((address) => address.is_default) ?? nextAddresses[0];
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.address_id);
          setForm(formFromAddress(defaultAddress));
        }
      } catch (err) {
        if (isMounted) {
          setErrors({ submit: err instanceof Error ? err.message : "Không tải được dữ liệu checkout." });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void loadCheckout();
    return () => {
      isMounted = false;
    };
  }, [isAuthReady, navigate, searchParams, userId]);

  function updateField(field: keyof CheckoutForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate() {
    const nextErrors: FieldErrors = {};
    if (selectedItems.length === 0) nextErrors.items = "Giỏ hàng không có sản phẩm hợp lệ để checkout.";
    if (selectedItems.some((item) => !item.is_available)) {
      nextErrors.items = "Có sản phẩm hết hàng hoặc không đủ tồn kho.";
    }
    if (form.full_name.trim().length < 2) nextErrors.full_name = "Nhập tên người nhận.";
    if (!/^\d{9,20}$/.test(form.phone.trim())) nextErrors.phone = "Số điện thoại phải gồm 9-20 chữ số.";
    if (!form.address_line.trim()) nextErrors.address_line = "Nhập địa chỉ giao hàng.";
    if (!form.ward.trim()) nextErrors.ward = "Nhập phường/xã.";
    if (!form.district.trim()) nextErrors.district = "Nhập quận/huyện.";
    if (!form.province.trim()) nextErrors.province = "Nhập tỉnh/thành phố.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submitCheckout() {
    if (!userId || isSubmitting || createdOrder) return;
    if (!validate()) return;
    setIsSubmitting(true);
    setErrors({});

    try {
      let addressId = selectedAddressId ?? undefined;
      if (!addressId || !sameAddress(form, selectedAddress)) {
        const savedAddress = await addAddress(userId, {
          ...form,
          is_default: true,
        });
        addressId = savedAddress.address_id;
      }

      const order = await createOrder(userId, {
        paymentMethod,
        shippingMethod,
        addressId,
        cartItemIds: selectedItems.map((item) => item.cart_item_id),
      });
      setCreatedOrder(order);
      setIsPaymentConfirmed(paymentMethod === "cod");
      window.dispatchEvent(new Event(CART_UPDATED_EVENT));
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : "Không tạo được đơn hàng." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmPayment() {
    if (!createdOrder || isSubmitting) return;
    setIsSubmitting(true);
    setErrors({});
    try {
      await confirmMockPayment(createdOrder.order_id, "bank_transfer");
      setIsPaymentConfirmed(true);
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : "Không xác nhận được thanh toán." });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-white px-4 py-12 text-center">
        <div className="text-sm text-neutral-500">Đang tải checkout...</div>
      </main>
    );
  }

  if (createdOrder && isPaymentConfirmed) {
    return (
      <main className="min-h-screen bg-white px-4 py-12">
        <section className="mx-auto max-w-2xl border p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-600" />
          <h1 className="text-2xl font-semibold">Đặt hàng thành công</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Đơn #{createdOrder.order_code || createdOrder.order_id} đã được tạo với tổng tiền{" "}
            {Number(createdOrder.final_amount).toLocaleString("vi-VN")} VND.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/profile?tab=orders" className="border px-4 py-2 text-sm">
              Xem đơn hàng
            </Link>
            <Link to="/shop" className="bg-neutral-950 px-4 py-2 text-sm text-white">
              Tiếp tục mua sắm
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-neutral-950">
      <div className="mx-auto max-w-7xl">
        <Link to="/cart" className="mb-6 inline-flex items-center gap-2 text-sm hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Quay lại giỏ hàng
        </Link>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-6">
            <div>
              <h1 className="text-3xl font-light">Checkout</h1>
              <p className="mt-1 text-sm text-neutral-500">Hoàn tất thông tin giao hàng và thanh toán.</p>
            </div>

            {errors.submit && (
              <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errors.submit}</span>
              </div>
            )}

            {addresses.length > 0 && (
              <section className="space-y-3 border p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                  <MapPin className="h-4 w-4" />
                  Địa chỉ đã lưu
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {addresses.map((address) => (
                    <button
                      key={address.address_id}
                      type="button"
                      onClick={() => {
                        setSelectedAddressId(address.address_id);
                        setForm(formFromAddress(address));
                        setErrors({});
                      }}
                      className={`border p-3 text-left text-sm ${
                        selectedAddressId === address.address_id ? "border-neutral-950 bg-neutral-950 text-white" : ""
                      }`}
                    >
                      <div className="font-medium">{address.full_name}</div>
                      <div>{address.phone}</div>
                      <div>
                        {address.address_line}, {address.ward}, {address.district}, {address.province}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-4 border p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide">Thông tin người nhận</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Họ tên"
                  value={form.full_name}
                  error={errors.full_name}
                  onChange={(value) => updateField("full_name", value)}
                />
                <Field
                  label="Số điện thoại"
                  value={form.phone}
                  error={errors.phone}
                  onChange={(value) => updateField("phone", value.replace(/\D/g, ""))}
                />
                <Field
                  label="Địa chỉ"
                  value={form.address_line}
                  error={errors.address_line}
                  onChange={(value) => updateField("address_line", value)}
                  className="md:col-span-2"
                />
                <Field label="Phường/xã" value={form.ward} error={errors.ward} onChange={(value) => updateField("ward", value)} />
                <Field
                  label="Quận/huyện"
                  value={form.district}
                  error={errors.district}
                  onChange={(value) => updateField("district", value)}
                />
                <Field
                  label="Tỉnh/thành phố"
                  value={form.province}
                  error={errors.province}
                  onChange={(value) => updateField("province", value)}
                />
                <Field
                  label="Mã bưu chính"
                  value={form.postal_code}
                  error={errors.postal_code}
                  onChange={(value) => updateField("postal_code", value)}
                />
              </div>
            </section>

            <section className="space-y-4 border p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide">Giao hàng</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <OptionButton
                  active={shippingMethod === "standard"}
                  title="Tiêu chuẩn"
                  subtitle={subtotal > 1_000_000 ? "Miễn phí" : "30.000 VND"}
                  onClick={() => setShippingMethod("standard")}
                />
                <OptionButton
                  active={shippingMethod === "express"}
                  title="Nhanh"
                  subtitle="50.000 VND"
                  onClick={() => setShippingMethod("express")}
                />
              </div>
            </section>

            <section className="space-y-4 border p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                <CreditCard className="h-4 w-4" />
                Thanh toán
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                <OptionButton
                  active={paymentMethod === "cod"}
                  title="COD"
                  subtitle="Thanh toán khi nhận hàng"
                  onClick={() => setPaymentMethod("cod")}
                />
                <OptionButton
                  active={paymentMethod === "bank_transfer"}
                  title="Chuyển khoản"
                  subtitle="Quét QR sau khi tạo đơn"
                  onClick={() => setPaymentMethod("bank_transfer")}
                />
              </div>
            </section>

            {createdOrder && paymentMethod === "bank_transfer" && (
              <section className="border p-5 text-center">
                <QrCode className="mx-auto mb-3 h-8 w-8" />
                <h2 className="font-semibold">Thanh toán đơn #{createdOrder.order_code}</h2>
                <img src={qrUrl} alt="QR thanh toán" className="mx-auto mt-4 h-56 w-56" />
                <a href={gatewayUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block border px-4 py-2 text-sm">
                  Mở cổng thanh toán
                </a>
                <button
                  onClick={() => void confirmPayment()}
                  disabled={isSubmitting}
                  className="ml-3 inline-flex items-center gap-2 bg-neutral-950 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Đã thanh toán
                </button>
              </section>
            )}
          </section>

          <aside className="h-fit border bg-neutral-50 p-5">
            <h2 className="mb-4 text-lg font-semibold">Đơn hàng</h2>
            {errors.items && (
              <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{errors.items}</div>
            )}
            <div className="max-h-80 space-y-3 overflow-auto pr-1">
              {selectedItems.map((item) => (
                <div key={item.cart_item_id} className="flex gap-3 border-b pb-3 text-sm">
                  <img src={item.product.image} alt={item.product.name} className="h-16 w-12 object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{item.product.name}</div>
                    <div className="text-neutral-500">
                      {item.size} / {item.color} x {item.quantity}
                    </div>
                  </div>
                  <div className="font-medium">{itemLineTotal(item).toLocaleString("vi-VN")}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Tạm tính</span>
                <strong>{subtotal.toLocaleString("vi-VN")} VND</strong>
              </div>
              <div className="flex justify-between">
                <span>Vận chuyển</span>
                <strong>{shippingFee === 0 ? "Miễn phí" : `${shippingFee.toLocaleString("vi-VN")} VND`}</strong>
              </div>
              <div className="flex justify-between border-t pt-3 text-lg">
                <span>Tổng cộng</span>
                <strong>{total.toLocaleString("vi-VN")} VND</strong>
              </div>
            </div>
            <button
              onClick={() => void submitCheckout()}
              disabled={isSubmitting || selectedItems.length === 0 || Boolean(createdOrder)}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 bg-neutral-950 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {createdOrder ? "Đơn đã được tạo" : "Đặt hàng"}
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  error,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-neutral-600">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full border px-3 py-2 outline-none focus:border-neutral-950 ${error ? "border-red-400" : "border-neutral-300"}`}
      />
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  );
}

function OptionButton({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border p-4 text-left text-sm ${
        active ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white"
      }`}
    >
      <div className="font-medium">{title}</div>
      <div className="mt-1 opacity-75">{subtitle}</div>
    </button>
  );
}
