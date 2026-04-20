from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('vault', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Pin',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('item_type', models.CharField(choices=[('folder', 'Folder'), ('note', 'Note')], max_length=10)),
                ('item_id', models.PositiveIntegerField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='vault_pins',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
        migrations.AddConstraint(
            model_name='pin',
            constraint=models.UniqueConstraint(
                fields=['user', 'item_type', 'item_id'],
                name='vault_pin_unique_per_user',
            ),
        ),
    ]
