import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent
FRONTEND_DIR = BASE_DIR.parent / 'frontend'
FRONTEND_DIST_DIR = FRONTEND_DIR / 'dist'
FRONTEND_INDEX_FILE = FRONTEND_DIST_DIR / 'index.html'
FRONTEND_ASSETS_DIR = FRONTEND_DIST_DIR / 'assets'


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_env_file(ROOT_DIR / '.env')


def _env(name: str, default: str = '') -> str:
    return os.getenv(name, default).strip()


def _env_bool(name: str, default: str = 'False') -> bool:
    return _env(name, default).lower() == 'true'

SECRET_KEY = _env('DJANGO_SECRET_KEY', 'dev-secret-key-change-me')
DEBUG = _env_bool('DJANGO_DEBUG', 'True')

ALLOWED_HOSTS = [host.strip() for host in _env('DJANGO_ALLOWED_HOSTS', '127.0.0.1,localhost').split(',') if host.strip()]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'products',
    'recommendations',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

DATABASE_ENGINE = _env('DATABASE_ENGINE', 'sqlite').lower()

if DATABASE_ENGINE in {'mssql', 'sqlserver'}:
    sqlserver_trusted_connection = _env_bool('SQLSERVER_TRUSTED_CONNECTION', 'False')
    DATABASES = {
        'default': {
            'ENGINE': 'mssql',
            'NAME': _env('SQLSERVER_DATABASE', 'webbanhang_db'),
            'HOST': _env('SQLSERVER_HOST', '127.0.0.1'),
            'PORT': _env('SQLSERVER_PORT', '1433'),
            'OPTIONS': {
                'driver': _env('SQLSERVER_DRIVER', 'ODBC Driver 17 for SQL Server'),
                'extra_params': _env('SQLSERVER_EXTRA_PARAMS', 'TrustServerCertificate=yes;'),
            },
        }
    }
    if sqlserver_trusted_connection:
        DATABASES['default']['OPTIONS']['trusted_connection'] = 'yes'
    else:
        DATABASES['default']['USER'] = _env('SQLSERVER_USER', 'sa')
        DATABASES['default']['PASSWORD'] = _env('SQLSERVER_PASSWORD')
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'vi'
TIME_ZONE = 'Asia/Ho_Chi_Minh'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

raw_cors = _env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in raw_cors.split(',') if origin.strip()]

REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_PARSER_CLASSES': ['rest_framework.parsers.JSONParser'],
    'DEFAULT_AUTHENTICATION_CLASSES': ['products.security.authentication.StoreUserAuthentication'],
}
