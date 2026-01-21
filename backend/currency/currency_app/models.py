from django.db import models
from django.db.models import Avg, Case, When, Value, CharField

class ExchangeRateManager(models.Manager):
    def get_summary_view(self):
        # VIEW: This method creates a view-like structure with annotated data
        return self.select_related('currency').annotate(
            base_currency_type=Case(
                When(currency__INDICATOR__icontains='US Dollar', then=Value('USD')),
                When(currency__INDICATOR__icontains='Euro', then=Value('EUR')),
                When(currency__INDICATOR__icontains='SDR', then=Value('SDR')),
                default=Value('OTHER'),
                output_field=CharField()
            )
        ).values(
            'currency__COUNTRY',
            'currency__INDICATOR',
            'year',
            'month',
            'rate',
            'base_currency_type'
        )

class RateManager(models.Manager):
    def update_rate_procedure(self, currency_id, year, month, rate):
        # STORED PROCEDURE: This method mimics a stored procedure with validation logic
        from django.core.exceptions import ValidationError
        
        if rate <= 0:
            raise ValidationError("Rate must be positive")
        
        if month < 1 or month > 12:
            raise ValidationError("Month must be between 1-12")
        
        try:
            currency = Currency.objects.get(id=currency_id)
        except Currency.DoesNotExist:
            raise ValidationError("Currency not found")
        
        monthly_rate, created = self.update_or_create(
            currency_id=currency_id,
            year=year,
            month=month,
            defaults={'rate': rate}
        )
        
        return {
            'status': 'success',
            'message': f"Rate {'created' if created else 'updated'} for {currency.COUNTRY} ({year}-{month})",
            'currency': currency.COUNTRY,
            'year': year,
            'month': month,
            'rate': rate
        }

class Currency(models.Model):
    COUNTRY = models.CharField(max_length=100, db_index=True)  # INDEX
    INDICATOR = models.CharField(max_length=200, db_index=True)  # INDEX
    FREQUENCY = models.CharField(max_length=50)
    SCALE = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            # COMPOSITE INDEX: For frequent queries
            models.Index(fields=['COUNTRY', 'INDICATOR'], name='idx_country_indicator'),
        ]
        ordering = ['COUNTRY', 'INDICATOR']
    
    def __str__(self):
        return f"{self.COUNTRY} - {self.INDICATOR}"
    
    # METHOD that uses SUBQUERY in ORM
    def get_rates_above_average(self, year):
        # QUERY WITH SUBQUERY: Demonstrates subquery usage in Django ORM
        from django.db.models import Subquery, OuterRef
        
        # Subquery to get average rate for this currency
        avg_subquery = MonthlyRate.objects.filter(
            currency_id=OuterRef('currency_id'),
            year=year
        ).values('currency_id').annotate(
            avg_rate=Avg('rate')
        ).values('avg_rate')
        
        # Main query using subquery
        rates = self.rates.filter(
            year=year,
            rate__gt=Subquery(avg_subquery)
        ).order_by('month')
        
        return rates

class MonthlyRate(models.Model):
    # Use the custom manager that has get_summary_view method
    objects = ExchangeRateManager()
    
    # Also add the procedure manager as a separate manager
    procedures = RateManager()
    
    currency = models.ForeignKey(Currency, on_delete=models.CASCADE, related_name='rates')
    year = models.IntegerField()
    month = models.IntegerField()  # 1-12
    rate = models.FloatField()
    
    class Meta:
        unique_together = ['currency', 'year', 'month']
        indexes = [
            # INDEX: For performance on currency-date queries
            models.Index(fields=['currency', 'year', 'month'], name='idx_currency_date'),
            # INDEX: For rate-based queries
            models.Index(fields=['rate'], name='idx_rate'),
        ]
        ordering = ['-year', '-month']
    
    def __str__(self):
        return f"{self.currency.COUNTRY} - {self.year}-{self.month:02d}: {self.rate}"
    
    # STORED FUNCTION equivalent using Django method
    @classmethod
    def calculate_average_rate(cls, currency_id, year):
        # STORED FUNCTION: Equivalent to a stored function using Django aggregation
        avg = cls.objects.filter(
            currency_id=currency_id,
            year=year
        ).aggregate(avg_rate=Avg('rate'))['avg_rate']
        return avg or 0.0

    @classmethod
    def update_rate_procedure(cls, currency_id, year, month, rate):
        # STORED PROCEDURE: Update rate with validation logic
        from django.core.exceptions import ValidationError
        
        # Validation
        if rate <= 0:
            raise ValidationError("Rate must be positive")
        
        if month < 1 or month > 12:
            raise ValidationError("Month must be between 1-12")
        
        try:
            currency = Currency.objects.get(id=currency_id)
        except Currency.DoesNotExist:
            raise ValidationError("Currency not found")
        
        # Update or create using the model's manager
        monthly_rate, created = cls.objects.update_or_create(
            currency_id=currency_id,
            year=year,
            month=month,
            defaults={'rate': rate}
        )
        
        return {
            'status': 'success',
            'message': f"Rate {'created' if created else 'updated'} for {currency.COUNTRY} ({year}-{month})",
            'currency': currency.COUNTRY,
            'year': year,
            'month': month,
            'rate': rate,
            'action': 'created' if created else 'updated',
            'id': monthly_rate.id
        }

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

class CurrencyRateAudit(models.Model):
    currency_country = models.CharField(max_length=100, null=True, blank=True) 
    currency_indicator = models.CharField(max_length=200, null=True, blank=True)  
    year = models.IntegerField()
    month = models.IntegerField()
    old_rate = models.FloatField(null=True, blank=True)
    new_rate = models.FloatField()
    change_percentage = models.FloatField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            # INDEX: For audit queries
            models.Index(fields=['currency_country', 'updated_at'], name='idx_audit_currency_date'),
        ]
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"Audit: {self.currency_country} - {self.year}-{self.month}"


# TRIGGER: Post-save signal acts as an AFTER UPDATE/INSERT trigger
@receiver(post_save, sender=MonthlyRate)
def create_audit_log(sender, instance, created, **kwargs):
    # TRIGGER: Creates audit log after save (like an AFTER INSERT/UPDATE trigger)
    if not created and hasattr(instance, '_old_rate') and instance._old_rate is not None:
        old_rate = instance._old_rate
        change_percentage = 0
        
        if old_rate != 0:
            change_percentage = ((instance.rate - old_rate) / old_rate) * 100
        
        CurrencyRateAudit.objects.create(
            currency_country=instance.currency.COUNTRY, 
            currency_indicator=instance.currency.INDICATOR,
            year=instance.year,
            month=instance.month,
            old_rate=old_rate,
            new_rate=instance.rate,
            change_percentage=change_percentage
        )


# TRIGGER: Pre-save signal acts as a BEFORE UPDATE trigger
@receiver(pre_save, sender=MonthlyRate)
def capture_old_rate(sender, instance, **kwargs):
    # TRIGGER: Captures old rate before update (like a BEFORE UPDATE trigger)
    if instance.pk:
        try:
            old_instance = MonthlyRate.objects.get(pk=instance.pk)
            instance._old_rate = old_instance.rate
        except MonthlyRate.DoesNotExist:
            instance._old_rate = None