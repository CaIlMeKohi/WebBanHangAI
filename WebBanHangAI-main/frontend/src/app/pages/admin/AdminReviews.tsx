import { useEffect, useState } from "react";
import { Check, EyeOff, Star, X } from "lucide-react";

import { apiGet, apiPut } from "../../lib/apiClient";

type ReviewStatus = "pending" | "approved" | "hidden";

type StaffReview = {
  review_id: number;
  product_id: number;
  product_name: string;
  customer_id: number;
  rating: number;
  comment?: string | null;
  image_urls?: string[];
  status: ReviewStatus;
  hidden_reason?: string;
  created_at?: string;
};

const statusLabels: Record<ReviewStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  hidden: "Đã ẩn",
};

export function AdminReviews() {
  const [reviews, setReviews] = useState<StaffReview[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "">("");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [hideTarget, setHideTarget] = useState<StaffReview | null>(null);
  const [hideReason, setHideReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function loadReviews(status: ReviewStatus | "" = statusFilter) {
    setIsLoading(true);
    setError("");
    try {
      const query = status ? `?status=${status}` : "";
      setReviews(await apiGet<StaffReview[]>(`/staff/reviews${query}`));
    } catch (loadError) {
      setReviews([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không tải được danh sách đánh giá.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadReviews(statusFilter);
  }, [statusFilter]);

  async function moderateReview(
    review: StaffReview,
    action: "approve" | "hide",
    reason = "",
  ) {
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      await apiPut(`/staff/reviews/${review.review_id}/moderate`, {
        action,
        reason,
      });
      setMessage(
        action === "approve"
          ? `Đã duyệt đánh giá #${review.review_id}.`
          : `Đã ẩn đánh giá #${review.review_id}.`,
      );
      setHideTarget(null);
      setHideReason("");
      await loadReviews();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không cập nhật được đánh giá.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function submitHide() {
    const reason = hideReason.trim();
    if (!hideTarget || !reason) {
      setError("Vui lòng nhập lý do ẩn đánh giá.");
      return;
    }
    void moderateReview(hideTarget, "hide", reason);
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-8 text-neutral-950">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Duyệt đánh giá</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Kiểm tra nội dung trước khi hiển thị trên trang sản phẩm.
            </p>
          </div>

          <label className="text-sm font-medium">
            Trạng thái
            <select
              className="ml-3 rounded border border-neutral-300 bg-white px-3 py-2"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as ReviewStatus | "")
              }
            >
              <option value="">Tất cả</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="hidden">Đã ẩn</option>
            </select>
          </label>
        </div>

        {message && (
          <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="border bg-white p-8 text-center text-sm text-neutral-500">
            Đang tải đánh giá...
          </div>
        ) : reviews.length === 0 ? (
          <div className="border bg-white p-8 text-center text-sm text-neutral-500">
            Không có đánh giá ở trạng thái này.
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <article
                key={review.review_id}
                className="border border-neutral-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{review.product_name}</div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-neutral-600">
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        {review.rating}/5
                      </span>
                      <span>Đánh giá #{review.review_id}</span>
                    </div>
                  </div>
                  <span className="rounded border border-neutral-200 px-2 py-1 text-xs font-medium">
                    {statusLabels[review.status] ?? review.status}
                  </span>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                  {review.comment || "Không có nội dung."}
                </p>

                {review.image_urls?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {review.image_urls.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer">
                        <img
                          src={url}
                          alt="Ảnh đánh giá"
                          className="h-20 w-20 border object-cover"
                        />
                      </a>
                    ))}
                  </div>
                ) : null}

                {review.hidden_reason && (
                  <div className="mt-4 text-sm text-red-700">
                    Lý do ẩn: {review.hidden_reason}
                  </div>
                )}

                <div className="mt-5 flex gap-2">
                  {review.status !== "approved" && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void moderateReview(review, "approve")}
                      className="inline-flex items-center gap-2 rounded bg-neutral-950 px-3 py-2 text-sm text-white disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      Duyệt
                    </button>
                  )}
                  {review.status !== "hidden" && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        setHideTarget(review);
                        setHideReason("");
                        setError("");
                      }}
                      className="inline-flex items-center gap-2 rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
                    >
                      <EyeOff className="h-4 w-4" />
                      Ẩn
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {hideTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !isSaving && setHideTarget(null)}
        >
          <div
            className="w-full max-w-md rounded bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Ẩn đánh giá</h2>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setHideTarget(null)}
                aria-label="Đóng"
                className="rounded p-1 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              Nhập lý do để lưu cùng kết quả kiểm duyệt.
            </p>
            <textarea
              autoFocus
              rows={4}
              value={hideReason}
              onChange={(event) => setHideReason(event.target.value)}
              className="mt-4 w-full rounded border border-neutral-300 p-3 text-sm"
              placeholder="Lý do ẩn đánh giá"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setHideTarget(null)}
                className="rounded border px-4 py-2 text-sm"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={submitHide}
                className="rounded bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {isSaving ? "Đang lưu..." : "Xác nhận ẩn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
