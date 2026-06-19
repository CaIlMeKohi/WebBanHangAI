# WebBanHangAI

Website bán hàng thời trang gồm giao diện khách hàng, cổng nhân viên, trang quản trị và hệ thống gợi ý sản phẩm.

## Công nghệ

- Backend: Django, Django REST Framework
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Database: SQL Server
- Lưu trữ ảnh: Cloudinary
- Email OTP: Gmail SMTP

## Yêu cầu

- Python 3.12+
- Node.js 20+
- SQL Server và ODBC Driver 17 hoặc 18
- Tài khoản Cloudinary nếu cần tải ảnh
- Gmail App Password nếu cần gửi OTP

## Cấu hình

Tạo file `.env` từ `.env.example` rồi cập nhật thông tin SQL Server, Cloudinary và Gmail SMTP.

```powershell
Copy-Item .env.example .env
```

Không đưa file `.env` hoặc mật khẩu thật lên Git.

## Cài đặt

```powershell
python -m venv backend\venv
backend\venv\Scripts\pip.exe install -r backend\requirements.txt
cd frontend
npm install
cd ..
```

## Khởi chạy

Chạy project với hot reload:

```powershell
.\START_DEV_HOT_RELOAD.bat
```

Hoặc chạy bản build ổn định:

```powershell
.\START_PROJECT.bat
```

Truy cập website tại `http://127.0.0.1:8000`.

## Kiểm tra

```powershell
backend\venv\Scripts\python.exe backend\manage.py check
backend\venv\Scripts\python.exe backend\manage.py test
cd frontend
npm run build
```
