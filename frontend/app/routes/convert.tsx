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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { 
  ArrowRightLeft, 
  CalendarIcon, 
  AlertCircle, 
  Loader2, 
  CheckCircle, 
  Info,
  BarChart3,
  Database,
  Zap,
  Eye,
  FunctionSquare,
  PlayCircle,
  Bell,
  TrendingUp,
  Shield,
  Layers
} from 'lucide-react';
import { format } from 'date-fns';
import useWebSocket from '~/hooks/useWebSocket';

export function meta(): Route.MetaDescriptors {
  return [
    {
      title: "Currency Converter",
    },
  ];
}

// Type Definitions
interface Currency {
  id: number;
  COUNTRY: string;
  INDICATOR: string;
}

interface ConversionResult {
  original_amount: number;
  converted_amount: number;
  from_currency: Currency;
  to_currency: Currency;
  from_rate: number;
  to_rate: number;
  from_to_usd: number;
  to_to_usd: number;
  exchange_rate: number;
  exchange_rate_formula: string;
  year: number;
  month: number;
}

interface SubqueryResultItem {
  country: string;
  indicator: string;
  year: number;
  month: number;
  rate: number;
  average_rate: number;
  difference: number;
  difference_percent: number;
}

interface SubqueryData {
  results: SubqueryResultItem[];
  count: number;
  demonstration: string;
  sql_concept: string;
  orm_method: string;
}

interface ViewSummaryItem {
  currency__COUNTRY: string;
  currency__INDICATOR: string;
  year: number;
  month: number;
  rate: number;
  base_currency_type: string;
}

interface ViewData {
  summary: ViewSummaryItem[];
  count: number;
  demonstration: string;
  sql_concept: string;
  orm_equivalent: string;
}

interface FunctionData {
  currency_id: number;
  year: number;
  average_rate: number;
  calculation_method: string;
  error?: string;
}

interface ProcedureResult {
  status: string;
  message: string;
  currency: string;
  year: number;
  month: number;
  rate: number;
  action: string;
  id?: number;
  error?: string;
}

interface AuditLogItem {
  currency__COUNTRY: string;
  currency__INDICATOR: string;
  year: number;
  month: number;
  old_rate: number | null;
  new_rate: number;
  change_percentage: number | null;
  updated_at: string;
}

interface TriggerData {
  logs: AuditLogItem[];
  count: number;
  demonstration: string;
  sql_concept: string;
  orm_equivalent: string;
}

interface IndexPerformanceData {
  indexed_query_time_ms: number;
  indexed_results_count: number;
  indexes_used: string[];
  performance_tip: string;
}

interface DashboardStats {
  total_currencies: number;
  total_rates: number;
  total_audits: number;
  year: number;
}

interface DashboardAverageItem {
  country: string;
  indicator: string;
  average_rate: number;
}

interface DashboardRecentLog {
  currency__COUNTRY: string;
  old_rate: number | null;
  new_rate: number;
  updated_at: string;
}

interface DashboardData {
  summary: ViewSummaryItem[];
  averages: DashboardAverageItem[];
  recent_logs: DashboardRecentLog[];
  stats: DashboardStats;
}

interface AdvancedFeaturesData {
  subqueryData: SubqueryData | null;
  viewData: ViewData | null;
  functionData: FunctionData | null;
  procedureData: ProcedureResult | null;
  triggerData: TriggerData | null;
  indexData: IndexPerformanceData | null;
  dashboardData: DashboardData | null;
}

