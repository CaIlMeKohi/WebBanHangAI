# Admin Panel Guide

## 📋 Tổng Quan

Admin panel cho phép bạn quản lý sản phẩm (thêm, sửa, xóa) từ giao diện web. Hiện tại, panel chưa có xác thực, vì vậy bất cứ ai truy cập `/admin/products` đều có thể thao tác.

## 🚀 Khởi Động

### 1. Backend

```bash
cd backend
python manage.py runserver
```

Backend sẽ chạy tại: `http://127.0.0.1:8000`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend sẽ chạy tại: `http://127.0.0.1:5173`

### 3. Hoặc chạy cả hai cùng lúc

Từ thư mục `frontend`:

```bash
npm run dev:django
```

(Cần cài `concurrently` trong `package.json`)

## 📍 Truy Cập Admin Panel

1. Mở browser, truy cập: **`http://127.0.0.1:5173/admin/products`**
2. Bạn sẽ thấy danh sách tất cả sản phẩm (kể cả inactive)

## ✨ Các Tính Năng

### Liệt Kê Sản Phẩm

- Hiển thị tất cả sản phẩm (có thể hỏng nếu bạn chỉnh sửa trực tiếp DB)
- Xem: Name, Price, Stock, Category
- Tìm kiếm: Chưa có (có thể thêm sau)

### Thêm Sản Phẩm Mới

1. Nhấn nút **"Add Product"** (góc phải)
2. Điền form:
   - **Product Name\*** (bắt buộc): Tên sản phẩm
   - **Slug\*** (bắt buộc): URL-friendly name (vd: "ao-thun-trang")
   - **Description\*** (bắt buộc): Mô tả chi tiết
   - **Price\*** (bắt buộc): Giá gốc (VND)
   - **Sale Price**: Giá giảm (nếu có)
   - **Stock\*** (bắt buộc): Số lượng tồn kho
   - **Category\*** (bắt buộc): Chọn danh mục (Ao Thun, Quan, etc.)
   - **Brand**: Chọn thương hiệu (Essence Basics, Essence Studio)
   - **Feature Text**: Từ khóa đặc trưng (vd: "cotton trắng tối giản")
   - **Image URL\*** (bắt buộc): Link ảnh sản phẩm
3. Nhấn **"Create Product"** để lưu

### Sửa Sản Phẩm

1. Tìm sản phẩm trong danh sách
2. Nhấn nút **Edit** (biểu tượng bút chì xanh)
3. Form sẽ mở với dữ liệu hiện tại
4. Chỉnh sửa các trường cần thiết
5. Nhấn **"Update Product"** để lưu

### Xóa Sản Phẩm

1. Tìm sản phẩm trong danh sách
2. Nhấn nút **Delete** (biểu tượng thùng rác đỏ)
3. Xác nhận xóa trong dialog
4. Sản phẩm sẽ bị xóa vĩnh viễn

## 🔧 API Endpoints

### List Products (Admin)

```
GET /api/products/admin/products/
```

Response:

```json
[
  {
    "product_id": 1,
    "name": "Ao Thun Trang Classic",
    "slug": "ao-thun-trang-classic",
    "description": "...",
    "price": 299000,
    "sale_price": null,
    "stock_quantity": 120,
    "category_id": 1,
    "brand_id": 1,
    "feature_text": "cotton trang toi gian basic",
    "is_active": true
  }
]
```

### Create Product

```
POST /api/products/admin/products/

{
  "name": "Ao Thun Den",
  "slug": "ao-thun-den",
  "description": "Ao thun den toi gian...",
  "price": 299000,
  "sale_price": null,
  "stock_quantity": 50,
  "category_id": 1,
  "brand_id": 1,
  "feature_text": "cotton den toi gian",
  "image_url": "https://images.unsplash.com/..."
}
```

### Update Product

```
PUT /api/products/admin/products/{id}/

{
  "name": "Ao Thun Den (Updated)",
  "price": 319000,
  ...
}
```

### Delete Product

```
DELETE /api/products/admin/products/{id}/
```

## ⚠️ Lưu Ý Quan Trọng

1. **Chưa có xác thực (Authentication)**
   - Bất cứ ai cũng có thể truy cập admin nếu biết URL
   - Trong production, PHẢI thêm login + permission checks

2. **Chưa hỗ trợ upload ảnh**
   - Hiện tại chỉ nhập URL hình ảnh
   - Để upload file, cần tích hợp storage (AWS S3, GCS, etc.)

3. **Chưa có migration files**
   - Nếu database chưa có bảng, chạy:
     ```bash
     cd backend
     python manage.py makemigrations
     python manage.py migrate
     ```

4. **Chưa seed dữ liệu**
   - Để load dữ liệu mẫu:
     ```bash
     cd frontend
     npm run seed:api
     ```

5. **Hiệu năng**
   - Admin load tất cả sản phẩm không phân trang - nếu có 1000+ sản phẩm, cần thêm pagination

## 🔐 TODO: Bảo Mật

```python
# backend/products/views.py - Thêm permission check

from rest_framework.permissions import IsAdminUser

class ProductAdminListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]  # Chỉ admin mới có quyền
    ...
```

## 📱 Tương Lai

- [ ] Thêm authentication / login
- [ ] Pagination cho danh sách sản phẩm
- [ ] Upload ảnh trực tiếp
- [ ] Quản lý categories, brands
- [ ] Quản lý users, orders
- [ ] Analytics dashboard
- [ ] Search/filter nâng cao
