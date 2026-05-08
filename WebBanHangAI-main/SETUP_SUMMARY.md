# 📦 Setup Summary - Frontend/Backend Separation & Admin Panel

## ✅ Hoàn Thành

### 1. ✨ Tách Frontend & Backend

- Tạo thư mục `frontend/` chứa tất cả file FE (React/Vite)
- Giữ `backend/` ở root level với cấu trúc Django
- **Cấu trúc mới:**
  ```
  WebBanHang/
  ├── frontend/
  │   ├── src/
  │   ├── index.html
  │   ├── package.json
  │   ├── vite.config.ts
  │   └── ...
  ├── backend/
  │   ├── manage.py
  │   ├── config/
  │   ├── products/
  │   └── ...
  ├── .venv/
  └── node_modules/ (nên di chuyển vào frontend/)
  ```

### 2. 🔧 Cập Nhật Cấu Hình

| File                      | Thay Đổi                                              |
| ------------------------- | ----------------------------------------------------- |
| `frontend/package.json`   | Cập nhật scripts để tham chiếu `../backend/manage.py` |
| `frontend/vite.config.ts` | Thêm proxy API tới `http://127.0.0.1:8000`            |

### 3. 🛠️ Backend CRUD API

**File được tạo/sửa:**

- `backend/products/views.py` - Thêm:
  - `ProductAdminListCreateAPIView` (GET/POST)
  - `ProductAdminUpdateDeleteAPIView` (PUT/DELETE)
- `backend/products/serializers.py` - Thêm:
  - `ProductAdminSerializer` (hỗ trợ create/update/delete)
- `backend/products/urls.py` - Thêm routes:
  - `GET/POST /api/products/admin/products/`
  - `GET/PUT/DELETE /api/products/admin/products/{id}/`

### 4. 👨‍💼 Admin Frontend Pages

**File được tạo:**

- `frontend/src/app/components/AdminLayout.tsx` - Layout sidebar cho admin
- `frontend/src/app/components/ProductAdmin.tsx` - Danh sách sản phẩm + buttons
- `frontend/src/app/components/ProductAdminForm.tsx` - Form thêm/sửa sản phẩm

**File được sửa:**

- `frontend/src/app/routes.ts` - Thêm admin routes:
  - `/admin` → AdminLayout
  - `/admin/products` → ProductAdmin
- `frontend/src/app/lib/api.ts` - Thêm functions:
  - `fetchAdminProducts()` - GET danh sách
  - `createAdminProduct()` - POST tạo
  - `updateAdminProduct()` - PUT sửa
  - `deleteAdminProduct()` - DELETE xóa

### 5. 📖 Tài Liệu

- `ADMIN_GUIDE.md` - Hướng dẫn chi tiết sử dụng admin panel
- `SETUP_SUMMARY.md` (file này) - Tóm tắt setup

## 🚀 Chạy Ứng Dụng

### Option 1: Backend + Frontend riêng lẻ

**Terminal 1 - Backend:**

```bash
cd backend
python manage.py runserver
# Chạy tại http://127.0.0.1:8000
```

**Terminal 2 - Frontend:**

```bash
cd frontend
npm install
npm run dev
# Chạy tại http://127.0.0.1:5173
```

### Option 2: Chạy cả hai (nếu cài `concurrently`)

**Từ thư mục frontend:**

```bash
npm run dev:django
```

## 📝 Chuẩn Bị Database

Nếu bảng database chưa được tạo:

```bash
cd backend

# Tạo migration files
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Load dữ liệu mẫu (từ frontend folder)
cd ../frontend
npm run seed:api
```

## 🌐 Truy Cập Admin Panel

1. Khởi động backend + frontend
2. Truy cập: **http://127.0.0.1:5173/admin/products**
3. Nhấn "Add Product" để thêm sản phẩm mới
4. Click Edit/Delete để sửa/xóa

## ⚙️ API Endpoints

| Method | Endpoint                             | Mô Tả                           |
| ------ | ------------------------------------ | ------------------------------- |
| GET    | `/api/products/`                     | Lấy danh sách sản phẩm (public) |
| GET    | `/api/products/{id}/`                | Chi tiết sản phẩm               |
| GET    | `/api/products/admin/products/`      | Danh sách admin (tất cả)        |
| POST   | `/api/products/admin/products/`      | Tạo sản phẩm                    |
| PUT    | `/api/products/admin/products/{id}/` | Sửa sản phẩm                    |
| DELETE | `/api/products/admin/products/{id}/` | Xóa sản phẩm                    |

## ⚠️ Lưu Ý

1. **Chưa có authentication**
   - Admin endpoint hiện không có permission check
   - Trong production, thêm `IsAdminUser` permission

2. **Chưa hỗ trợ upload ảnh**
   - Dùng URL ảnh từ Unsplash hoặc server khác
   - Để upload file, cần tích hợp storage

3. **Cấu hình proxy**
   - Frontend proxy `/api` → Backend `http://127.0.0.1:8000`
   - Nếu backend URL khác, cập nhật `vite.config.ts`

4. **node_modules**
   - Hiện tại ở root, nên di chuyển vào `frontend/`
   - Cập nhật `.gitignore` nếu cần

## 📦 Tiếp Theo (Optional)

- [ ] Thêm authentication / login page
- [ ] Validate form phía server
- [ ] Pagination cho admin list
- [ ] Search/filter sản phẩm
- [ ] Upload ảnh trực tiếp
- [ ] Quản lý categories/brands
- [ ] Analytics dashboard
- [ ] Lịch sử thay đổi (audit log)

## 🎯 Trạng Thái Tính Năng

| Tính Năng                  | Trạng Thái    | Ghi Chú                     |
| -------------------------- | ------------- | --------------------------- |
| Danh sách sản phẩm (admin) | ✅ Hoàn thành | Hiển thị tất cả             |
| Thêm sản phẩm              | ✅ Hoàn thành | Form với validation cơ bản  |
| Sửa sản phẩm               | ✅ Hoàn thành | Tải dữ liệu hiện tại        |
| Xóa sản phẩm               | ✅ Hoàn thành | Xác nhận trước khi xóa      |
| Authentication             | ❌ TODO       | Chưa implement              |
| Authorization              | ❌ TODO       | Bất cứ ai cũng có quyền     |
| Pagination                 | ⏳ TODO       | Cần thêm khi sản phẩm > 100 |
| Upload ảnh                 | ❌ TODO       | Dùng URL image tạm thời     |

Để biết thêm chi tiết, xem [ADMIN_GUIDE.md](./ADMIN_GUIDE.md)