export default function ConvertRoute() {
  const [amount, setAmount] = useState('100');
  const [fromCountry, setFromCountry] = useState('Philippines');
  const [toCountry, setToCountry] = useState('United States');
  const [fromIndicator, setFromIndicator] = useState('');
  const [toIndicator, setToIndicator] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);
  const [toIndicators, setToIndicators] = useState<any[]>([]);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [date, setDate] = useState<Date>(new Date(2024, 11, 1));
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [advancedFeatures, setAdvancedFeatures] = useState<AdvancedFeaturesData>({
    subqueryData: null,
    viewData: null,
    functionData: null,
    procedureData: null,
    triggerData: null,
    indexData: null,
    dashboardData: null
  });
  const [activeFeature, setActiveFeature] = useState('dashboard');
  
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

    // Function to test advanced features
  const testAdvancedFeature = useCallback((feature: string) => {
    setActiveFeature(feature);
    
    switch (feature) {
      case 'subquery':
        sendMessage({
          type: 'get_rates_above_average',
          country: fromCountry,
          year: year
        });
        break;
      case 'view':
        sendMessage({
          type: 'get_rate_summary',
          country: fromCountry,
          year: year
        });
        break;
      case 'function':
        const currencyId = indicators[0]?.id;
        if (currencyId) {
          sendMessage({
            type: 'get_average_rate',
            currency_id: currencyId,
            year: year
          });
        } else {
          // Fallback to a known currency ID
          sendMessage({
            type: 'get_average_rate',
            currency_id: 1, // Use ID 1 as fallback
            year: year
          });
        }
        break;
      case 'procedure':
        // First get a valid currency ID from the first indicator
        const firstCurrencyId = indicators[0]?.id || 1;
        sendMessage({
          type: 'update_rate',
          currency_id: firstCurrencyId, // Use actual ID
          year: year,
          month: month,
          rate: 23000
        });
        break;
      // Change to:
      case 'trigger':
        sendMessage({
          type: 'get_audit_logs',
          country: fromCountry,  // Send country name
          limit: 5
        });
        break;
      case 'index':
        sendMessage({
          type: 'get_currency_stats'
        });
        break;
      case 'dashboard':
        sendMessage({
          type: 'get_dashboard_data',
          year: year,
          limit: 5
        });
        break;
    }
  }, [sendMessage, fromCountry, year, month, indicators]);

  useEffect(() => {
    if (isConnected) {
      sendMessage({ type: 'get_countries' });
      sendMessage({ type: 'get_currencies', country: fromCountry });
      sendMessage({ type: 'get_currencies', country: toCountry });
      // Load dashboard data on connect
      setTimeout(() => {
        testAdvancedFeature('dashboard');
      }, 1000);
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
            
          case 'rates_above_average':
            setAdvancedFeatures(prev => ({...prev, subqueryData: data.data}));
            break;
            
          case 'rate_summary':
            setAdvancedFeatures(prev => ({...prev, viewData: data.data}));
            break;
            
          case 'average_rate_result':
            setAdvancedFeatures(prev => ({...prev, functionData: data.data}));
            break;
            
          case 'rate_update_result':
            setAdvancedFeatures(prev => ({...prev, procedureData: data.data}));
            break;
            
          case 'audit_logs':
            setAdvancedFeatures(prev => ({...prev, triggerData: data.data}));
            break;
            
          case 'index_performance':
            setAdvancedFeatures(prev => ({...prev, indexData: data.data}));
            break;
            
          case 'dashboard_data':
            setAdvancedFeatures(prev => ({...prev, dashboardData: data.data}));
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
            Real-time currency conversion with advanced SQL features demonstration
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
                    captionLayout="dropdown"
                    classNames={{
                      nav: "space-x-1 flex items-center",
                      nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                      nav_button_previous: "absolute left-1",
                      nav_button_next: "absolute right-1",
                      table: "w-full border-collapse space-y-1",
                      head_row: "flex",
                      head_cell: "text-gray-500 rounded-md",
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
          <Card className="h-full">
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

        {/* Advanced SQL Features Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Advanced SQL Features Demo
            </CardTitle>
            <CardDescription>
              Demonstrating database optimization techniques used in backend
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="dashboard" value={activeFeature} onValueChange={setActiveFeature}>
              <TabsList className="grid grid-cols-7 mb-6">
                <TabsTrigger value="dashboard" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="index" className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  INDEX
                </TabsTrigger>
                <TabsTrigger value="view" className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  VIEW
                </TabsTrigger>
                <TabsTrigger value="function" className="flex items-center gap-2">
                  <FunctionSquare className="w-4 h-4" />
                  Function
                </TabsTrigger>
                <TabsTrigger value="procedure" className="flex items-center gap-2">
                  <PlayCircle className="w-4 h-4" />
                  Procedure
                </TabsTrigger>
                <TabsTrigger value="trigger" className="flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  TRIGGER
                </TabsTrigger>
                <TabsTrigger value="subquery" className="flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  SUBQUERY
                </TabsTrigger>
              </TabsList>

              {/* Dashboard Tab */}
              <TabsContent value="dashboard">
                {advancedFeatures.dashboardData ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold">
                            {advancedFeatures.dashboardData.stats.total_currencies}
                          </div>
                          <div className="text-sm text-gray-600">Total Currencies</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold">
                            {advancedFeatures.dashboardData.stats.total_rates}
                          </div>
                          <div className="text-sm text-gray-600">Exchange Rates</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold">
                            {advancedFeatures.dashboardData.stats.total_audits}
                          </div>
                          <div className="text-sm text-gray-600">Audit Records</div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Top Rates */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Top Exchange Rates ({year})</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Country</TableHead>
                                <TableHead>Month</TableHead>
                                <TableHead className="text-right">Rate</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {advancedFeatures.dashboardData.summary.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell>{item.currency__COUNTRY}</TableCell>
                                  <TableCell>{item.month}</TableCell>
                                  <TableCell className="text-right">{item.rate.toFixed(4)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>

                      {/* Recent Changes */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Recent Rate Changes</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Country</TableHead>
                                <TableHead>Old</TableHead>
                                <TableHead>New</TableHead>
                                <TableHead>Time</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {advancedFeatures.dashboardData.recent_logs.map((log, index) => (
                                <TableRow key={index}>
                                  <TableCell>{log.currency__COUNTRY}</TableCell>
                                  <TableCell>{log.old_rate?.toFixed(2) || 'N/A'}</TableCell>
                                  <TableCell>{log.new_rate.toFixed(2)}</TableCell>
                                  <TableCell>{new Date(log.updated_at).toLocaleTimeString()}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                    <p>Loading dashboard data...</p>
                  </div>
                )}
              </TabsContent>

              {/* INDEX Tab */}
              <TabsContent value="index">
                {advancedFeatures.indexData ? (
                  <div className="space-y-4">
                    <Alert>
                      <Zap className="h-4 w-4" />
                      <AlertTitle>Database Index Performance</AlertTitle>
                      <AlertDescription>
                        Indexes improve query performance by creating optimized data structures for faster lookups.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Query Performance</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {advancedFeatures.indexData.indexed_query_time_ms}ms
                          </div>
                          <div className="text-sm text-gray-600">Indexed query time</div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Results</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {advancedFeatures.indexData.indexed_results_count}
                          </div>
                          <div className="text-sm text-gray-600">Records retrieved</div>
                        </CardContent>
                      </Card>
                    </div>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Indexes Used</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {advancedFeatures.indexData.indexes_used.map((index: string, i: number) => (
                            <li key={i} className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-green-500" />
                              <code className="text-sm bg-gray-100 px-2 py-1 rounded">{index}</code>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                    
                    <Button onClick={() => testAdvancedFeature('index')} className="w-full">
                      <Zap className="w-4 h-4 mr-2" />
                      Test Index Performance Again
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Button onClick={() => testAdvancedFeature('index')}>
                      <Zap className="w-4 h-4 mr-2" />
                      Test Index Performance
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* VIEW Tab */}
              <TabsContent value="view">
                {advancedFeatures.viewData ? (
                  <div className="space-y-4">
                    <Alert>
                      <Eye className="h-4 w-4" />
                      <AlertTitle>SQL View Implementation</AlertTitle>
                      <AlertDescription>
                        Views are virtual tables that simplify complex queries and provide data abstraction.
                      </AlertDescription>
                    </Alert>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Rate Summary View</CardTitle>
                        <CardDescription>
                          Showing rates for {fromCountry} in {year}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Country</TableHead>
                              <TableHead>Indicator</TableHead>
                              <TableHead>Month</TableHead>
                              <TableHead className="text-right">Rate</TableHead>
                              <TableHead>Base Currency</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {advancedFeatures.viewData.summary.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell>{item.currency__COUNTRY}</TableCell>
                                <TableCell className="max-w-[200px] truncate">{item.currency__INDICATOR}</TableCell>
                                <TableCell>{item.month}</TableCell>
                                <TableCell className="text-right">{item.rate.toFixed(4)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{item.base_currency_type}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                    
                    <Button onClick={() => testAdvancedFeature('view')} className="w-full">
                      <Eye className="w-4 h-4 mr-2" />
                      Refresh View Data
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Button onClick={() => testAdvancedFeature('view')}>
                      <Eye className="w-4 h-4 mr-2" />
                      Load View Data
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* STORED FUNCTION Tab */}
              <TabsContent value="function">
                {advancedFeatures.functionData ? (
                  <div className="space-y-4">
                    <Alert>
                      <FunctionSquare className="h-4 w-4" />
                      <AlertTitle>Stored Function Demo</AlertTitle>
                      <AlertDescription>
                        Functions encapsulate reusable logic and return single values.
                      </AlertDescription>
                    </Alert>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Average Rate Calculation</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-center">
                          <div className="text-4xl font-bold text-blue-600">
                            {advancedFeatures.functionData.average_rate.toFixed(4)}
                          </div>
                          <div className="text-sm text-gray-600">
                            Average exchange rate for {year}
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Currency ID:</span>
                            <span className="font-medium">{advancedFeatures.functionData.currency_id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Year:</span>
                            <span className="font-medium">{advancedFeatures.functionData.year}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Method:</span>
                            <span className="font-medium">{advancedFeatures.functionData.calculation_method}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Button onClick={() => testAdvancedFeature('function')} className="w-full">
                      <FunctionSquare className="w-4 h-4 mr-2" />
                      Calculate Average Again
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Button onClick={() => testAdvancedFeature('function')}>
                      <FunctionSquare className="w-4 h-4 mr-2" />
                      Calculate Average Rate
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* STORED PROCEDURE Tab */}
              <TabsContent value="procedure">
                {advancedFeatures.procedureData ? (
                  <div className="space-y-4">
                    <Alert>
                      <PlayCircle className="h-4 w-4" />
                      <AlertTitle>Stored Procedure Result</AlertTitle>
                      <AlertDescription>
                        Procedures execute predefined operations with validation and transaction handling.
                      </AlertDescription>
                    </Alert>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Rate Update Procedure</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {advancedFeatures.procedureData.error ? (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Procedure Failed</AlertTitle>
                            <AlertDescription>{advancedFeatures.procedureData.error}</AlertDescription>
                          </Alert>
                        ) : (
                          <>
                            <Alert className="bg-green-50 border-green-200">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <AlertTitle className="text-green-800">Success!</AlertTitle>
                              <AlertDescription className="text-green-700">
                                {advancedFeatures.procedureData.message}
                              </AlertDescription>
                            </Alert>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Currency:</span>
                                <span className="font-medium">{advancedFeatures.procedureData.currency}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Date:</span>
                                <span className="font-medium">
                                  {advancedFeatures.procedureData.year}-{advancedFeatures.procedureData.month}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">New Rate:</span>
                                <span className="font-medium">{advancedFeatures.procedureData.rate}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Action:</span>
                                <span className="font-medium">
                                  <Badge variant={advancedFeatures.procedureData.status === 'success' ? 'default' : 'destructive'}>
                                    {advancedFeatures.procedureData.status}
                                  </Badge>
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                    
                    <Button onClick={() => testAdvancedFeature('procedure')} className="w-full">
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Test Procedure Again
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Button onClick={() => testAdvancedFeature('procedure')}>
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Test Update Procedure
                    </Button>
                    <p className="text-sm text-gray-500 mt-2">
                      This will attempt to update a sample rate with validation
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* TRIGGER Tab */}
              <TabsContent value="trigger">
                {advancedFeatures.triggerData ? (
                  <div className="space-y-4">
                    <Alert>
                      <Bell className="h-4 w-4" />
                      <AlertTitle>Trigger Audit Logs</AlertTitle>
                      <AlertDescription>
                        Triggers automatically execute actions in response to data changes.
                      </AlertDescription>
                    </Alert>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Recent Rate Changes (Audit Log)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Country</TableHead>
                              <TableHead>Indicator</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Old Rate</TableHead>
                              <TableHead>New Rate</TableHead>
                              <TableHead>Change %</TableHead>
                              <TableHead>Time</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {advancedFeatures.triggerData.logs.map((log, index) => (
                              <TableRow key={index}>
                                <TableCell>{log.currency__COUNTRY}</TableCell>
                                <TableCell className="max-w-[150px] truncate">{log.currency__INDICATOR}</TableCell>
                                <TableCell>{log.year}-{log.month}</TableCell>
                                <TableCell>{log.old_rate?.toFixed(2) || 'N/A'}</TableCell>
                                <TableCell>{log.new_rate.toFixed(2)}</TableCell>
                                <TableCell>
                                  {log.change_percentage ? (
                                    <Badge variant={log.change_percentage > 0 ? 'destructive' : 'default'}>
                                      {log.change_percentage > 0 ? '+' : ''}{log.change_percentage.toFixed(2)}%
                                    </Badge>
                                  ) : 'N/A'}
                                </TableCell>
                                <TableCell>{new Date(log.updated_at).toLocaleTimeString()}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                    
                    <Button onClick={() => testAdvancedFeature('trigger')} className="w-full">
                      <Bell className="w-4 h-4 mr-2" />
                      Refresh Audit Logs
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Button onClick={() => testAdvancedFeature('trigger')}>
                      <Bell className="w-4 h-4 mr-2" />
                      Load Audit Logs
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* SUBQUERY Tab */}
              <TabsContent value="subquery">
                {advancedFeatures.subqueryData ? (
                  <div className="space-y-4">
                    <Alert>
                      <Layers className="h-4 w-4" />
                      <AlertTitle>Subquery Results</AlertTitle>
                      <AlertDescription>
                        Subqueries allow nested queries and complex filtering conditions.
                      </AlertDescription>
                    </Alert>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Rates Above Average</CardTitle>
                        <CardDescription>
                          Rates in {fromCountry} for {year} that are above their yearly average
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Country</TableHead>
                              <TableHead>Indicator</TableHead>
                              <TableHead>Month</TableHead>
                              <TableHead>Rate</TableHead>
                              <TableHead>Average</TableHead>
                              <TableHead>Difference</TableHead>
                              <TableHead>% Change</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {advancedFeatures.subqueryData.results.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell>{item.country}</TableCell>
                                <TableCell className="max-w-[200px] truncate">{item.indicator}</TableCell>
                                <TableCell>{item.month}</TableCell>
                                <TableCell>{item.rate.toFixed(4)}</TableCell>
                                <TableCell>{item.average_rate.toFixed(4)}</TableCell>
                                <TableCell>
                                  <span className={item.difference > 0 ? 'text-green-600' : 'text-red-600'}>
                                    {item.difference > 0 ? '+' : ''}{item.difference.toFixed(4)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={item.difference_percent > 0 ? 'destructive' : 'default'}>
                                    {item.difference_percent > 0 ? '+' : ''}{item.difference_percent.toFixed(2)}%
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">How it works:</h4>
                      <p className="text-sm text-gray-600 mb-2">
                        This query uses a <strong>correlated subquery</strong> to:
                      </p>
                      <ol className="text-sm text-gray-600 list-decimal pl-5 space-y-1">
                        <li>Calculate average rate for each currency in the given year (subquery)</li>
                        <li>Compare each monthly rate with its respective average (main query)</li>
                        <li>Return only rates that are above average</li>
                      </ol>
                    </div>
                    
                    <Button onClick={() => testAdvancedFeature('subquery')} className="w-full">
                      <Layers className="w-4 h-4 mr-2" />
                      Run Subquery Again
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Button onClick={() => testAdvancedFeature('subquery')}>
                      <Layers className="w-4 h-4 mr-2" />
                      Run Subquery Analysis
                    </Button>
                    <p className="text-sm text-gray-500 mt-2">
                      Find rates above average for {fromCountry} in {year}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
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