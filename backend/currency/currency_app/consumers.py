import json
import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.db.models import Avg, Subquery, OuterRef
from django.core.exceptions import ValidationError

class CurrencyConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': 'Connected to Currency Exchange',
            'timestamp': datetime.datetime.now().isoformat(),
            'features': ['INDEX', 'VIEW', 'STORED_FUNCTION', 'STORED_PROCEDURE', 'TRIGGER', 'SUBQUERY']
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
            # === ADVANCED FEATURES DEMO ===
            elif message_type == 'get_rates_above_average':  # SUBQUERY
                await self.demo_subquery(data)
            elif message_type == 'get_average_rate':  # STORED FUNCTION
                await self.demo_stored_function(data)
            elif message_type == 'get_rate_summary':  # VIEW
                await self.demo_view(data)
            elif message_type == 'update_rate':  # STORED PROCEDURE
                await self.demo_stored_procedure(data)
            elif message_type == 'get_audit_logs':  # TRIGGER RESULTS
                await self.demo_trigger(data)
            elif message_type == 'echo':
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
    
    def _get_models(self):
        from .models import Currency, MonthlyRate, CurrencyRateAudit
        return Currency, MonthlyRate, CurrencyRateAudit

    @sync_to_async
    def get_all_countries(self):
        Currency, _, _ = self._get_models()
        # INDEX: Uses db_index=True on COUNTRY field
        countries = Currency.objects.values_list('COUNTRY', flat=True).distinct().order_by('COUNTRY')
        return list(countries)

    @sync_to_async
    def get_currencies_by_country(self, country):
        Currency, _, _ = self._get_models()
        # INDEX: Uses composite index idx_country_indicator
        currencies = Currency.objects.filter(COUNTRY__iexact=country).order_by('INDICATOR')
        return list(currencies.values('id', 'COUNTRY', 'INDICATOR'))

    @sync_to_async
    def get_currency_by_indicator(self, country, indicator):
        Currency, _, _ = self._get_models()
        try:
            # INDEX: Uses composite index idx_country_indicator
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
        _, MonthlyRate, _ = self._get_models()
        try:
            # INDEX: Uses idx_currency_date composite index
            rate = MonthlyRate.objects.get(
                currency_id=currency_id,
                year=year,
                month=month
            )
            return rate.rate
        except Exception:
            return None

    # ============ CONVERSION LOGIC ============
    
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
            
            # CONVERSION LOGIC
            if "Domestic currency per US Dollar" in from_indicator:
                from_to_usd = 1 / from_rate
            elif "US Dollar per domestic currency" in from_indicator:
                from_to_usd = from_rate
            elif "Domestic currency per Euro" in from_indicator:
                eur_to_usd = 1.1
                from_to_usd = (1 / from_rate) * eur_to_usd
            elif "Euros per domestic currency" in from_indicator:
                eur_to_usd = 1.1
                from_to_usd = from_rate * eur_to_usd
            elif "Domestic currency per SDR" in from_indicator:
                sdr_to_usd = 1.35
                from_to_usd = (1 / from_rate) * sdr_to_usd
            elif "SDR per domestic currency" in from_indicator:
                sdr_to_usd = 1.35
                from_to_usd = from_rate * sdr_to_usd
            else:
                from_to_usd = 1 / from_rate
            
            if "Domestic currency per US Dollar" in to_indicator:
                to_to_usd = 1 / to_rate
            elif "US Dollar per domestic currency" in to_indicator:
                to_to_usd = to_rate
            elif "Domestic currency per Euro" in to_indicator:
                eur_to_usd = 1.1
                to_to_usd = (1 / to_rate) * eur_to_usd
            elif "Euros per domestic currency" in to_indicator:
                eur_to_usd = 1.1
                to_to_usd = to_rate * eur_to_usd
            elif "Domestic currency per SDR" in to_indicator:
                sdr_to_usd = 1.35
                to_to_usd = (1 / to_rate) * sdr_to_usd
            elif "SDR per domestic currency" in to_indicator:
                sdr_to_usd = 1.35
                to_to_usd = to_rate * sdr_to_usd
            else:
                to_to_usd = 1 / to_rate
            
            direct_rate = from_to_usd / to_to_usd if to_to_usd != 0 else 0
            converted_amount = amount * direct_rate
            
            from_currency_name = from_country.split(',')[0].split('(')[0].strip() + " currency"
            to_currency_name = to_country.split(',')[0].split('(')[0].strip() + " currency"
            
            await self.send(text_data=json.dumps({
                'type': 'conversion_result',
                'data': {
                    'original_amount': amount,
                    'converted_amount': converted_amount,
                    'from_currency': from_currency,
                    'to_currency': to_currency,
                    'from_rate': from_rate,
                    'to_rate': to_rate,
                    'from_to_usd': from_to_usd,
                    'to_to_usd': to_to_usd,
                    'exchange_rate': direct_rate,
                    'exchange_rate_formula': f"{amount} {from_currency_name} = {converted_amount:.6f} {to_currency_name}",
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
                'count': len(currencies),
                'index_info': 'Using composite index: idx_country_indicator'
            }
        }))

    async def get_countries_list(self):
        countries = await self.get_all_countries()
        
        await self.send(text_data=json.dumps({
            'type': 'countries_list',
            'data': {
                'countries': countries,
                'count': len(countries),
                'index_info': 'Using single-column index on COUNTRY field'
            }
        }))

    # ============ ADVANCED FEATURES IMPLEMENTATION ============

    @sync_to_async
    def _demo_subquery_logic(self, data):
        """SUBQUERY: Find rates above average for each currency"""
        Currency, MonthlyRate, _ = self._get_models()
        
        country = data.get('country', 'Vietnam')
        year = data.get('year', 2024)
        
        currencies = Currency.objects.filter(COUNTRY__iexact=country)
        
        results = []
        for currency in currencies:
            # SUBQUERY: Get average rate for this currency in the year
            avg_subquery = MonthlyRate.objects.filter(
                currency_id=OuterRef('currency_id'),
                year=year
            ).values('currency_id').annotate(
                avg_rate=Avg('rate')
            ).values('avg_rate')
            
            # Main query using the subquery
            above_avg_rates = MonthlyRate.objects.filter(
                currency=currency,
                year=year,
                rate__gt=Subquery(avg_subquery)
            ).order_by('month')
            
            if above_avg_rates.exists():
                avg_rate = MonthlyRate.calculate_average_rate(currency.id, year)
                
                for rate in above_avg_rates:
                    results.append({
                        'country': currency.COUNTRY,
                        'indicator': currency.INDICATOR,
                        'year': rate.year,
                        'month': rate.month,
                        'rate': rate.rate,
                        'average_rate': avg_rate,
                        'difference': rate.rate - avg_rate,
                        'difference_percent': ((rate.rate - avg_rate) / avg_rate * 100) if avg_rate != 0 else 0
                    })
        
        return results

    @sync_to_async
    def _demo_stored_function_logic(self, data):
        """STORED FUNCTION: Calculate average rate using Django aggregation"""
        _, MonthlyRate, _ = self._get_models()
        
        currency_id = data.get('currency_id')
        year = data.get('year', 2024)
        
        if not currency_id:
            return {'error': 'currency_id is required'}
        
        avg_rate = MonthlyRate.calculate_average_rate(currency_id, year)
        
        return {
            'currency_id': currency_id,
            'year': year,
            'average_rate': avg_rate,
            'calculation_method': 'Django aggregation with Avg()'
        }

    @sync_to_async
    def _demo_view_logic(self, data):
        """VIEW: Exchange rate summary using annotated queryset"""
        Currency, MonthlyRate, _ = self._get_models()
        
        country = data.get('country', 'Vietnam')
        year = data.get('year', 2024)
        
        # Equivalent to SQL VIEW using Django ORM
        summary = MonthlyRate.objects.get_summary_view().filter(
            currency__COUNTRY__iexact=country,
            year=year
        )[:15]
        
        return list(summary)

    @sync_to_async
    def _demo_stored_procedure_logic(self, data):
        """STORED PROCEDURE: Update rate with validation"""
        _, MonthlyRate, _ = self._get_models()
        
        try:
            currency_id = data['currency_id']
            year = data['year']
            month = data['month']
            rate = float(data['rate'])
            
            result = MonthlyRate.objects.update_rate_procedure(
                currency_id=currency_id,
                year=year,
                month=month,
                rate=rate
            )
            
            return result
            
        except ValidationError as e:
            return {'error': f'Validation Error: {str(e)}'}
        except KeyError as e:
            return {'error': f'Missing parameter: {str(e)}'}
        except Exception as e:
            return {'error': f'Procedure failed: {str(e)}'}

    @sync_to_async
    def _demo_trigger_logic(self, data):
        """TRIGGER: Get audit logs created by signal triggers"""
        _, _, CurrencyRateAudit = self._get_models()
        
        currency_id = data.get('currency_id')
        limit = data.get('limit', 10)
        
        queryset = CurrencyRateAudit.objects.all()
        if currency_id:
            queryset = queryset.filter(currency_id=currency_id)
        
        logs = queryset.select_related('currency').order_by('-updated_at')[:limit]
        
        return list(logs.values(
            'currency__COUNTRY',
            'currency__INDICATOR',
            'year',
            'month',
            'old_rate',
            'new_rate',
            'change_percentage',
            'updated_at'
        ))

    # ============ WEB SOCKET HANDLERS FOR ADVANCED FEATURES ============

    async def demo_subquery(self, data):
        """Handle subquery demo request"""
        try:
            results = await self._demo_subquery_logic(data)
            
            await self.send(text_data=json.dumps({
                'type': 'rates_above_average',
                'data': {
                    'results': results,
                    'count': len(results),
                    'demonstration': 'SUBQUERY: Using Subquery() and OuterRef() to find rates above average',
                    'sql_concept': 'Correlated subquery with aggregation',
                    'orm_method': 'Subquery(OuterRef()) with rate__gt filter'
                }
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Subquery demo error: {str(e)}'
            }))

    async def demo_stored_function(self, data):
        """Handle stored function demo request"""
        try:
            result = await self._demo_stored_function_logic(data)
            
            if 'error' in result:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': result['error']
                }))
                return
            
            await self.send(text_data=json.dumps({
                'type': 'average_rate_result',
                'data': {
                    **result,
                    'demonstration': 'STORED FUNCTION: Using @classmethod with aggregate()',
                    'sql_concept': 'User-defined function returning scalar value',
                    'orm_equivalent': 'Model class method with aggregation'
                }
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Stored function demo error: {str(e)}'
            }))

    async def demo_view(self, data):
        """Handle view demo request"""
        try:
            summary = await self._demo_view_logic(data)
            
            await self.send(text_data=json.dumps({
                'type': 'rate_summary',
                'data': {
                    'summary': summary,
                    'count': len(summary),
                    'demonstration': 'VIEW: Using custom manager with annotated queryset',
                    'sql_concept': 'Virtual table from complex query',
                    'orm_equivalent': 'Manager method returning annotated ValuesQuerySet'
                }
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'View demo error: {str(e)}'
            }))

    async def demo_stored_procedure(self, data):
        """Handle stored procedure demo request"""
        try:
            result = await self._demo_stored_procedure_logic(data)
            
            if 'error' in result:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': result['error']
                }))
                return
            
            await self.send(text_data=json.dumps({
                'type': 'rate_update_result',
                'data': {
                    **result,
                    'demonstration': 'STORED PROCEDURE: Using manager method with validation',
                    'sql_concept': 'Parameterized transaction with validation logic',
                    'orm_equivalent': 'Model manager method with update_or_create()'
                }
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Stored procedure demo error: {str(e)}'
            }))

    async def demo_trigger(self, data):
        """Handle trigger demo request"""
        try:
            logs = await self._demo_trigger_logic(data)
            
            await self.send(text_data=json.dumps({
                'type': 'audit_logs',
                'data': {
                    'logs': logs,
                    'count': len(logs),
                    'demonstration': 'TRIGGER: Using Django signals (post_save, pre_save)',
                    'sql_concept': 'Automatic action after data modification',
                    'orm_equivalent': 'Signal receivers that create audit records'
                }
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Trigger demo error: {str(e)}'
            }))