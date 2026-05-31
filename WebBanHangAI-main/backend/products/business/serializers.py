from rest_framework import serializers

from products.models import (
    Notification,
    Order,
    OrderStatusHistory,
    PaymentMethod,
    RecommendationConfig,
    ReturnRequest,
    ReturnRequestImage,
    ReturnStatusHistory,
    Shipment,
    StoreUser,
)
from products.serializers import OrderSerializer, StoreUserSerializer


class ShipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shipment
        fields = ['shipment_id', 'order', 'carrier_name', 'tracking_code', 'shipment_status', 'shipped_at', 'delivered_at', 'created_at', 'updated_at']
        read_only_fields = ['shipment_id', 'created_at', 'updated_at']


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderStatusHistory
        fields = ['history_id', 'order', 'from_status', 'to_status', 'note', 'changed_by', 'created_at']
        read_only_fields = ['history_id', 'created_at']


class OrderDetailSerializer(OrderSerializer):
    shipment = ShipmentSerializer(read_only=True)
    status_histories = OrderStatusHistorySerializer(many=True, read_only=True)

    class Meta(OrderSerializer.Meta):
        fields = OrderSerializer.Meta.fields + ['shipment', 'status_histories']


class ReturnRequestImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReturnRequestImage
        fields = ['image_id', 'image_url', 'created_at']
        read_only_fields = ['image_id', 'created_at']


class ReturnStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ReturnStatusHistory
        fields = ['history_id', 'from_status', 'to_status', 'note', 'changed_by', 'created_at']
        read_only_fields = ['history_id', 'created_at']


class ReturnRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReturnRequest
        fields = [
            'return_id',
            'user',
            'order',
            'order_item',
            'reason',
            'desired_solution',
            'status',
            'reject_reason',
            'processed_by',
            'processed_at',
            'created_at',
            'evidence_image_urls',
        ]
        read_only_fields = ['return_id', 'user', 'status', 'reject_reason', 'processed_by', 'processed_at', 'created_at', 'updated_at']


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['notification_id', 'title', 'content', 'notification_type', 'is_read', 'created_at']
        read_only_fields = ['notification_id', 'created_at']


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ['method_id', 'code', 'name', 'is_active', 'config', 'created_at', 'updated_at']
        read_only_fields = ['method_id', 'created_at', 'updated_at']

    def validate_code(self, value):
        value = str(value or '').strip().lower()
        allowed = {'cod', 'vnpay', 'momo', 'bank_transfer'}
        if value not in allowed:
            raise serializers.ValidationError('Phuong thuc thanh toan khong hop le')
        return value


class RecommendationConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecommendationConfig
        fields = ['config_id', 'config_key', 'config_value', 'description', 'updated_at']
        read_only_fields = ['config_id', 'updated_at']


class AdminLowStockThresholdSerializer(serializers.Serializer):
    threshold = serializers.IntegerField(min_value=0, max_value=100000)


class AdminUserSerializer(StoreUserSerializer):
    class Meta(StoreUserSerializer.Meta):
        model = StoreUser
        fields = ['user_id', 'username', 'full_name', 'email', 'phone', 'role', 'is_active', 'account_status', 'must_change_password', 'created_at']
        read_only_fields = ['user_id', 'created_at']


class AdminUserUpdateSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254, required=False)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, allow_null=True)
    role = serializers.ChoiceField(choices=['customer', 'staff', 'admin'], required=False)
    account_status = serializers.ChoiceField(
        choices=['active', 'locked', 'inactive', 'pending_verification'],
        required=False,
    )
    full_name = serializers.CharField(max_length=255, required=False)

    def validate_email(self, value):
        return value.strip().lower()

    def validate_phone(self, value):
        phone = str(value or '').strip()
        if phone and (not phone.isdigit() or len(phone) < 9 or len(phone) > 20):
            raise serializers.ValidationError('So dien thoai khong hop le')
        return phone or None
