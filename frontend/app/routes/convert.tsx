// app/routes/convert.tsx
import { useState, useEffect, useCallback } from 'react';
import { Calendar } from '~/components/ui/calendar';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { format } from 'date-fns';
import useWebSocket from '~/hooks/useWebSocket';

export default function ConvertRoute() {
  const [amount, setAmount] = useState('100');
  const [fromCountry, setFromCountry] = useState('Vietnam');
  const [toCountry, setToCountry] = useState('Venezuela, República Bolivariana de');
  const [fromIndicator, setFromIndicator] = useState('');
  const [toIndicator, setToIndicator] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);
  const [toIndicators, setToIndicators] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [date, setDate] = useState<Date>(new Date(2024, 11, 1)); // Dec 1, 2024
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
  const websocketUrl = 'ws://localhost:8000/ws/currency/';
  const { sendMessage, isConnected, lastMessage } = useWebSocket(websocketUrl);

  // Extract year and month from date
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  // Validation functions
  const validateAmount = useCallback((value: string): string => {
    if (!value.trim()) return '';
    const num = parseFloat(value);
    if (isNaN(num)) return 'Amount must be a valid number';
    if (num <= 0) return 'Amount must be greater than 0';
    if (num > 1000000000) return 'Amount is too large (max: 1,000,000,000)';
    if (!/^\d+(\.\d{1,2})?$/.test(value)) return 'Amount can have max 2 decimal places';
    return '';
  }, []);

  const validateSelections = useCallback((): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    const amountError = validateAmount(amount);
    if (amountError) newErrors.amount = amountError;
    
    if (!fromIndicator) newErrors.fromIndicator = 'Please select a currency type';
    if (!toIndicator) newErrors.toIndicator = 'Please select a currency type';
    
    if (year < 2000 || year > 2024) newErrors.date = 'Year must be between 2000-2024';
    if (month < 1 || month > 12) newErrors.date = 'Month must be between 1-12';
    
    if (fromCountry === toCountry && fromIndicator === toIndicator) {
      newErrors.conversion = 'Cannot convert to the same currency type';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [amount, fromIndicator, toIndicator, year, month, fromCountry, toIndicator, validateAmount]);

  const getCurrencyDisplay = useCallback((country: string, indicator: string) => {
    const countryName = country.split(',')[0].split('(')[0].trim();
    
    if (indicator.includes('US Dollar')) {
      if (indicator.includes('per domestic')) {
        return `${countryName} currency`;
      } else {
        return `USD (from ${countryName})`;
      }
    } else if (indicator.includes('Euro')) {
      if (indicator.includes('per domestic')) {
        return `${countryName} currency`;
      } else {
        return `EUR (from ${countryName})`;
      }
    } else if (indicator.includes('SDR')) {
      if (indicator.includes('per domestic')) {
        return `${countryName} currency`;
      } else {
        return `SDR (from ${countryName})`;
      }
    }
    return indicator;
  }, []);

  const triggerConversion = useCallback(() => {
    if (!isConnected) {
      setErrors({connection: 'Not connected to server'});
      return;
    }
    
    setErrors({});
    
    if (!validateSelections()) {
      return;
    }
    
    setIsLoading(true);
    sendMessage({
      type: 'convert',
      amount: parseFloat(amount),
      from_country: fromCountry,
      from_indicator: fromIndicator,
      to_country: toCountry,
      to_indicator: toIndicator,
      year: year,
      month: month
    });
  }, [isConnected, amount, fromCountry, fromIndicator, toCountry, toIndicator, year, month, sendMessage, validateSelections]);

  useEffect(() => {
    if (isConnected) {
      sendMessage({ type: 'get_countries' });
      sendMessage({ type: 'get_currencies', country: fromCountry });
      sendMessage({ type: 'get_currencies', country: toCountry });
    } else {
      setErrors({connection: 'Connecting to server...'});
    }
  }, [isConnected, fromCountry, toCountry]);

  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage.data);
        
        switch (data.type) {
          case 'countries_list':
            setCountries(data.data.countries);
            break;
            
          case 'currencies_list':
            if (data.data.country === fromCountry) {
              setIndicators(data.data.currencies);
              if (data.data.currencies.length > 0 && !fromIndicator) {
                setFromIndicator(data.data.currencies[0].INDICATOR);
              }
            }
            if (data.data.country === toCountry) {
              setToIndicators(data.data.currencies);
              if (data.data.currencies.length > 0 && !toIndicator) {
                setToIndicator(data.data.currencies[0].INDICATOR);
              }
            }
            break;
            
          case 'conversion_result':
            setResult(data.data);
            setIsLoading(false);
            setErrors({});
            break;
            
          case 'error':
            setErrors({server: data.message});
            setIsLoading(false);
            break;
        }
      } catch (error) {
        console.error('Error parsing message:', error);
        setErrors({server: 'Failed to parse server response'});
        setIsLoading(false);
      }
    }
  }, [lastMessage, fromCountry, toCountry, fromIndicator, toIndicator]);

  useEffect(() => {
    if (fromIndicator && toIndicator) {
      const timer = setTimeout(() => {
        triggerConversion();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [amount, fromCountry, fromIndicator, toCountry, toIndicator, year, month, triggerConversion]);

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^\d.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    setAmount(value);
    
    const amountError = validateAmount(value);
    if (amountError) {
      setErrors(prev => ({...prev, amount: amountError}));
    } else {
      setErrors(prev => {
        const newErrors = {...prev};
        delete newErrors.amount;
        return newErrors;
      });
    }
  };

  const handleDateChange = (newDate: Date | undefined) => {
    if (newDate) {
      setDate(newDate);
      setErrors(prev => {
        const newErrors = {...prev};
        delete newErrors.date;
        return newErrors;
      });
    }
  };

  const handleFromCountryChange = (country: string) => {
    setFromCountry(country);
    setFromIndicator('');
    setErrors(prev => {
      const newErrors = {...prev};
      delete newErrors.fromIndicator;
      return newErrors;
    });
    sendMessage({ type: 'get_currencies', country: country });
  };

  const handleToCountryChange = (country: string) => {
    setToCountry(country);
    setToIndicator('');
    setErrors(prev => {
      const newErrors = {...prev};
      delete newErrors.toIndicator;
      return newErrors;
    });
    sendMessage({ type: 'get_currencies', country: country });
  };

  const handleFromIndicatorChange = (indicator: string) => {
    setFromIndicator(indicator);
    setErrors(prev => {
      const newErrors = {...prev};
      delete newErrors.fromIndicator;
      delete newErrors.conversion;
      return newErrors;
    });
  };

  const handleToIndicatorChange = (indicator: string) => {
    setToIndicator(indicator);
    setErrors(prev => {
      const newErrors = {...prev};
      delete newErrors.toIndicator;
      delete newErrors.conversion;
      return newErrors;
    });
  };

  const showEmptyResult = !result || !isConnected || Object.keys(errors).length > 0;

  return (
    <div className="p-6">
      {errors.connection && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{errors.connection}</p>
            </div>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left Column: Conversion Form */}
        <div className="bg-white rounded-xl shadow-lg p-6 h-full flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Currency Conversion</h2>
          
          {/* Amount Input */}
          <div className="mb-4">
            <Label htmlFor="amount">Amount:</Label>
            <Input
              id="amount"
              type="text"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="Enter amount"
              className={`w-full sm:w-48 ${errors.amount ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            />
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
            )}
          </div>

          {/* From Currency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="from-country">From Country:</Label>
              <Select value={fromCountry} onValueChange={handleFromCountryChange}>
                <SelectTrigger id="from-country" className="w-full sm:w-48">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map(country => (
                    <SelectItem key={`from-${country}`} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="from-indicator">From Currency Type:</Label>
              <Select 
                value={fromIndicator} 
                onValueChange={handleFromIndicatorChange}
                disabled={indicators.length === 0}
              >
                <SelectTrigger 
                  id="from-indicator" 
                  className={`w-full sm:w-48 ${errors.fromIndicator ? 'border-red-500' : ''}`}
                >
                  <SelectValue placeholder="Select currency type" />
                </SelectTrigger>
                <SelectContent>
                  {indicators.map(indicator => (
                    <SelectItem key={`from-ind-${indicator.id}`} value={indicator.INDICATOR}>
                      {getCurrencyDisplay(fromCountry, indicator.INDICATOR)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fromIndicator && (
                <p className="mt-1 text-sm text-red-600">{errors.fromIndicator}</p>
              )}
            </div>
          </div>

          {/* To Currency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="to-country">To Country:</Label>
              <Select value={toCountry} onValueChange={handleToCountryChange}>
                <SelectTrigger id="to-country" className="w-full sm:w-48">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map(country => (
                    <SelectItem key={`to-${country}`} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="to-indicator">To Currency Type:</Label>
              <Select 
                value={toIndicator} 
                onValueChange={handleToIndicatorChange}
                disabled={toIndicators.length === 0}
              >
                <SelectTrigger 
                  id="to-indicator" 
                  className={`w-full sm:w-48 ${errors.toIndicator ? 'border-red-500' : ''}`}
                >
                  <SelectValue placeholder="Select currency type" />
                </SelectTrigger>
                <SelectContent>
                  {toIndicators.map(indicator => (
                    <SelectItem key={`to-ind-${indicator.id}`} value={indicator.INDICATOR}>
                      {getCurrencyDisplay(toCountry, indicator.INDICATOR)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.toIndicator && (
                <p className="mt-1 text-sm text-red-600">{errors.toIndicator}</p>
              )}
            </div>
          </div>

          {/* Date Selection */}
          <div className="mb-6">
            <Label>Select Date (Year-Month):</Label>
            <div className={`border rounded-lg p-3 mt-2 sm:w-100 ${
              errors.date ? 'border-red-500' : 'border-gray-300'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  Selected: {format(date, 'MMMM yyyy')}
                </span>
              </div>
              
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateChange}
                className="rounded-md border"
                initialFocus
                fixedWeeks
                showOutsideDays={false}
                fromYear={2000}
                toYear={2024}
                classNames={{
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-sm font-medium",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex",
                  head_cell: "text-gray-500 rounded-md w-9 font-normal text-[0.8rem]",
                  row: "flex w-full mt-2",
                  cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-blue-50 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                  day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
                  day_selected: "bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white",
                  day_today: "bg-blue-100 text-blue-900",
                  day_outside: "text-gray-400 opacity-50",
                  day_disabled: "text-gray-400 opacity-50",
                  day_range_middle: "aria-selected:bg-blue-100 aria-selected:text-blue-900",
                  day_hidden: "invisible",
                }}
              />
            </div>
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{errors.date}</p>
            )}
          </div>

          {/* Errors and Loading */}
          <div className="mt-auto">
            {errors.conversion && (
              <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 w-full sm:w-80">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">{errors.conversion}</p>
                  </div>
                </div>
              </div>
            )}

            {errors.server && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 w-full sm:w-80">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">Server Error: {errors.server}</p>
                  </div>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="text-center p-3 w-full sm:w-80">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Converting...</p>
              </div>
            )}

            {Object.keys(errors).length > 0 && !isLoading && !isConnected && (
              <div className="mt-4 p-3 bg-gray-50 rounded w-full sm:w-80">
                <p className="text-sm text-gray-600">
                  Please fix the errors above to see conversion results.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Result Display */}
        <div className="bg-white rounded-xl shadow-lg p-6 h-full flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Conversion Result</h2>
          
          <div className="bg-blue-50 p-4 rounded-lg flex-grow flex flex-col">
            <div className="text-2xl font-bold text-center mb-2 min-h-[60px] flex items-center justify-center">
              {showEmptyResult || isLoading ? (
                <span className="text-gray-400">
                  {isLoading ? 'Converting...' : 'Enter amount and select currencies'}
                </span>
              ) : (
                <>
                  {result.original_amount} {getCurrencyDisplay(result.from_currency.country, result.from_currency.indicator)} = 
                  {result.converted_amount.toFixed(6)} {getCurrencyDisplay(result.to_currency.country, result.to_currency.indicator)}
                </>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 flex-grow">
              <div className="bg-white p-3 rounded flex flex-col">
                <h3 className="font-semibold">From:</h3>
                {showEmptyResult ? (
                  <div className="text-gray-400 flex-grow">
                    <p className="h-6 bg-gray-100 rounded mb-2"></p>
                    <p className="h-4 bg-gray-100 rounded mb-2"></p>
                    <p className="h-4 bg-gray-100 rounded"></p>
                  </div>
                ) : (
                  <div className="flex-grow">
                    <p className="font-medium">{result.from_currency.country}</p>
                    <p className="text-sm text-gray-600">{result.from_currency.indicator}</p>
                    {result.from_rate && (
                      <p className="text-sm mt-2">Rate: {result.from_rate}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-auto">Date: {result.year}-{result.month}</p>
                  </div>
                )}
              </div>
              
              <div className="bg-white p-3 rounded flex flex-col">
                <h3 className="font-semibold">To:</h3>
                {showEmptyResult ? (
                  <div className="text-gray-400 flex-grow">
                    <p className="h-6 bg-gray-100 rounded mb-2"></p>
                    <p className="h-4 bg-gray-100 rounded mb-2"></p>
                    <p className="h-4 bg-gray-100 rounded"></p>
                  </div>
                ) : (
                  <div className="flex-grow">
                    <p className="font-medium">{result.to_currency.country}</p>
                    <p className="text-sm text-gray-600">{result.to_currency.indicator}</p>
                    {result.to_rate && (
                      <p className="text-sm mt-2">Rate: {result.to_rate}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-auto">Date: {result.year}-{result.month}</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <h4 className="font-semibold">Exchange Rate:</h4>
              {showEmptyResult ? (
                <p className="text-lg text-gray-400">
                  Enter valid conversion details
                </p>
              ) : (
                <p className="text-lg">
                  1 {getCurrencyDisplay(result.from_currency.country, result.from_currency.indicator)} = 
                  {result.exchange_rate.toFixed(6)} {getCurrencyDisplay(result.to_currency.country, result.to_currency.indicator)}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}