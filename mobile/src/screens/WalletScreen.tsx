import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import axios from 'axios';

interface WalletBalance {
  blockchain: string;
  address: string;
  balance: string;
  balanceUSD: number;
}

export default function WalletScreen() {
  const { token } = useAuth();
  const [wallets, setWallets] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchWallets();
  }, []);

  const fetchWallets = async () => {
    try {
      const response = await axios.get(`${process.env.API_BASE_URL}/api/wallet/summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Transform the data - this depends on your API structure
      setWallets(response.data.holdings || []);
    } catch (error) {
      console.error('Error fetching wallets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchWallets();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>My Wallets</Text>
        <Text style={styles.subtitle}>Total Balance</Text>
        <Text style={styles.totalBalance}>
          ${wallets.reduce((sum, w) => sum + (w.balanceUSD || 0), 0).toFixed(2)}
        </Text>
      </View>

      <View style={styles.walletList}>
        {wallets.map((wallet, index) => (
          <TouchableOpacity key={index} style={styles.walletCard}>
            <View style={styles.walletInfo}>
              <Text style={styles.walletName}>{wallet.blockchain}</Text>
              <Text style={styles.walletAddress}>
                {wallet.address.substring(0, 6)}...{wallet.address.substring(wallet.address.length - 4)}
              </Text>
            </View>
            <View style={styles.walletBalance}>
              <Text style={styles.balanceAmount}>{wallet.balance}</Text>
              <Text style={styles.balanceUSD}>${wallet.balanceUSD?.toFixed(2)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 20,
    backgroundColor: '#6366f1',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#e0e7ff',
    marginBottom: 4,
  },
  totalBalance: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  walletList: {
    padding: 16,
  },
  walletCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  walletAddress: {
    fontSize: 14,
    color: '#6b7280',
  },
  walletBalance: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  balanceUSD: {
    fontSize: 14,
    color: '#6b7280',
  },
});

