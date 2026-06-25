import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmailVerificationToken',
            fields=[
                ('token_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('token', models.CharField(max_length=128, unique=True)),
                ('expires_at', models.DateTimeField()),
                ('used_at', models.DateTimeField(blank=True, null=True)),
                ('last_sent_at', models.DateTimeField(auto_now_add=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(db_column='user_id', on_delete=django.db.models.deletion.CASCADE, related_name='email_verification_tokens', to='products.storeuser')),
            ],
            options={'db_table': 'email_verification_tokens'},
        ),
        migrations.CreateModel(
            name='PasswordResetOTP',
            fields=[
                ('otp_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('otp_hash', models.CharField(max_length=255)),
                ('expires_at', models.DateTimeField()),
                ('failed_attempts', models.IntegerField(default=0)),
                ('used_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(db_column='user_id', on_delete=django.db.models.deletion.CASCADE, related_name='password_reset_otps', to='products.storeuser')),
            ],
            options={'db_table': 'password_reset_otps'},
        ),
        migrations.CreateModel(
            name='LoginLog',
            fields=[
                ('log_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('identifier', models.CharField(max_length=254)),
                ('success', models.BooleanField(default=False)),
                ('ip_address', models.CharField(blank=True, max_length=64)),
                ('user_agent', models.CharField(blank=True, max_length=500)),
                ('reason', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(blank=True, db_column='user_id', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='login_logs', to='products.storeuser')),
            ],
            options={'db_table': 'login_logs'},
        ),
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('audit_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('action', models.CharField(max_length=100)),
                ('entity_type', models.CharField(max_length=100)),
                ('entity_id', models.CharField(blank=True, max_length=100)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(blank=True, db_column='actor_user_id', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='audit_logs', to='products.storeuser')),
            ],
            options={'db_table': 'audit_logs'},
        ),
        migrations.CreateModel(
            name='OrderStatusHistory',
            fields=[
                ('history_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('from_status', models.CharField(blank=True, max_length=20)),
                ('to_status', models.CharField(max_length=20)),
                ('note', models.CharField(blank=True, max_length=500)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('changed_by', models.ForeignKey(blank=True, db_column='changed_by', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='order_status_changes', to='products.storeuser')),
                ('order', models.ForeignKey(db_column='order_id', on_delete=django.db.models.deletion.CASCADE, related_name='status_histories', to='products.order')),
            ],
            options={'db_table': 'order_status_histories'},
        ),
        migrations.CreateModel(
            name='Shipment',
            fields=[
                ('shipment_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('carrier_name', models.CharField(max_length=100)),
                ('tracking_code', models.CharField(max_length=100)),
                ('shipment_status', models.CharField(default='pending', max_length=30)),
                ('shipped_at', models.DateTimeField(blank=True, null=True)),
                ('delivered_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('order', models.OneToOneField(db_column='order_id', on_delete=django.db.models.deletion.CASCADE, related_name='shipment', to='products.order')),
            ],
            options={'db_table': 'shipments'},
        ),
        migrations.CreateModel(
            name='ReturnRequest',
            fields=[
                ('return_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('reason', models.TextField()),
                ('desired_solution', models.CharField(blank=True, max_length=255)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('completed', 'Completed')], default='pending', max_length=20)),
                ('reject_reason', models.TextField(blank=True)),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('order', models.ForeignKey(db_column='order_id', on_delete=django.db.models.deletion.CASCADE, related_name='return_requests', to='products.order')),
                ('order_item', models.ForeignKey(blank=True, db_column='order_item_id', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='return_requests', to='products.orderitem')),
                ('processed_by', models.ForeignKey(blank=True, db_column='processed_by', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='processed_returns', to='products.storeuser')),
                ('user', models.ForeignKey(db_column='user_id', on_delete=django.db.models.deletion.CASCADE, related_name='return_requests', to='products.storeuser')),
            ],
            options={'db_table': 'return_requests'},
        ),
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('notification_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=255)),
                ('content', models.TextField()),
                ('notification_type', models.CharField(default='system', max_length=50)),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(db_column='user_id', on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to='products.storeuser')),
            ],
            options={'db_table': 'notifications'},
        ),
        migrations.CreateModel(
            name='PaymentMethod',
            fields=[
                ('method_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('code', models.CharField(max_length=50, unique=True)),
                ('name', models.CharField(max_length=100)),
                ('is_active', models.BooleanField(default=True)),
                ('config', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'payment_methods'},
        ),
        migrations.CreateModel(
            name='RecommendationConfig',
            fields=[
                ('config_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('config_key', models.CharField(max_length=100, unique=True)),
                ('config_value', models.JSONField(blank=True, default=dict)),
                ('description', models.CharField(blank=True, max_length=255)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'recommendation_configs'},
        ),
        migrations.CreateModel(
            name='ReturnRequestImage',
            fields=[
                ('image_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('image_url', models.CharField(max_length=500)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('return_request', models.ForeignKey(db_column='return_id', on_delete=django.db.models.deletion.CASCADE, related_name='images', to='products.returnrequest')),
            ],
            options={'db_table': 'return_request_images'},
        ),
        migrations.CreateModel(
            name='ReturnStatusHistory',
            fields=[
                ('history_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('from_status', models.CharField(blank=True, max_length=20)),
                ('to_status', models.CharField(max_length=20)),
                ('note', models.CharField(blank=True, max_length=500)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('changed_by', models.ForeignKey(blank=True, db_column='changed_by', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='return_status_changes', to='products.storeuser')),
                ('return_request', models.ForeignKey(db_column='return_id', on_delete=django.db.models.deletion.CASCADE, related_name='status_histories', to='products.returnrequest')),
            ],
            options={'db_table': 'return_status_histories'},
        ),
        migrations.AlterField(
            model_name='userinteraction',
            name='interaction_type',
            field=models.CharField(choices=[('view', 'View'), ('add_to_cart', 'Add To Cart'), ('wishlist_add', 'Wishlist Add'), ('search', 'Search'), ('purchase', 'Purchase'), ('review', 'Review')], max_length=20),
        ),
    ]
