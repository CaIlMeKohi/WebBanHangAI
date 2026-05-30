from django.contrib import admin
from django.urls import include, path, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import FileResponse, Http404
from django.views.static import serve
from products.business.urls import admin_patterns, admin_router, customer_patterns, notification_patterns, payment_patterns, product_review_patterns, recommendation_patterns, return_patterns, review_patterns, staff_patterns


def frontend_index(_request):
    if not settings.FRONTEND_INDEX_FILE.exists():
        raise Http404('Frontend build not found. Run `npm run build` in the frontend folder.')
    return FileResponse(settings.FRONTEND_INDEX_FILE.open('rb'), content_type='text/html')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('products.business.urls', namespace=None)),
    path('api/customer/', include((customer_patterns, 'customer'))),
    path('api/reviews/', include((review_patterns, 'reviews'))),
    path('api/payments/', include((payment_patterns, 'payments'))),
    path('api/products/', include((product_review_patterns, 'product-reviews'))),
    path('api/returns/', include((return_patterns, 'returns'))),
    path('api/staff/', include((staff_patterns, 'staff'))),
    path('api/admin/', include((admin_patterns + admin_router.urls, 'business-admin'))),
    path('api/notifications/', include((notification_patterns, 'notifications'))),
    path('api/products/', include('products.urls')),
    path('api/recommendations/', include('recommendations.urls')),
    path('api/recommendations/', include((recommendation_patterns, 'recommendation-events'))),
    path('assets/<path:path>', serve, {'document_root': settings.FRONTEND_ASSETS_DIR}),
    path('', frontend_index),
    re_path(r'^(?!api/|admin/|assets/|media/).*$', frontend_index),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
