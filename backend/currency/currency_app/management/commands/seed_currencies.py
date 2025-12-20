# currency_app/management/commands/seed_full.py
import pandas as pd
import numpy as np
from django.core.management.base import BaseCommand
from currency_app.models import Currency, MonthlyRate

class Command(BaseCommand):
    help = 'Clear database and seed full currency data from CSV'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--skip-errors',
            action='store_true',
            help='Skip rows with errors instead of stopping'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=1000,
            help='Number of MonthlyRate records to create in batch (default: 1000)'
        )
    
    def handle(self, *args, **kwargs):
        skip_errors = kwargs['skip_errors']
        batch_size = kwargs['batch_size']
        
        csv_path = '/Users/mar/react_projects/currency_converter/backend/cleaned_currency_2000.csv'
        
        self.stdout.write("="*60)
        self.stdout.write("CLEARING DATABASE AND SEEDING FROM CSV")
        self.stdout.write("="*60)
        
        # Step 1: Clear existing data
        self.stdout.write("\n1. Clearing existing data...")
        deleted_rates, _ = MonthlyRate.objects.all().delete()
        deleted_currencies, _ = Currency.objects.all().delete()
        self.stdout.write(f"   Deleted {deleted_currencies} Currency records")
        self.stdout.write(f"   Deleted {deleted_rates} MonthlyRate records")
        
        # Step 2: Read CSV
        self.stdout.write("\n2. Reading CSV file...")
        try:
            df = pd.read_csv(
                csv_path, 
                low_memory=False,
                na_values=['Units', 'units', 'UNITS', '', 'NaN', 'nan', 'null', 'NULL']
            )
        except Exception as e:
            self.stderr.write(f"Error reading CSV: {e}")
            return
        
        self.stdout.write(f"   Found {len(df)} rows in CSV")
        
        # Step 3: Identify monthly columns
        monthly_cols = []
        for col in df.columns:
            if isinstance(col, str) and col.startswith('2') and '-' in col and 'M' in col:
                monthly_cols.append(col)
        
        self.stdout.write(f"   Found {len(monthly_cols)} monthly columns")
        
        # Step 4: Process each row
        self.stdout.write("\n3. Processing data...")
        
        currency_created = 0
        currency_updated = 0
        rates_created = 0
        rows_processed = 0
        rows_with_errors = 0
        
        # Batch processing for MonthlyRate
        monthly_rate_batch = []
        
        for idx, row in df.iterrows():
            rows_processed += 1
            
            # Show progress every 100 rows
            if rows_processed % 100 == 0:
                self.stdout.write(f"   Processed {rows_processed}/{len(df)} rows...")
            
            try:
                # Extract metadata
                country = str(row['COUNTRY']).strip() if pd.notna(row['COUNTRY']) else ''
                indicator = str(row['INDICATOR']).strip() if pd.notna(row['INDICATOR']) else ''
                frequency = str(row['FREQUENCY']).strip() if pd.notna(row['FREQUENCY']) else 'Annual'
                scale = str(row['SCALE']).strip() if pd.notna(row['SCALE']) else 'Units'
                
                if not country or not indicator:
                    raise ValueError(f"Missing country or indicator: '{country}', '{indicator}'")
                
                # Create or get Currency
                currency, created = Currency.objects.get_or_create(
                    COUNTRY=country,
                    INDICATOR=indicator,
                    defaults={
                        'FREQUENCY': frequency,
                        'SCALE': scale
                    }
                )
                
                if created:
                    currency_created += 1
                else:
                    currency_updated += 1
                
                # Process monthly columns
                for col in monthly_cols:
                    value = row[col]
                    
                    # Skip NaN, None, empty values
                    if pd.isna(value):
                        continue
                    
                    # Skip if it's a string that can't be converted
                    if isinstance(value, str):
                        value_str = value.strip().lower()
                        if value_str in ['units', 'nan', 'null', '']:
                            continue
                    
                    try:
                        # Parse year and month from column name
                        year_str, month_str = col.split('-')
                        year = int(year_str)
                        month = int(month_str.replace('M', ''))
                        
                        # Convert value to float
                        try:
                            if isinstance(value, str):
                                value = value.strip()
                                # Handle scientific notation
                                if 'e-' in value.lower():
                                    rate_value = float(value)
                                else:
                                    rate_value = float(value)
                            else:
                                rate_value = float(value)
                            
                            # Add to batch
                            monthly_rate_batch.append(MonthlyRate(
                                currency=currency,
                                year=year,
                                month=month,
                                rate=rate_value
                            ))
                            
                            rates_created += 1
                            
                            # Bulk create if batch size reached
                            if len(monthly_rate_batch) >= batch_size:
                                MonthlyRate.objects.bulk_create(
                                    monthly_rate_batch,
                                    ignore_conflicts=True
                                )
                                monthly_rate_batch = []
                                
                        except (ValueError, TypeError) as conv_error:
                            # Skip this rate if can't convert to float
                            continue
                            
                    except (ValueError, IndexError) as parse_error:
                        # Skip if can't parse column name
                        continue
                
            except Exception as e:
                rows_with_errors += 1
                error_msg = f"Row {idx} error: {str(e)[:100]}"
                if skip_errors:
                    self.stdout.write(f"   ⚠ {error_msg}")
                else:
                    self.stderr.write(f"   ✗ {error_msg}")
                    if not skip_errors:
                        # Create remaining batch before stopping
                        if monthly_rate_batch:
                            MonthlyRate.objects.bulk_create(
                                monthly_rate_batch,
                                ignore_conflicts=True
                            )
                        return
                continue
        
        # Create any remaining MonthlyRate records
        if monthly_rate_batch:
            MonthlyRate.objects.bulk_create(
                monthly_rate_batch,
                ignore_conflicts=True
            )
        
        # Step 5: Summary
        self.stdout.write("\n" + "="*60)
        self.stdout.write("SEEDING COMPLETE - FINAL SUMMARY")
        self.stdout.write("="*60)
        self.stdout.write(f"Rows in CSV: {len(df)}")
        self.stdout.write(f"Rows processed: {rows_processed}")
        self.stdout.write(f"Rows with errors: {rows_with_errors}")
        self.stdout.write(f"Currency records created: {currency_created}")
        self.stdout.write(f"Currency records updated: {currency_updated}")
        self.stdout.write(f"MonthlyRate records created: {rates_created}")
        self.stdout.write(f"Total Currency in DB: {Currency.objects.count()}")
        self.stdout.write(f"Total MonthlyRate in DB: {MonthlyRate.objects.count()}")
        
        if rows_with_errors == 0:
            self.stdout.write(self.style.SUCCESS("\n✓ All rows processed successfully!"))
        else:
            self.stdout.write(self.style.WARNING(f"\n⚠ Completed with {rows_with_errors} errors"))