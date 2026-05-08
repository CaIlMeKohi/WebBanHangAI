from django.contrib import admin

from .models import (
	Address,
	Brand,
	CartItem,
	Category,
	Coupon,
	InventoryLog,
	Order,
	OrderItem,
	Payment,
	PrecomputedRecommendation,
	Product,
	ProductImage,
	ProductTag,
	ProductVariant,
	RecommendationLog,
	Review,
	SearchLog,
	StoreUser,
	Tag,
	UserInteraction,
	WishlistItem,
)

admin.site.register(Product)
admin.site.register(StoreUser)
admin.site.register(Address)
admin.site.register(Category)
admin.site.register(Brand)
admin.site.register(ProductVariant)
admin.site.register(ProductImage)
admin.site.register(Tag)
admin.site.register(ProductTag)
admin.site.register(CartItem)
admin.site.register(WishlistItem)
admin.site.register(Coupon)
admin.site.register(Order)
admin.site.register(OrderItem)
admin.site.register(Payment)
admin.site.register(Review)
admin.site.register(UserInteraction)
admin.site.register(SearchLog)
admin.site.register(PrecomputedRecommendation)
admin.site.register(RecommendationLog)
admin.site.register(InventoryLog)
