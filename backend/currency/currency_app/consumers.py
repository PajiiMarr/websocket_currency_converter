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
            elif message_type == 'get_rates_above_average':
                await self.demo_subquery(data)  # SUBQUERY demo handler
            elif message_type == 'get_average_rate':
                await self.demo_stored_function(data)  # STORED FUNCTION demo handler
            elif message_type == 'get_rate_summary':
                await self.demo_view(data)  # VIEW demo handler
            elif message_type == 'update_rate': 
                await self.demo_stored_procedure(data)  # STORED PROCEDURE demo handler
            elif message_type == 'get_audit_logs':
                await self.demo_trigger(data)  # TRIGGER demo handler
            elif message_type == 'get_currency_stats':
                await self.demo_index_performance(data)  # INDEX demo handler
            elif message_type == 'get_dashboard_data':
                await self.get_dashboard_data(data)
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

    def _get_models(self):
        from .models import Currency, MonthlyRate, CurrencyRateAudit
        return Currency, MonthlyRate, CurrencyRateAudit

    @sync_to_async
    def get_all_countries(self):
        Currency, _, _ = self._get_models()
        # INDEX: Using db_index on COUNTRY field
        countries = Currency.objects.values_list('COUNTRY', flat=True).distinct().order_by('COUNTRY')
        return list(countries)

    @sync_to_async
    def get_currencies_by_country(self, country):
        Currency, _, _ = self._get_models()
        # INDEX: Using composite index idx_country_indicator
        currencies = Currency.objects.filter(COUNTRY__iexact=country).order_by('INDICATOR')
        return list(currencies.values('id', 'COUNTRY', 'INDICATOR'))

    @sync_to_async
    def get_currency_by_indicator(self, country, indicator):
        Currency, _, _ = self._get_models()
        try:
            # INDEX: Using composite index idx_country_indicator
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
            # INDEX: Using idx_currency_date composite index
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
            
            from_currency = await self.get_currency_by_indicator(from_country, from_indicator)
            to_currency = await self.get_currency_by_indicator(to_country, to_indicator)
            
            if not from_currency or not to_currency:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'Currency not found'
                }))
                return
            
            from_rate = await self.get_rate_at_date(from_currency['id'], year, month)
            to_rate = await self.get_rate_at_date(to_currency['id'], year, month)
            
            if not from_rate or not to_rate:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': f'No rate data for {year}-{month}'
                }))
                return
            
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
                'index_info': 'Using composite index: idx_country_indicator'  # INDEX reference
            }
        }))

    async def get_countries_list(self):
        countries = await self.get_all_countries()
        
        await self.send(text_data=json.dumps({
            'type': 'countries_list',
            'data': {
                'countries': countries,
                'count': len(countries),
                'index_info': 'Using single-column index on COUNTRY field'  # INDEX reference
            }
        }))


    @sync_to_async
    def _demo_subquery_logic(self, data):
        """SUBQUERY: Find rates above average for each currency"""
        Currency, MonthlyRate, _ = self._get_models()
        
        country = data.get('country', 'Vietnam')
        year = data.get('year', 2024)
        
        currencies = Currency.objects.filter(COUNTRY__iexact=country)
        
        results = []
        for currency in currencies:
            # SUBQUERY: Creating a subquery to calculate average rate
            avg_subquery = MonthlyRate.objects.filter(
                currency_id=OuterRef('currency_id'),
                year=year
            ).values('currency_id').annotate(
                avg_rate=Avg('rate')
            ).values('avg_rate')
            
            # QUERY WITH SUBQUERY: Using Subquery in filter condition
            above_avg_rates = MonthlyRate.objects.filter(
                currency=currency,
                year=year,
                rate__gt=Subquery(avg_subquery)  # SUBQUERY usage
            ).order_by('month')
            
            if above_avg_rates.exists():
                # STORED FUNCTION: Using the stored function equivalent
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
        
        # STORED FUNCTION: Calling the stored function equivalent
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
        
        # VIEW: Using the view-like structure from custom manager
        summary = MonthlyRate.objects.get_summary_view().filter(
            currency__COUNTRY__iexact=country,
            year=year
        )[:15]
        
        return list(summary)

    @sync_to_async
    def _demo_stored_procedure_logic(self, data):
        """STORED PROCEDURE: Update rate with validation"""
        Currency, MonthlyRate, _ = self._get_models()
        
        try:
            currency_id = data['currency_id']
            year = data['year']
            month = data['month']
            rate = float(data['rate'])
            
            # STORED PROCEDURE: Calling the stored procedure equivalent
            result = MonthlyRate.update_rate_procedure(
                currency_id=currency_id,
                year=year,
                month=month,
                rate=rate
            )
            
            return result
            
        except ValidationError as e:
            return {'error': f'Validation Error: {str(e)}', 'status': 'error'}
        except KeyError as e:
            return {'error': f'Missing parameter: {str(e)}', 'status': 'error'}
        except Exception as e:
            return {'error': f'Procedure failed: {str(e)}', 'status': 'error'}

    @sync_to_async
    def _demo_trigger_logic(self, data):
        """TRIGGER: Get audit logs created by signal triggers"""
        Currency, MonthlyRate, CurrencyRateAudit = self._get_models()
        
        country = data.get('country', 'Vietnam')
        limit = data.get('limit', 10)
        
        # INDEX: Using idx_audit_currency_date index
        queryset = CurrencyRateAudit.objects.all()
        if country:
            queryset = queryset.filter(currency_country__iexact=country)
        
        logs = queryset.order_by('-updated_at')[:limit]
        
        log_list = []
        for log in logs:
            log_list.append({
                'currency_country': log.currency_country,
                'currency_indicator': log.currency_indicator,
                'year': log.year,
                'month': log.month,
                'old_rate': log.old_rate,
                'new_rate': log.new_rate,
                'change_percentage': log.change_percentage,
                'updated_at': log.updated_at.isoformat() if log.updated_at else None
            })
        
        return log_list

    @sync_to_async
    def _demo_index_performance(self, data):
        """INDEX: Demonstrate performance with and without indexes"""
        Currency, MonthlyRate, _ = self._get_models()
        
        import time
        start_time = time.time()
        
        # INDEX: Using idx_currency_date and COUNTRY index
        indexed_result = list(MonthlyRate.objects.filter(
            currency__COUNTRY='Vietnam',
            year=2024
        ).select_related('currency').values(
            'currency__COUNTRY', 'month', 'rate'
        )[:10])
        
        indexed_time = time.time() - start_time
        
        stats = {
            'indexed_query_time_ms': round(indexed_time * 1000, 2),
            'indexed_results_count': len(indexed_result),
            'indexes_used': [
                'idx_currency_date (composite)',
                'currency.COUNTRY (single column)'
            ],
            'performance_tip': 'Indexes speed up WHERE clause filtering and JOIN operations'
        }
        
        return stats

    @sync_to_async
    def _get_dashboard_data(self, data):
        """Combined: Get dashboard data using all advanced features"""
        Currency, MonthlyRate, CurrencyRateAudit = self._get_models()
        
        year = data.get('year', 2024)
        limit = data.get('limit', 5)
        
        # VIEW: Using the view-like summary
        summary_query = MonthlyRate.objects.get_summary_view().filter(
            year=year
        ).order_by('-rate')[:limit]
        
        summary = []
        for item in summary_query:
            item_dict = {
                'currency__COUNTRY': item['currency__COUNTRY'],
                'currency__INDICATOR': item['currency__INDICATOR'],
                'year': item['year'],
                'month': item['month'],
                'rate': float(item['rate']) if item['rate'] is not None else 0.0,
                'base_currency_type': item['base_currency_type']
            }
            summary.append(item_dict)
        
        top_currencies = Currency.objects.all()[:5]
        averages = []
        for currency in top_currencies:
            # STORED FUNCTION: Using stored function to calculate averages
            avg = MonthlyRate.calculate_average_rate(currency.id, year)
            averages.append({
                'country': currency.COUNTRY,
                'indicator': currency.INDICATOR,
                'average_rate': float(avg) if avg is not None else 0.0
            })
        
        recent_logs = []
        # INDEX: Using idx_audit_currency_date index for ordering
        audit_logs = CurrencyRateAudit.objects.order_by('-updated_at')[:limit]
        for log in audit_logs:
            recent_logs.append({
                'currency_country': log.currency_country,
                'old_rate': float(log.old_rate) if log.old_rate is not None else None,
                'new_rate': float(log.new_rate) if log.new_rate is not None else 0.0,
                'updated_at': log.updated_at.isoformat() if log.updated_at else None
            })
        
        total_currencies = Currency.objects.count()
        total_rates = MonthlyRate.objects.count()
        total_audits = CurrencyRateAudit.objects.count()
        
        return {
            'summary': summary,
            'averages': averages,
            'recent_logs': recent_logs,
            'stats': {
                'total_currencies': total_currencies,
                'total_rates': total_rates,
                'total_audits': total_audits,
                'year': year
            }
        }


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

    async def demo_index_performance(self, data):
        """Handle index performance demo"""
        try:
            stats = await self._demo_index_performance(data)
            
            await self.send(text_data=json.dumps({
                'type': 'index_performance',
                'data': stats
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Index demo error: {str(e)}'
            }))

    async def get_dashboard_data(self, data):
        """Handle dashboard data request"""
        try:
            dashboard_data = await self._get_dashboard_data(data)
            
            await self.send(text_data=json.dumps({
                'type': 'dashboard_data',
                'data': dashboard_data
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Dashboard data error: {str(e)}'
            }))