import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { useAuth } from '../providers/AuthProvider';

interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'swap';
  from: string;
  to: string;
  amount: string;
  token: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
  hash: string;
  fee?: string;
}

interface TransactionGroup {
  title: string;
  data: Transaction[];
}

export default function TransactionHistoryScreen() {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<TransactionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, [token])
  );

  const fetchTransactions = async () => {
    try {
      setError(null);
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3000'}/api/transactions`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        }
      );

      // Group transactions by date
      const grouped = groupTransactionsByDate(response.data);
      setTransactions(grouped);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : 'Failed to fetch transactions';
      setError(message);
      console.error('Transaction fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const groupTransactionsByDate = (txs: Transaction[]): TransactionGroup[] => {
    const grouped: Record<string, Transaction[]> = {};

    txs.forEach(tx => {
      const date = new Date(tx.timestamp);
      const dateKey = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(tx);
    });

    return Object.entries(grouped).map(([title, data]) => ({
      title,
      data,
    }));
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'send':
        return '⬆️';
      case 'receive':
        return '⬇️';
      case 'swap':
        return '🔄';
      default:
        return '•';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'confirmed':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'failed':
        return '#EF4444';
      default:
        return '#94A3B8';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'confirmed':
        return '✓ Confirmed';
      case 'pending':
        return '⏳ Pending';
      case 'failed':
        return '✗ Failed';
      default:
        return status;
    }
  };

  const handleTransactionPress = (tx: Transaction) => {
    // Open blockchain explorer
    console.log('Opening explorer for:', tx.hash);
  };

  const renderTransactionItem = ({ item: tx }: { item: Transaction }) => (
    <TouchableOpacity
      style={styles.transactionItem}
      onPress={() => handleTransactionPress(tx)}
    >
      <View style={styles.transactionLeft}>
        <Text style={styles.transactionIcon}>{getTransactionIcon(tx.type)}</Text>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionType}>
            {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
          </Text>
          <Text style={styles.transactionAddress}>
            {tx.type === 'send'
              ? `To: ${tx.to.slice(0, 8)}...`
              : `From: ${tx.from.slice(0, 8)}...`}
          </Text>
        </View>
      </View>

      <View style={styles.transactionRight}>
        <Text style={styles.transactionAmount}>
          {tx.type === 'send' ? '-' : '+'}
          {parseFloat(tx.amount).toFixed(4)} {tx.token}
        </Text>
        <Text
          style={[
            styles.transactionStatus,
            { color: getStatusColor(tx.status) },
          ]}
        >
          {getStatusText(tx.status)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading transactions...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Error Loading Transactions</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchTransactions}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (transactions.length === 0 || transactions.every(g => g.data.length === 0)) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>No Transactions</Text>
        <Text style={styles.emptyMessage}>Your transaction history is empty</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Transaction History</Text>
      </View>

      <SectionList
        sections={transactions}
        keyExtractor={(item, index) => item.id + index}
        renderItem={renderTransactionItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchTransactions} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
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
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyMessage: {
    color: '#94A3B8',
    fontSize: 14,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionHeader: {
    paddingVertical: 12,
    paddingTop: 16,
  },
  sectionTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  transactionAddress: {
    color: '#94A3B8',
    fontSize: 12,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  transactionStatus: {
    fontSize: 11,
    fontWeight: '600',
  },
});
