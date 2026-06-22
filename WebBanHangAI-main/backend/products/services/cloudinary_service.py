import os
from uuid import uuid4


def _env(name: str, default: str = '') -> str:
    return os.getenv(name, default).strip()


def upload_product_image(uploaded_file) -> str:
    return upload_image(uploaded_file, _env('CLOUDINARY_UPLOAD_FOLDER', 'fashion-shop/products'))


def upload_review_image(uploaded_file) -> str:
    return upload_image(uploaded_file, _env('CLOUDINARY_REVIEW_UPLOAD_FOLDER', 'fashion-shop/reviews'))


def upload_review_image_asset(uploaded_file) -> dict:
    return upload_image_asset(uploaded_file, _env('CLOUDINARY_REVIEW_UPLOAD_FOLDER', 'fashion-shop/reviews'))


def upload_image(uploaded_file, folder: str) -> str:
    return upload_image_asset(uploaded_file, folder)['secure_url']


def upload_image_asset(uploaded_file, folder: str) -> dict:
    try:
        import cloudinary
        import cloudinary.uploader
    except ImportError as exc:
        raise RuntimeError('Cloudinary package is not installed. Run pip install -r requirements.txt.') from exc

    cloud_name = _env('CLOUDINARY_CLOUD_NAME')
    api_key = _env('CLOUDINARY_API_KEY')
    api_secret = _env('CLOUDINARY_API_SECRET')
    if not cloud_name or not api_key or not api_secret:
        raise RuntimeError('Cloudinary environment variables are not configured.')

    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )

    if hasattr(uploaded_file, 'seek'):
        uploaded_file.seek(0)

    try:
        result = cloudinary.uploader.upload(
            uploaded_file,
            folder=folder,
            public_id=uuid4().hex,
            resource_type='image',
            overwrite=False,
        )
    except Exception as exc:
        raise RuntimeError(f'Cloudinary upload failed: {exc}') from exc
    secure_url = result.get('secure_url')
    if not secure_url:
        raise RuntimeError('Cloudinary upload did not return a secure URL.')
    return {
        'secure_url': secure_url,
        'public_id': result.get('public_id', ''),
    }


def delete_cloudinary_image(public_id: str) -> None:
    public_id = str(public_id or '').strip()
    if not public_id:
        return
    try:
        import cloudinary
        import cloudinary.uploader
    except ImportError as exc:
        raise RuntimeError('Cloudinary package is not installed. Run pip install -r requirements.txt.') from exc

    cloud_name = _env('CLOUDINARY_CLOUD_NAME')
    api_key = _env('CLOUDINARY_API_KEY')
    api_secret = _env('CLOUDINARY_API_SECRET')
    if not cloud_name or not api_key or not api_secret:
        raise RuntimeError('Cloudinary environment variables are not configured.')

    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )

    try:
        result = cloudinary.uploader.destroy(public_id, resource_type='image')
    except Exception as exc:
        raise RuntimeError(f'Cloudinary delete failed: {exc}') from exc

    if result.get('result') not in {'ok', 'not found'}:
        raise RuntimeError(f"Cloudinary delete failed: {result.get('result') or 'unknown error'}")
