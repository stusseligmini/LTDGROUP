import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { useAuth } from '../providers/AuthProvider';

interface Route {
  id: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  priceImpact: number;
  fee: string;
}

export default function SwapScreen() {
  const { token } = useAuth();
  const navigation = useNavigation();

  const [fromToken, setFromToken] = useState('SOL');
  const [toToken, setToToken] = useState('USDC');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [tokens, setTokens] = useState<any[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [slippage, setSlippage] = useState('0.5');
  const [fromDropdownOpen, setFromDropdownOpen] = useState(false);
  const [toDropdownOpen, setToDropdownOpen] = useState(false);

  useEffect(() => {
    fetchTokens();
  }, []);

  useEffect(() => {
    if (fromAmount) {
      fetchQuote();
    } else {
      setToAmount('');
      setRoutes([]);
    }
  }, [fromAmount, fromToken, toToken, slippage]);

  const fetchTokens = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3000'}/api/tokens`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setTokens(response.data);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      Alert.alert('Error', 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuote = async () => {
    if (!fromAmount || parseFloat(fromAmount) === 0) return;

    setQuoting(true);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3000'}/api/swap/quote`,
        {
          fromToken,
          toToken,
          amount: parseFloat(fromAmount),
          slippage: parseFloat(slippage),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        }
      );

      setRoutes(response.data.routes || []);
      if (response.data.routes && response.data.routes.length > 0) {
        const bestRoute = response.data.routes[0];
        setSelectedRoute(bestRoute);
        setToAmount(bestRoute.toAmount);
      }
    } catch (error) {
      console.error('Error fetching quote:', error);
      Alert.alert('Error', 'Failed to get quote');
    } finally {
      setQuoting(false);
    }
  };

  const handleSwap = async () => {
    if (!selectedRoute) {
      Alert.alert('Error', 'Please select a route');
      return;
    }

    setSwapping(true);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3000'}/api/swap`,
        {
          fromToken,
          toToken,
          amount: parseFloat(fromAmount),
          routeId: selectedRoute.id,
          slippage: parseFloat(slippage),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      Alert.alert('Success', `Swap completed! Hash: ${response.data.hash.slice(0, 20)}...`, [
        {
          text: 'View on Explorer',
          onPress: () => {
            // Open explorer
          },
        },
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : 'Failed to execute swap';
      Alert.alert('Error', message);
    } finally {
      setSwapping(false);
    }
  };

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  const handleMaxAmount = () => {
    const fromTokenData = tokens.find(t => t.symbol === fromToken);
    if (fromTokenData) {
      setFromAmount(fromTokenData.balance.toString());
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const fromTokenData = tokens.find(t => t.symbol === fromToken);
  const balance = fromTokenData?.balance || 0;
  const bestRoute = routes.length > 0 ? routes[0] : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Swap Tokens</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* From Token */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>From</Text>

          <TouchableOpacity
            style={styles.tokenSelector}
            onPress={() => setFromDropdownOpen(!fromDropdownOpen)}
          >
            <Text style={styles.tokenSelectorText}>{fromToken}</Text>
            <Text style={styles.dropdownArrow}>{fromDropdownOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {fromDropdownOpen && (
            <View style={styles.dropdown}>
              {tokens.map((t, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setFromToken(t.symbol);
                    setFromDropdownOpen(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{t.symbol}</Text>
                  <Text style={styles.dropdownItemBalance}>{t.balance.toFixed(4)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.amountInputContainer}>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="#64748B"
              value={fromAmount}
              onChangeText={setFromAmount}
              keyboardType="decimal-pad"
              editable={!swapping && !quoting}
            />
            <TouchableOpacity onPress={handleMaxAmount}>
              <Text style={styles.maxButton}>MAX</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.balanceText}>Balance: {balance.toFixed(4)} {fromToken}</Text>
        </View>

        {/* Swap Direction Button */}
        <View style={styles.swapButtonContainer}>
          <TouchableOpacity style={styles.swapButton} onPress={handleSwapTokens}>
            <Text style={styles.swapButtonIcon}>⇅</Text>
          </TouchableOpacity>
        </View>

        {/* To Token */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>To</Text>

          <TouchableOpacity
            style={styles.tokenSelector}
            onPress={() => setToDropdownOpen(!toDropdownOpen)}
          >
            <Text style={styles.tokenSelectorText}>{toToken}</Text>
            <Text style={styles.dropdownArrow}>{toDropdownOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {toDropdownOpen && (
            <View style={styles.dropdown}>
              {tokens.map((t, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setToToken(t.symbol);
                    setToDropdownOpen(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{t.symbol}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.amountInputContainer}>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="#64748B"
              value={toAmount}
              editable={false}
            />
          </View>
        </View>

        {/* Slippage Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Slippage Tolerance</Text>
          <View style={styles.slippageButtons}>
            {['0.1', '0.5', '1.0'].map(value => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.slippageButton,
                  slippage === value && styles.slippageButtonActive,
                ]}
                onPress={() => setSlippage(value)}
              >
                <Text
                  style={[
                    styles.slippageButtonText,
                    slippage === value && styles.slippageButtonTextActive,
                  ]}
                >
                  {value}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Route Information */}
        {bestRoute && (
          <View style={styles.routeInfo}>
            <View style={styles.routeRow}>
              <Text style={styles.routeLabel}>Price Impact:</Text>
              <Text
                style={[
                  styles.routeValue,
                  bestRoute.priceImpact > 2
                    ? styles.routeValueWarning
                    : styles.routeValueGood,
                ]}
              >
                {bestRoute.priceImpact.toFixed(2)}%
              </Text>
            </View>

            <View style={styles.routeRow}>
              <Text style={styles.routeLabel}>Route Fee:</Text>
              <Text style={styles.routeValue}>{bestRoute.fee}</Text>
            </View>

            {routes.length > 1 && (
              <TouchableOpacity
                style={styles.viewRoutesButton}
                onPress={() => {
                  Alert.alert(
                    'Alternative Routes',
                    `Found ${routes.length} routes. Best route selected.`,
                    [{ text: 'OK' }]
                  );
                }}
              >
                <Text style={styles.viewRoutesText}>
                  View {routes.length - 1} alternative routes
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Swap Button */}
        <TouchableOpacity
          style={[styles.swapActionButton, (!selectedRoute || swapping) && styles.swapActionButtonDisabled]}
          onPress={handleSwap}
          disabled={!selectedRoute || swapping || !fromAmount}
        >
          {swapping ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.swapActionButtonText}>Swap Now</Text>
          )}
        </TouchableOpacity>

        {/* Information */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            ⚠️ Review the rate and fees before confirming the swap
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backButton: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  section: {
    marginTop: 24,
  },
  sectionLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  tokenSelector: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tokenSelectorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownArrow: {
    color: '#94A3B8',
    fontSize: 12,
  },
  dropdown: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginTop: -1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  dropdownItemText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  dropdownItemBalance: {
    color: '#94A3B8',
    fontSize: 14,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  maxButton: {
    color: '#6366F1',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  balanceText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 8,
  },
  swapButtonContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  swapButton: {
    backgroundColor: '#6366F1',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swapButtonIcon: {
    fontSize: 20,
  },
  slippageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  slippageButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    alignItems: 'center',
  },
  slippageButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  slippageButtonText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  slippageButtonTextActive: {
    color: '#FFFFFF',
  },
  routeInfo: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 24,
  },
  routeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  routeLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  routeValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  routeValueGood: {
    color: '#10B981',
  },
  routeValueWarning: {
    color: '#F59E0B',
  },
  viewRoutesButton: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#0F172A',
  },
  viewRoutesText: {
    color: '#6366F1',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  swapActionButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  swapActionButtonDisabled: {
    backgroundColor: '#475569',
    opacity: 0.6,
  },
  swapActionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  infoBox: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 24,
  },
  infoText: {
    color: '#94A3B8',
    fontSize: 12,
  },
});
