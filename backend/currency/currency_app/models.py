# currency_app/models.py
from django.db import models

class Currency(models.Model):
    # Metadata fields
    COUNTRY = models.CharField(max_length=100)
    INDICATOR = models.CharField(max_length=200)
    FREQUENCY = models.CharField(max_length=50)
    SCALE = models.CharField(max_length=50)
    
    def __str__(self):
        return f"{self.COUNTRY} - {self.INDICATOR}"

class MonthlyRate(models.Model):
    currency = models.ForeignKey(Currency, on_delete=models.CASCADE, related_name='rates')
    year = models.IntegerField()
    month = models.IntegerField()  # 1-12
    rate = models.FloatField()
    
    class Meta:
        unique_together = ['currency', 'year', 'month']
    
    def __str__(self):
        return f"{self.currency.COUNTRY} - {self.year}-{self.month:02d}: {self.rate}"