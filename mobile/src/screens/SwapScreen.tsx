import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import axios from 'axios';

interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
}

export default function SwapScreen() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fromToken, setFromToken] = useState<TokenInfo | null>(null);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [selectedFor, setSelectedFor] = useState<'from' | 'to'>('from');
  const [swapPrice, setSwapPrice] = useState<number | null>(null);
  const [recentSwaps, setRecentSwaps] = useState<any[]>([]);

  useEffect(() => {
    fetchTokens();
    fetchRecentSwaps();
  }, []);

  const fetchTokens = async () => {
    try {
      const response = await axios.get(`${process.env.API_BASE_URL}/api/swap/tokens`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setTokens(response.data.tokens || []);
      if (response.data.tokens?.length > 0) {
        setFromToken(response.data.tokens[0]);
        if (response.data.tokens.length > 1) {
          setToToken(response.data.tokens[1]);
        }
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
    }
  };

  const fetchRecentSwaps = async () => {
    try {
      const response = await axios.get(`${process.env.API_BASE_URL}/api/swap/recent`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setRecentSwaps(response.data.swaps || []);
    } catch (error) {
      console.error('Error fetching recent swaps:', error);
    }
  };

  const getSwapQuote = async (amount: string) => {
    if (!fromToken || !toToken || !amount) return;

    try {
      const response = await axios.post(
        `${process.env.API_BASE_URL}/api/swap/quote`,
        {
          fromMint: fromToken.mint,
          toMint: toToken.mint,
          amount: parseFloat(amount),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setToAmount(response.data.outAmount || '');
      setSwapPrice(response.data.priceImpact || 0);
    } catch (error) {
      console.error('Error getting swap quote:', error);
    }
  };

  const handleSwap = async () => {
    if (!fromToken || !toToken || !fromAmount) return;

    setLoading(true);
    try {
      await axios.post(
        `${process.env.API_BASE_URL}/api/swap/execute`,
        {
          fromMint: fromToken.mint,
          toMint: toToken.mint,
          amount: parseFloat(fromAmount),
          slippage: 1,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setFromAmount('');
      setToAmount('');
      fetchRecentSwaps();
    } catch (error) {
      console.error('Error executing swap:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount('');
    setToAmount('');
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Swap Card */}
      <View style={styles.swapCard}>
        {/* From Section */}
        <View style={styles.tokenSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>From</Text>
            <Text style={styles.balance}>Balance: TBD</Text>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#64748b"
              value={fromAmount}
              onChangeText={(text) => {
                setFromAmount(text);
                getSwapQuote(text);
              }}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              onPress={() => {
                setSelectedFor('from');
                setShowTokenModal(true);
              }}
              style={styles.tokenButton}
            >
              <Text style={styles.tokenButtonText}>
                {fromToken?.symbol || 'Select'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Switch Button */}
        <View style={styles.switchContainer}>
          <TouchableOpacity onPress={switchTokens} style={styles.switchButton}>
            <Text style={styles.switchText}>⇅</Text>
          </TouchableOpacity>
        </View>

        {/* To Section */}
        <View style={styles.tokenSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>To</Text>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { color: '#94a3b8' }]}
              placeholder="0"
              placeholderTextColor="#64748b"
              value={toAmount}
              editable={false}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              onPress={() => {
                setSelectedFor('to');
                setShowTokenModal(true);
              }}
              style={styles.tokenButton}
            >
              <Text style={styles.tokenButtonText}>
                {toToken?.symbol || 'Select'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Price Impact */}
        {swapPrice !== null && (
          <View style={styles.priceImpact}>
            <Text style={styles.priceLabel}>Price Impact</Text>
            <Text
              style={[
                styles.priceValue,
                { color: swapPrice > 5 ? '#ef4444' : swapPrice > 1 ? '#f59e0b' : '#10b981' },
              ]}
            >
              {swapPrice.toFixed(2)}%
            </Text>
          </View>
        )}

        {/* Swap Button */}
        <TouchableOpacity
          onPress={handleSwap}
          disabled={loading || !fromAmount || !toAmount}
          style={[styles.swapButton, (!fromAmount || !toAmount) && styles.swapButtonDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.swapButtonText}>Review Swap</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Recent Swaps */}
      {recentSwaps.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Swaps</Text>
          {recentSwaps.slice(0, 3).map((swap) => (
            <View key={swap.id} style={styles.swapItem}>
              <View style={styles.swapItemContent}>
                <Text style={styles.swapItemText}>
                  {swap.fromAmount} {swap.fromSymbol} → {swap.toAmount} {swap.toSymbol}
                </Text>
                <Text style={styles.swapItemDate}>
                  {new Date(swap.timestamp * 1000).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.swapItemStatus}>✓</Text>
            </View>
          ))}
        </View>
      )}

      {/* Token Selection Modal */}
      <Modal visible={showTokenModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Token</Text>
              <TouchableOpacity onPress={() => setShowTokenModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search tokens..."
                placeholderTextColor="#64748b"
              />
            </View>

            <ScrollView style={styles.tokenList}>
              {tokens.map((t) => (
                <TouchableOpacity
                  key={t.mint}
                  onPress={() => {
                    if (selectedFor === 'from') {
                      setFromToken(t);
                    } else {
                      setToToken(t);
                    }
                    setShowTokenModal(false);
                  }}
                  style={styles.tokenItem}
                >
                  <View>
                    <Text style={styles.tokenName}>{t.name}</Text>
                    <Text style={styles.tokenSymbol}>{t.symbol}</Text>
                  </View>
                  {(selectedFor === 'from' ? fromToken?.mint : toToken?.mint) === t.mint && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  swapCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tokenSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  balance: {
    color: '#64748b',
    fontSize: 11,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tokenButton: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tokenButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  switchContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  switchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  priceImpact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    marginBottom: 12,
  },
  priceLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  priceValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  swapButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  swapButtonDisabled: {
    opacity: 0.5,
  },
  swapButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  swapItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  swapItemContent: {
    flex: 1,
  },
  swapItemText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  swapItemDate: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  swapItemStatus: {
    color: '#10b981',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    color: '#94a3b8',
    fontSize: 18,
  },
  searchBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tokenList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  tokenItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tokenName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  tokenSymbol: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  checkmark: {
    color: '#10b981',
    fontSize: 16,
  },
});
