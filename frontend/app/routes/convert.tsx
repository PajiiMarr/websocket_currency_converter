// app/routes/convert.tsx
import type { Route } from './+types/convert'
import { useState, useEffect, useCallback } from 'react';
import { Calendar } from '~/components/ui/calendar';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Skeleton } from '~/components/ui/skeleton';
import { ArrowRightLeft, CalendarIcon, AlertCircle, Loader2, CheckCircle, Info } from 'lucide-react';
import { format } from 'date-fns';
import useWebSocket from '~/hooks/useWebSocket';

export function meta(): Route.MetaDescriptors {
  return [
    {
      title: "Currency Converter",
    },
  ];
}

export default function ConvertRoute() {
  const [amount, setAmount] = useState('100');
  const [fromCountry, setFromCountry] = useState('Vietnam');
  const [toCountry, setToCountry] = useState('United States');
  const [fromIndicator, setFromIndicator] = useState('');
  const [toIndicator, setToIndicator] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);
  const [toIndicators, setToIndicators] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [date, setDate] = useState<Date>(new Date(2024, 11, 1));
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
  const websocketUrl = 'ws://localhost:8000/ws/currency/';
  const { sendMessage, isConnected, lastMessage } = useWebSocket(websocketUrl);

  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  const validateAmount = useCallback((value: string): string => {
    if (!value.trim()) return 'Amount is required';
    const num = parseFloat(value);
    if (isNaN(num)) return 'Must be a valid number';
    if (num <= 0) return 'Must be greater than 0';
    if (num > 1000000000) return 'Maximum: 1,000,000,000';
    if (!/^\d+(\.\d{1,2})?$/.test(value)) return 'Max 2 decimal places';
    return '';
  }, []);

  const validateSelections = useCallback((): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    const amountError = validateAmount(amount);
    if (amountError) newErrors.amount = amountError;
    
    if (!fromIndicator) newErrors.fromIndicator = 'Required';
    if (!toIndicator) newErrors.toIndicator = 'Required';
    
    if (year < 2000 || year > 2024) newErrors.date = 'Year must be 2000-2024';
    if (month < 1 || month > 12) newErrors.date = 'Month must be 1-12';
    
    if (fromCountry === toCountry && fromIndicator === toIndicator) {
      newErrors.conversion = 'Cannot convert to same currency';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [amount, fromIndicator, toIndicator, year, month, fromCountry, toIndicator, validateAmount]);

  const getCurrencyDisplay = useCallback((country: string, indicator: string) => {
    const countryName = country.split(',')[0].split('(')[0].trim();
    
    if (indicator.includes('US Dollar')) {
      return indicator.includes('per domestic') ? `${countryName}` : 'USD';
    } else if (indicator.includes('Euro')) {
      return indicator.includes('per domestic') ? `${countryName}` : 'EUR';
    } else if (indicator.includes('SDR')) {
      return indicator.includes('per domestic') ? `${countryName}` : 'SDR';
    }
    return countryName;
  }, []);

  const getCurrencySymbol = useCallback((country: string, indicator: string) => {
    const display = getCurrencyDisplay(country, indicator);
    if (display === 'USD') return '$';
    if (display === 'EUR') return '€';
    if (display === 'SDR') return 'SDR';
    return '';
  }, [getCurrencyDisplay]);

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
    if (fromIndicator && toIndicator && validateSelections()) {
      const timer = setTimeout(() => {
        triggerConversion();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [amount, fromCountry, fromIndicator, toCountry, toIndicator, year, month, triggerConversion, validateSelections]);

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Currency Converter
          </h1>
          <p className="text-gray-600">
            Real-time currency conversion with historical exchange rates
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Badge variant={isConnected ? "default" : "destructive"} className="gap-1">
              {isConnected ? (
                <>
                  <CheckCircle className="w-3 h-3" />
                  Connected
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3" />
                  Disconnected
                </>
              )}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <CalendarIcon className="w-3 h-3" />
              {format(date, 'MMM yyyy')}
            </Badge>
          </div>
        </div>

        {errors.connection && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>
              {errors.connection}. Please check your connection and try again.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Conversion Form */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5" />
                Conversion Settings
              </CardTitle>
              <CardDescription>
                Select currencies and amount to convert
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-medium">
                  Amount
                </Label>
                <div className="relative">
                  <Input
                    id="amount"
                    type="text"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="0.00"
                    className={`text-lg font-medium h-12 pl-4 pr-12 ${errors.amount ? 'border-red-500' : ''}`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    {fromIndicator && getCurrencySymbol(fromCountry, fromIndicator)}
                  </div>
                </div>
                {errors.amount && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.amount}
                  </p>
                )}
              </div>

              {/* Currency Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* From Currency */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="from-country" className="text-sm font-medium">
                      From Currency
                    </Label>
                    <Select value={fromCountry} onValueChange={handleFromCountryChange}>
                      <SelectTrigger id="from-country" className={errors.fromIndicator ? 'border-red-500' : ''}>
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
                  
                  <div className="space-y-2">
                    <Label htmlFor="from-indicator" className="text-sm font-medium">
                      Currency Type
                    </Label>
                    <Select 
                      value={fromIndicator} 
                      onValueChange={handleFromIndicatorChange}
                      disabled={indicators.length === 0}
                    >
                      <SelectTrigger id="from-indicator" className={errors.fromIndicator ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select type">
                          {fromIndicator && getCurrencyDisplay(fromCountry, fromIndicator)}
                        </SelectValue>
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
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.fromIndicator}
                      </p>
                    )}
                  </div>
                </div>

                {/* To Currency */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="to-country" className="text-sm font-medium">
                      To Currency
                    </Label>
                    <Select value={toCountry} onValueChange={handleToCountryChange}>
                      <SelectTrigger id="to-country" className={errors.toIndicator ? 'border-red-500' : ''}>
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
                  
                  <div className="space-y-2">
                    <Label htmlFor="to-indicator" className="text-sm font-medium">
                      Currency Type
                    </Label>
                    <Select 
                      value={toIndicator} 
                      onValueChange={handleToIndicatorChange}
                      disabled={toIndicators.length === 0}
                    >
                      <SelectTrigger id="to-indicator" className={errors.toIndicator ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select type">
                          {toIndicator && getCurrencyDisplay(toCountry, toIndicator)}
                        </SelectValue>
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
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.toIndicator}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Date Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  Historical Date
                </Label>
                <div className={`border rounded-lg ${errors.date ? 'border-red-500' : ''}`}>
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleDateChange}
                    className="rounded-md"
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
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.date}
                  </p>
                )}
              </div>

              {/* Conversion Error */}
              {errors.conversion && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errors.conversion}</AlertDescription>
                </Alert>
              )}

              {/* Server Error */}
              {errors.server && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Server Error: {errors.server}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Right Column: Result Display */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Conversion Result</CardTitle>
              <CardDescription>
                Real-time exchange rate calculation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Main Result */}
              <div className="text-center space-y-4">
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-gray-500">Calculating...</span>
                    </div>
                  </div>
                ) : showEmptyResult ? (
                  <div className="space-y-4">
                    <div className="text-3xl font-bold text-gray-300">--</div>
                    <p className="text-sm text-gray-500">
                      Enter amount and select currencies to see conversion
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="text-4xl font-bold text-gray-900">
                      {getCurrencySymbol(fromCountry, fromIndicator)}
                      {parseFloat(amount).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </div>
                    <div className="text-2xl font-semibold text-blue-600">
                      {getCurrencySymbol(toCountry, toIndicator)}
                      {result.converted_amount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6
                      })}
                    </div>
                  </>
                )}
              </div>

              <Separator />

              {/* Exchange Rate */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Exchange Rate</span>
                  {!showEmptyResult && !isLoading && (
                    <span className="font-semibold">
                      1 {getCurrencyDisplay(fromCountry, fromIndicator)} = {getCurrencySymbol(toCountry, toIndicator)}
                      {result.exchange_rate.toFixed(6)} {getCurrencyDisplay(toCountry, toIndicator)}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Date</span>
                  <span className="font-medium">{format(date, 'MMMM yyyy')}</span>
                </div>
              </div>

              {/* Currency Details */}
              {!showEmptyResult && !isLoading && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">From</div>
                        <div className="text-sm text-gray-600">
                          {result.from_currency.country}
                        </div>
                        <div className="text-xs text-gray-500">
                          Rate: {result.from_rate}
                        </div>
                      </div>
                      <Badge variant="outline">
                        {getCurrencyDisplay(fromCountry, fromIndicator)}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">To</div>
                        <div className="text-sm text-gray-600">
                          {result.to_currency.country}
                        </div>
                        <div className="text-xs text-gray-500">
                          Rate: {result.to_rate}
                        </div>
                      </div>
                      <Badge variant="outline">
                        {getCurrencyDisplay(toCountry, toIndicator)}
                      </Badge>
                    </div>
                  </div>
                </>
              )}

              {/* Information Alert */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Rates are updated in real-time. Conversion uses historical data for selected date.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>

        {/* Stats Footer */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white/50 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Available Countries</div>
                <div className="text-2xl font-bold">{countries.length}</div>
              </div>
              <Globe className="w-8 h-8 text-blue-500" />
            </CardContent>
          </Card>
          
          <Card className="bg-white/50 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Connection Status</div>
                <div className="text-2xl font-bold">{isConnected ? 'Live' : 'Offline'}</div>
              </div>
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            </CardContent>
          </Card>
          
          <Card className="bg-white/50 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Last Updated</div>
                <div className="text-2xl font-bold">Now</div>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Icons for the stats footer
function Globe({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}

function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}