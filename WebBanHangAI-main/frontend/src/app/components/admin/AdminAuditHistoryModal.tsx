import { X } from "lucide-react";

import type { AdminProductHistoryItem } from "../../lib/api";

type Props = {
  title: string;
  items: AdminProductHistoryItem[];
  isLoading: boolean;
  onClose: () => void;
};

const actionLabels: Record<string, string> = {
  create_product: "Thêm sản phẩm",
  update_product: "Sửa sản phẩm",
  delete_product: "Xóa sản phẩm",
  create_staff: "Thêm tài khoản",
  update_user: "Sửa tài khoản",
  delete_user: "Xóa tài khoản",
  lock_user: "Khóa tài khoản",
  unlock_user: "Mở khóa tài khoản",
  create_coupon: "Thêm coupon",
  update_coupon: "Sửa coupon",
  delete_coupon: "Xóa coupon",
};

const actionResultLabels: Record<string, string> = {
  create_product: "Đã thêm thành công",
  update_product: "Đã sửa thành công",
  delete_product: "Đã xóa thành công",
  create_staff: "Đã thêm thành công",
  update_user: "Đã sửa thành công",
  delete_user: "Đã xóa thành công",
  lock_user: "Đã sửa thành công",
  unlock_user: "Đã sửa thành công",
  create_coupon: "Đã thêm thành công",
  update_coupon: "Đã sửa thành công",
  delete_coupon: "Đã xóa thành công",
};

export function AdminAuditHistoryModal({
  title,
  items,
  isLoading,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 p-5">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Hiển thị các thao tác thêm, sửa, xóa gần nhất đã được ghi nhận.
            </p>
          </div>
          <button
            className="rounded p-2 hover:bg-neutral-100"
            onClick={onClose}
            aria-label="Đóng lịch sử"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {isLoading ? (
            <div className="py-10 text-center text-sm text-neutral-500">
              Đang tải lịch sử...
            </div>
          ) : items.length > 0 ? (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.audit_id}
                  className="rounded-lg border border-neutral-200 p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">
                      {actionLabels[item.action] ?? item.action}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {new Date(item.created_at).toLocaleString("vi-VN")}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    Người thao tác: {item.actor_email || "Không rõ"} · Đối
                    tượng: {item.entity_type || "-"} #{item.entity_id || "-"}
                  </div>
                  <div className="mt-3 space-y-3">
                    <ActionResult item={item} />
                    {item.old_value && (
                      <HistoryJsonBlock
                        title="Trước thao tác"
                        value={item.old_value}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-neutral-500">
              Chưa có lịch sử thao tác phù hợp.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionResult({ item }: { item: AdminProductHistoryItem }) {
  const metadata = item.metadata ?? {};
  const success = metadata.success !== false && metadata.status !== "failed";
  const reason = String(
    metadata.reason ?? metadata.error ?? metadata.detail ?? "",
  ).trim();

  if (success) {
    return (
      <div className="rounded bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
        {actionResultLabels[item.action] ?? "Thao tác thành công"}
      </div>
    );
  }

  return (
    <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
      <div className="font-medium">Không thành công</div>
      {reason && <div className="mt-1">Lý do: {reason}</div>}
    </div>
  );
}

function HistoryJsonBlock({
  title,
  value,
}: {
  title: string;
  value: Record<string, unknown>;
}) {
  return (
    <div className="rounded bg-neutral-50 p-3">
      <div className="mb-2 text-xs font-medium text-neutral-600">{title}</div>
      <pre className="whitespace-pre-wrap break-words text-xs text-neutral-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
