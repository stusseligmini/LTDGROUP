import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import axios from 'axios';

interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'swap' | 'stake';
  blockchain: string;
  amount: string;
  amountUSD: number;
  from: string;
  to: string;
  timestamp: number;
  hash: string;
  status: 'pending' | 'success' | 'failed';
}

export default function TransactionHistoryScreen() {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'send' | 'receive' | 'swap' | 'stake'>('all');

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await axios.get(`${process.env.API_BASE_URL}/api/wallet/transactions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setTransactions(response.data.transactions || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (filter === 'all') return true;
    return tx.type === filter;
  });

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'send':
        return '↑';
      case 'receive':
        return '↓';
      case 'swap':
        return '⇄';
      case 'stake':
        return '📌';
      default:
        return '•';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'failed':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Buttons */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {(['all', 'send', 'receive', 'swap', 'stake'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Transactions List */}
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.transactionCard}>
            <View style={styles.transactionLeft}>
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor:
                      item.type === 'send'
                        ? '#fecaca'
                        : item.type === 'receive'
                          ? '#bbf7d0'
                          : item.type === 'swap'
                            ? '#dbeafe'
                            : '#fef3c7',
                  },
                ]}
              >
                <Text style={styles.icon}>{getTransactionIcon(item.type)}</Text>
              </View>
              <View>
                <Text style={styles.txType}>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</Text>
                <Text style={styles.txAddress}>
                  {item.type === 'send' ? 'To: ' : 'From: '}
                  {item.to.substring(0, 6)}...{item.to.substring(item.to.length - 4)}
                </Text>
              </View>
            </View>

            <View style={styles.transactionRight}>
              <Text
                style={[
                  styles.txAmount,
                  { color: item.type === 'receive' ? '#10b981' : '#ef4444' },
                ]}
              >
                {item.type === 'receive' ? '+' : '-'}
                {item.amount}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: getStatusColor(item.status) },
                  ]}
                />
                <Text style={styles.txDate}>
                  {new Date(item.timestamp * 1000).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  filterContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  filterButtonActive: {
    backgroundColor: '#6366f1',
  },
  filterText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  txType: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  txAddress: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  txDate: {
    color: '#64748b',
    fontSize: 12,
  },
});
