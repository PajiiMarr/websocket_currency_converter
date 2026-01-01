# currency_app/consumers.py - FIXED VERSION
import json
import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.db.models import Q

class CurrencyConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': 'Connected to Currency Exchange',
            'timestamp': datetime.datetime.now().isoformat()
        }))

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type', 'echo')
            
            if message_type == 'convert':
                await self.handle_conversion(data)
            elif message_type == 'get_currencies':
                await self.send_currencies(data)
            elif message_type == 'get_countries':
                await self.get_countries_list()
            elif message_type == 'echo':
                # Echo back
                await self.send(text_data=json.dumps({
                    'type': 'echo',
                    'message': 'Echo received',
                    'data': data,
                    'timestamp': datetime.datetime.now().isoformat()
                }))
            else:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': f'Unknown type: {message_type}'
                }))
                
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON'
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error', 
                'message': f'Error: {str(e)}'
            }))

    # ============ DATABASE HELPERS ============
    
    # Lazy import of models to avoid Django settings issues
    def _get_models(self):
        from .models import Currency, MonthlyRate
        return Currency, MonthlyRate

    @sync_to_async
    def get_all_countries(self):
        Currency, _ = self._get_models()
        countries = Currency.objects.values_list('COUNTRY', flat=True).distinct().order_by('COUNTRY')
        return list(countries)

    @sync_to_async
    def get_currencies_by_country(self, country):
        Currency, _ = self._get_models()
        currencies = Currency.objects.filter(COUNTRY__iexact=country).order_by('INDICATOR')
        return list(currencies.values('id', 'COUNTRY', 'INDICATOR'))

    @sync_to_async
    def get_currency_by_indicator(self, country, indicator):
        Currency, _ = self._get_models()
        try:
            currency = Currency.objects.get(COUNTRY__iexact=country, INDICATOR__iexact=indicator)
            return {
                'id': currency.id,
                'country': currency.COUNTRY,
                'indicator': currency.INDICATOR
            }
        except Currency.DoesNotExist:
            return None

    @sync_to_async
    def get_rate_at_date(self, currency_id, year, month):
        _, MonthlyRate = self._get_models()
        try:
            rate = MonthlyRate.objects.get(
                currency_id=currency_id,
                year=year,
                month=month
            )
            return rate.rate
        except Exception:
            return None

    async def handle_conversion(self, data):
        try:
            amount = float(data.get('amount', 100))
            from_country = data.get('from_country', 'Vietnam')
            from_indicator = data.get('from_indicator', 'Domestic currency per US Dollar')
            to_country = data.get('to_country', 'Vietnam')
            to_indicator = data.get('to_indicator', 'US Dollar per domestic currency')
            year = data.get('year', 2024)
            month = data.get('month', 12)
            
            # Get currencies
            from_currency = await self.get_currency_by_indicator(from_country, from_indicator)
            to_currency = await self.get_currency_by_indicator(to_country, to_indicator)
            
            if not from_currency or not to_currency:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'Currency not found'
                }))
                return
            
            # Get rates
            from_rate = await self.get_rate_at_date(from_currency['id'], year, month)
            to_rate = await self.get_rate_at_date(to_currency['id'], year, month)
            
            if not from_rate or not to_rate:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': f'No rate data for {year}-{month}'
                }))
                return
            
            # CONVERSION LOGIC FIX:
            # 1. Convert from_currency to USD value
            # 2. Convert USD value to to_currency
            
            if "Domestic currency per US Dollar" in from_indicator:
                # e.g., 1 USD = 23,000 VND, so 1 VND = 1/23000 USD
                from_in_usd = 1 / from_rate  # Value of 1 unit of domestic currency in USD
            elif "US Dollar per domestic currency" in from_indicator:
                # e.g., 1 VND = 0.000043 USD
                from_in_usd = from_rate  # Already in USD per domestic currency
            else:
                # Handle other indicator types (Euros, SDR, etc.)
                # For now, assume it's "Domestic currency per X"
                from_in_usd = 1 / from_rate
            
            if "Domestic currency per US Dollar" in to_indicator:
                # e.g., 1 USD = 23,000 VND
                # To convert USD to VND: USD_amount * rate
                converted_amount = (amount * from_in_usd) * to_rate
            elif "US Dollar per domestic currency" in to_indicator:
                # e.g., 1 VND = 0.000043 USD
                # To convert USD to VND: USD_amount / rate
                converted_amount = (amount * from_in_usd) / to_rate
            else:
                # Handle other indicator types
                converted_amount = (amount * from_in_usd) * to_rate
            
            # Calculate exchange rate (1 from_currency = X to_currency)
            exchange_rate = converted_amount / amount if amount != 0 else 0
            
            # Send result
            await self.send(text_data=json.dumps({
                'type': 'conversion_result',
                'data': {
                    'original_amount': amount,
                    'converted_amount': converted_amount,
                    'from_currency': from_currency,
                    'to_currency': to_currency,
                    'from_rate': from_rate,
                    'to_rate': to_rate,
                    'exchange_rate': exchange_rate,
                    'year': year,
                    'month': month
                }
            }))
            
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Conversion error: {str(e)}'
            }))

    async def send_currencies(self, data):
        country = data.get('country', 'Vietnam')
        currencies = await self.get_currencies_by_country(country)
        
        await self.send(text_data=json.dumps({
            'type': 'currencies_list',
            'data': {
                'country': country,
                'currencies': currencies,
                'count': len(currencies)
            }
        }))

    async def get_countries_list(self):
        countries = await self.get_all_countries()
        
        await self.send(text_data=json.dumps({
            'type': 'countries_list',
            'data': {
                'countries': countries,
                'count': len(countries)
            }
        }))







        