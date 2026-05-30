# WebBanHangAI

Project ecommerce 1 shop, 1 database server, 1 backend, 1 frontend.

## Mô hình chạy

- Docker: chạy SQL Server
- SSMS: quản lý database
- Backend: Django kết nối vào SQL Server
- Frontend: Vite React gọi API từ backend

## Cấu hình môi trường

Copy [`.env.example`](.env.example) thành [`.env`](.env) ở thư mục gốc và chỉnh các giá trị cần thiết.

Các thông số quan trọng:

- `DATABASE_ENGINE=mssql`
- `SQLSERVER_HOST=127.0.0.1`
- `SQLSERVER_PORT=1433`
- `SQLSERVER_DATABASE=FashionShopDB`
- `SQLSERVER_USER=sa`
- `SQLSERVER_PASSWORD=...`

## Chạy project

```powershell
cd D:\Hoc\ThucTapCoSo\DuAn\WebBanHangAI-main
.\START_PROJECT.bat
```

Sau khi chạy xong, mở:

- `http://localhost:8000`

`START_PROJECT.bat` sẽ tự chạy Docker, build frontend nếu chưa có `frontend/dist`, rồi chạy cả UI và API trên cùng một localhost.

## Kết nối SSMS

- Server name: `localhost,1433`
- Authentication: `SQL Server Authentication`
- Login: `sa`
- Password: giá trị trong `.env`

## Chế độ local đã xác minh

Trong môi trường này, kết nối đọc dữ liệu và migration đã được xác minh với SQL Server Express local bằng Windows Authentication:

- `SQLSERVER_TRUSTED_CONNECTION=True`
- `SQLSERVER_HOST=DESKTOP-T0ITRD8\SQLEXPRESS`
- `SQLSERVER_DATABASE=FashionShopDB`

Nếu bạn dùng Docker SQL Server, giữ cấu hình SQL auth trong `.env`; nếu muốn đi theo đường chắc chắn trên máy Windows này, chuyển sang trusted connection như trên.

## Tài liệu hỗ trợ

- [SQL Server + Docker + SSMS](SQLSERVER_DOCKER_SSMS.md)
- [Upgrade guide](UPGRADE_GUIDE_v1_to_v2.1.md)
