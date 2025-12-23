import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { useAuth } from '../providers/AuthProvider';

const { width } = Dimensions.get('window');

interface Token {
  symbol: string;
  name: string;
  balance: string;
  balanceUSD: number;
  decimals: number;
  mint?: string;
  image?: string;
}

interface WalletData {
  address: string;
  blockchain: 'solana' | 'ethereum' | 'polygon';
  totalBalance: number;
  tokens: Token[];
  lastUpdated: string;
}

export default function WalletScreen() {
  const { token, wallet } = useAuth();
  const navigation = useNavigation();
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchWalletData();
    }, [token])
  );

  const fetchWalletData = async () => {
    try {
      setError(null);
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3000'}/api/wallet/balance`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 10000,
        }
      );

      setWalletData(response.data);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : 'Failed to fetch wallet data';
      setError(message);
      console.error('Wallet fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWalletData();
  }, [token]);

  const handleSend = () => {
    navigation.navigate('Send', { walletAddress: walletData?.address });
  };

  const handleReceive = () => {
    navigation.navigate('Receive', { walletAddress: walletData?.address });
  };

  const handleSwap = () => {
    navigation.navigate('Swap');
  };

  const handleTokenPress = (token: Token) => {
    navigation.navigate('TokenDetail', { token });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading wallet...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Error Loading Wallet</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchWalletData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!walletData) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No wallet data available</Text>
      </View>
    );
  }

  const tokenBalance = walletData.tokens.find(t => t.symbol === 'SOL');
  const nativeBalance = tokenBalance?.balanceUSD || 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>
          ${walletData.totalBalance.toFixed(2)}
        </Text>
        <Text style={styles.balanceSubtext}>
          Updated {new Date(walletData.lastUpdated).toLocaleTimeString()}
        </Text>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleReceive}>
            <Text style={styles.actionButtonIcon}>⬇️</Text>
            <Text style={styles.actionButtonText}>Receive</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleSend}>
            <Text style={styles.actionButtonIcon}>⬆️</Text>
            <Text style={styles.actionButtonText}>Send</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleSwap}>
            <Text style={styles.actionButtonIcon}>🔄</Text>
            <Text style={styles.actionButtonText}>Swap</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tokens Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Tokens</Text>

        {walletData.tokens.length > 0 ? (
          walletData.tokens.map((token, index) => (
            <TouchableOpacity
              key={`${token.symbol}-${index}`}
              style={styles.tokenItem}
              onPress={() => handleTokenPress(token)}
            >
              <View style={styles.tokenLeft}>
                {token.image ? (
                  <Image
                    source={{ uri: token.image }}
                    style={styles.tokenImage}
                  />
                ) : (
                  <View style={styles.tokenImagePlaceholder}>
                    <Text style={styles.tokenImageText}>
                      {token.symbol.charAt(0)}
                    </Text>
                  </View>
                )}
                <View style={styles.tokenInfo}>
                  <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                  <Text style={styles.tokenName}>{token.name}</Text>
                </View>
              </View>

              <View style={styles.tokenRight}>
                <Text style={styles.tokenBalance}>
                  {parseFloat(token.balance).toFixed(4)} {token.symbol}
                </Text>
                <Text style={styles.tokenValue}>
                  ${token.balanceUSD.toFixed(2)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyTokensText}>No tokens found</Text>
        )}
      </View>

      {/* Wallet Address */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wallet Address</Text>
        <View style={styles.addressContainer}>
          <Text style={styles.addressText}>
            {walletData.address.slice(0, 8)}...{walletData.address.slice(-8)}
          </Text>
          <TouchableOpacity
            onPress={() => {
              // Copy to clipboard
              Alert.alert('Copied', 'Wallet address copied to clipboard');
            }}
          >
            <Text style={styles.copyButton}>Copy</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Blockchain Info */}
      <View style={[styles.section, styles.lastSection]}>
        <Text style={styles.sectionTitle}>Network</Text>
        <View style={styles.chainInfo}>
          <Text style={styles.chainLabel}>Active Blockchain:</Text>
          <Text style={styles.chainValue}>
            {walletData.blockchain.charAt(0).toUpperCase() +
              walletData.blockchain.slice(1)}
          </Text>
        </View>
      </View>
    </ScrollView>
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
    paddingHorizontal: 16,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 12,
  },
  errorTitle: {
    color: '#FF4757',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  balanceCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    marginVertical: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  balanceLabel: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '700',
    marginBottom: 4,
  },
  balanceSubtext: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 20,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionButtonIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionButtonText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  lastSection: {
    paddingBottom: 32,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  tokenItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  tokenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tokenImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  tokenImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tokenImageText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenSymbol: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  tokenName: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  tokenRight: {
    alignItems: 'flex-end',
  },
  tokenBalance: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  tokenValue: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  emptyTokensText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  addressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  addressText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontFamily: 'monospace',
    flex: 1,
  },
  copyButton: {
    color: '#6366F1',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 12,
  },
  chainInfo: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chainLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
  },
  chainValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
